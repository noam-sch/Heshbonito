import * as Handlebars from 'handlebars';

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { CreateReceiptDto, EditReceiptDto } from '@/modules/receipts/dto/receipts.dto';
import { getInvertColor, getPDF } from '@/utils/pdf';

import { MailService } from '@/mail/mail.service';
import { WebhookDispatcherService } from '../webhooks/webhook-dispatcher.service';
import { WebhookEvent } from '../../../prisma/generated/prisma/client';
import { baseTemplate } from '@/modules/receipts/templates/base.template';
import { formatDate } from '@/utils/date';
import { logger } from '@/logger/logger.service';
import prisma from '@/prisma/prisma.service';
import { randomUUID } from 'crypto';
import { clampDiscountRate } from '@/utils/financial';

@Injectable()
export class ReceiptsService {
    private readonly logger: Logger;

    /**
     * Default include shape for receipt queries — pulls the items, the
     * receipt's own client/company (used for standalone receipts), and the
     * linked invoice with its items+client+quote (used for invoice-linked
     * receipts). Keep listing/search/PDF queries consistent so the frontend
     * doesn't have to branch on shape.
     */
    private static readonly receiptInclude = {
        items: true,
        client: true,
        company: true,
        invoice: {
            include: {
                items: true,
                client: true,
                quote: true,
            },
        },
    } as const;

    constructor(
        private readonly mailService: MailService,
        private readonly webhookDispatcher: WebhookDispatcherService
    ) {
        this.logger = new Logger(ReceiptsService.name);
    }

    /**
     * Receipts can reference a saved PaymentMethod by id, but historically the
     * `paymentMethod` field was a free-text string. The frontend wants an
     * object when one is available, so resolve+attach it post-query.
     */
    private async attachPaymentMethods<T extends { paymentMethodId?: string | null; paymentMethod?: any }>(
        receipts: T[],
    ): Promise<T[]> {
        return Promise.all(receipts.map(async (r) => {
            if (!r.paymentMethodId) return r;
            const pm = await prisma.paymentMethod.findUnique({ where: { id: r.paymentMethodId } });
            return pm ? { ...r, paymentMethod: pm } : r;
        }));
    }

    async getReceipts(page: string) {
        const pageNumber = parseInt(page, 10) || 1;
        const pageSize = 10;
        const skip = (pageNumber - 1) * pageSize;
        const company = await prisma.company.findFirst();

        if (!company) {
            logger.error('No company found. Please create a company first.', { category: 'receipt' });
            throw new BadRequestException('No company found. Please create a company first.');
        }

        const [receipts, totalReceipts] = await Promise.all([
            prisma.receipt.findMany({
                skip,
                take: pageSize,
                orderBy: { createdAt: 'desc' },
                include: ReceiptsService.receiptInclude,
            }),
            prisma.receipt.count(),
        ]);

        return {
            pageCount: Math.ceil(totalReceipts / pageSize),
            receipts: await this.attachPaymentMethods(receipts),
        };
    }

    async searchReceipts(query: string) {
        const where = query
            ? {
                OR: [
                    { invoice: { quote: { title: { contains: query } } } },
                    { invoice: { client: { name: { contains: query } } } },
                    { client: { name: { contains: query } } },
                ],
            }
            : undefined;

        const results = await prisma.receipt.findMany({
            where,
            take: 10,
            orderBy: { number: 'asc' },
            include: ReceiptsService.receiptInclude,
        });

        return this.attachPaymentMethods(results);
    }

    private async checkInvoiceAfterReceipt(invoiceId: string) {
        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId }
        });

        if (!invoice) {
            logger.error('Invoice not found', { category: 'receipt', details: { invoiceId } });
            throw new BadRequestException('Invoice not found');
        }

        if (invoice.status === 'UNPAID') {
            const receipts = await prisma.receipt.findMany({
                where: { invoiceId },
                select: { totalPaid: true },
            });

            const totalPaid = receipts.reduce((sum, receipt) => sum + receipt.totalPaid, 0);
            if (totalPaid >= invoice.totalTTC) {
                await prisma.invoice.update({
                    where: { id: invoiceId },
                    data: { status: 'PAID' },
                });
            } else {
                await prisma.invoice.update({
                    where: { id: invoiceId },
                    data: { status: 'UNPAID' },
                });
            }
        }
    }

    async createReceipt(body: CreateReceiptDto) {
        // Two creation paths:
        //   1) Invoice-linked receipt: invoiceId is provided, items reference invoice items.
        //   2) Standalone receipt: no invoiceId; clientId + currency + items[].description required.
        if (body.invoiceId) {
            return this.createInvoiceLinkedReceipt(body);
        }
        return this.createStandaloneReceipt(body);
    }

    private async createInvoiceLinkedReceipt(body: CreateReceiptDto) {
        if (!body.invoiceId) {
            // Caller (createReceipt) guards against this, but narrow for TS.
            throw new BadRequestException('Invoice ID is required for invoice-linked receipts');
        }
        const invoiceId = body.invoiceId;
        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: {
                company: true,
                client: true,
                items: true,
            },
        });

        if (!invoice) {
            logger.error('Invoice not found', { category: 'receipt', details: { invoiceId } });
            throw new BadRequestException('Invoice not found');
        }

        const receipt = await prisma.receipt.create({
            data: {
                invoiceId,
                clientId: invoice.clientId,
                companyId: invoice.companyId,
                currency: invoice.currency,
                items: {
                    create: body.items.map(item => ({
                        invoiceItemId: item.invoiceItemId,
                        description: item.description,
                        amountPaid: +item.amountPaid,
                    })),
                },
                totalPaid: body.items.reduce((sum, item) => sum + +item.amountPaid, 0),
                paymentMethodId: body.paymentMethodId,
                paymentMethod: body.paymentMethod,
                paymentDetails: body.paymentDetails,
                notes: body.notes,
            },
            include: {
                items: true,
            },
        });

        await this.checkInvoiceAfterReceipt(invoice.id);

        try {
            await this.webhookDispatcher.dispatch(WebhookEvent.RECEIPT_CREATED, {
                receipt,
                invoice,
                client: invoice.client,
                company: invoice.company,
            });
        } catch (error) {
            this.logger.error('Failed to dispatch RECEIPT_CREATED webhook', error);
        }

        logger.info('Receipt created', { category: 'receipt', details: { receiptId: receipt.id, companyId: invoice.company?.id } });

        return receipt;
    }

    private async createStandaloneReceipt(body: CreateReceiptDto) {
        if (!body.clientId) {
            logger.error('Standalone receipt requires clientId', { category: 'receipt' });
            throw new BadRequestException('A client is required when creating a receipt without an invoice.');
        }
        if (!body.items || body.items.length === 0) {
            throw new BadRequestException('At least one item is required.');
        }
        for (const item of body.items) {
            if (!item.description || item.description.trim().length === 0) {
                throw new BadRequestException('Each item needs a description when there is no invoice.');
            }
        }

        const company = await prisma.company.findFirst();
        if (!company) {
            logger.error('No company found. Please create a company first.', { category: 'receipt' });
            throw new BadRequestException('No company found. Please create a company first.');
        }

        const client = await prisma.client.findUnique({ where: { id: body.clientId } });
        if (!client) {
            logger.error('Client not found', { category: 'receipt', details: { clientId: body.clientId } });
            throw new BadRequestException('Client not found');
        }

        const currency = (body.currency || client.currency || company.currency) as any;

        const receipt = await prisma.receipt.create({
            data: {
                invoiceId: null,
                clientId: client.id,
                companyId: company.id,
                currency,
                items: {
                    create: body.items.map(item => ({
                        invoiceItemId: null,
                        description: item.description,
                        amountPaid: +item.amountPaid,
                    })),
                },
                totalPaid: body.items.reduce((sum, item) => sum + +item.amountPaid, 0),
                paymentMethodId: body.paymentMethodId,
                paymentMethod: body.paymentMethod,
                paymentDetails: body.paymentDetails,
                notes: body.notes,
            },
            include: {
                items: true,
            },
        });

        try {
            await this.webhookDispatcher.dispatch(WebhookEvent.RECEIPT_CREATED, {
                receipt,
                invoice: null,
                client,
                company,
            });
        } catch (error) {
            this.logger.error('Failed to dispatch RECEIPT_CREATED webhook', error);
        }

        logger.info('Standalone receipt created', { category: 'receipt', details: { receiptId: receipt.id, companyId: company.id } });

        return receipt;
    }

    async createReceiptFromInvoice(invoiceId: string) {
        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: {
                items: true,
                client: true,
                company: true,
            },
        });
        if (!invoice) {
            logger.error('Invoice not found', { category: 'receipt', details: { invoiceId } });
            throw new BadRequestException('Invoice not found');
        }

        const discountFactor = 1 - clampDiscountRate(invoice.discountRate) / 100;
        const newReceipt = await this.createReceipt({
            invoiceId: invoice.id,
            items: invoice.items.map(item => {
                const vatMultiplier = 1 + (item.vatRate || 0) / 100;
                const discountedBase = item.quantity * item.unitPrice * discountFactor;
                const amountPaid = discountedBase * vatMultiplier;
                return {
                    invoiceItemId: item.id,
                    amountPaid: amountPaid.toFixed(2),
                };
            }),
            paymentMethodId: invoice.paymentMethodId || undefined,
            paymentMethod: invoice.paymentMethod || '',
            paymentDetails: invoice.paymentDetails || '',
        });

        try {
            await this.webhookDispatcher.dispatch(WebhookEvent.RECEIPT_CREATED_FROM_INVOICE, {
                receipt: newReceipt,
                invoice,
                client: invoice.client,
                company: invoice.company,
            });
        } catch (error) {
            this.logger.error('Failed to dispatch RECEIPT_CREATED_FROM_INVOICE webhook', error);
        }

        logger.info('Receipt created from invoice', { category: 'receipt', details: { receiptId: newReceipt.id, invoiceId } });

        return newReceipt;
    }

    async editReceipt(body: EditReceiptDto) {
        const existingReceipt = await prisma.receipt.findUnique({
            where: { id: body.id },
            include: {
                items: true,
            },
        });

        if (!existingReceipt) {
            logger.error('Receipt not found', { category: 'receipt', details: { receiptId: body.id } });
            throw new BadRequestException('Receipt not found');
        }

        const updatedReceipt = await prisma.receipt.update({
            where: { id: existingReceipt.id },
            data: {
                items: {
                    deleteMany: { receiptId: existingReceipt.id },
                    createMany: {
                        data: body.items.map(item => ({
                            id: randomUUID(),
                            invoiceItemId: item.invoiceItemId,
                            description: item.description,
                            amountPaid: +item.amountPaid,
                        })),
                    },
                },
                totalPaid: body.items.reduce((sum, item) => sum + +item.amountPaid, 0),
                paymentMethodId: body.paymentMethodId,
                paymentMethod: body.paymentMethod,
                paymentDetails: body.paymentDetails,
                notes: body.notes,
            },
            include: {
                items: true,
                client: true,
                company: true,
                invoice: {
                    include: {
                        client: true,
                        company: true,
                    }
                },
            },
        });

        if (existingReceipt.invoiceId) {
            await this.checkInvoiceAfterReceipt(existingReceipt.invoiceId);
        }

        try {
            await this.webhookDispatcher.dispatch(WebhookEvent.RECEIPT_UPDATED, {
                receipt: updatedReceipt,
                invoice: updatedReceipt.invoice ?? null,
                client: updatedReceipt.invoice?.client ?? updatedReceipt.client ?? null,
                company: updatedReceipt.invoice?.company ?? updatedReceipt.company ?? null,
            });
        } catch (error) {
            this.logger.error('Failed to dispatch RECEIPT_UPDATED webhook', error);
        }

        logger.info('Receipt updated', { category: 'receipt', details: { receiptId: updatedReceipt.id } });

        return updatedReceipt;
    }

    async deleteReceipt(id: string) {
        const existingReceipt = await prisma.receipt.findUnique({
            where: { id },
            include: {
                items: true,
                client: true,
                company: true,
                invoice: {
                    include: {
                        client: true,
                        company: true,
                    }
                }
            }
        });

        if (!existingReceipt) {
            logger.error('Receipt not found', { category: 'receipt', details: { receiptId: id } });
            throw new BadRequestException('Receipt not found');
        }

        await prisma.receiptItem.deleteMany({
            where: { receiptId: id },
        });

        await prisma.receipt.delete({
            where: { id },
        });

        if (existingReceipt.invoiceId) {
            await this.checkInvoiceAfterReceipt(existingReceipt.invoiceId);
        }

        try {
            await this.webhookDispatcher.dispatch(WebhookEvent.RECEIPT_DELETED, {
                receipt: existingReceipt,
                invoice: existingReceipt.invoice ?? null,
                client: existingReceipt.invoice?.client ?? existingReceipt.client ?? null,
                company: existingReceipt.invoice?.company ?? existingReceipt.company ?? null,
            });
        } catch (error) {
            this.logger.error('Failed to dispatch RECEIPT_DELETED webhook', error);
        }

        logger.info('Receipt deleted', { category: 'receipt', details: { receiptId: id } });

        return { message: 'Receipt deleted successfully' };
    }

    async getReceiptPdf(receiptId: string): Promise<Uint8Array> {
        const receipt = await prisma.receipt.findUnique({
            where: { id: receiptId },
            include: {
                items: true,
                client: true,
                company: {
                    include: { pdfConfig: true },
                },
                invoice: {
                    include: {
                        items: true,
                        client: true,
                        company: {
                            include: { pdfConfig: true },
                        },
                    },
                }
            },
        });

        if (!receipt) {
            logger.error('Receipt not found', { category: 'receipt', details: { receiptId } });
            throw new BadRequestException('Receipt not found');
        }

        // Resolve company / client / currency from invoice when present, else
        // fall back to the receipt's own direct relations.
        const company = receipt.invoice?.company ?? receipt.company;
        const client = receipt.invoice?.client ?? receipt.client;
        const currency = receipt.invoice?.currency ?? receipt.currency;

        if (!company) {
            logger.error('Receipt has no associated company', { category: 'receipt', details: { receiptId } });
            throw new BadRequestException('Receipt has no associated company');
        }
        if (!client) {
            logger.error('Receipt has no associated client', { category: 'receipt', details: { receiptId } });
            throw new BadRequestException('Receipt has no associated client');
        }

        const pdfConfig = (company as any).pdfConfig;
        const template = Handlebars.compile(baseTemplate);

        if (client.name.length == 0) {
            client.name = (client.contactFirstname || '') + ' ' + (client.contactLastname || '');
        }

        // Map payment method enum -> PDFConfig label
        const paymentMethodLabels: Record<string, string> = {
            BANK_TRANSFER: pdfConfig.paymentMethodBankTransfer,
            PAYPAL: pdfConfig.paymentMethodPayPal,
            CASH: pdfConfig.paymentMethodCash,
            CHECK: pdfConfig.paymentMethodCheck,
            OTHER: pdfConfig.paymentMethodOther,
        };

        // Default payment display values
        let paymentMethodName: string = receipt.paymentMethod;
        let paymentDetails: string = receipt.paymentDetails;

        // Prefer the saved payment method record if referenced
        if (receipt.paymentMethodId) {
            const pm = await prisma.paymentMethod.findUnique({ where: { id: receipt.paymentMethodId } });
            if (pm) {
                paymentMethodName = paymentMethodLabels[pm.type as string] || pm.type;
                paymentDetails = pm.details || paymentDetails;
            }
        } else {
            if (paymentMethodName && paymentMethodLabels[paymentMethodName.toUpperCase()]) {
                paymentMethodName = paymentMethodLabels[paymentMethodName.toUpperCase()];
            }
        }

        // Map item type enums to PDF label text (from pdfConfig)
        const itemTypeLabels: Record<string, string> = {
            HOUR: pdfConfig.hour,
            DAY: pdfConfig.day,
            DEPOSIT: pdfConfig.deposit,
            SERVICE: pdfConfig.service,
            PRODUCT: pdfConfig.product,
        };

        const invoiceDiscountRate = receipt.invoice ? clampDiscountRate(receipt.invoice.discountRate) : 0;
        const discountFactor = 1 - invoiceDiscountRate / 100;
        let totalBeforeDiscount = receipt.totalPaid;
        if (discountFactor > 0 && discountFactor < 1 && receipt.items.length > 0) {
            totalBeforeDiscount = receipt.items.reduce((sum, item) => sum + (item.amountPaid / discountFactor), 0);
        }
        const discountAmountValue = Math.max(0, totalBeforeDiscount - receipt.totalPaid);
        const hasDiscount = invoiceDiscountRate > 0 && discountAmountValue > 0;

        const html = template({
            number: receipt.rawNumber || receipt.number.toString(),
            paymentDate: formatDate(company as any, new Date()),
            invoiceNumber: receipt.invoice?.rawNumber || receipt.invoice?.number?.toString() || '',
            hasInvoice: !!receipt.invoice,
            client,
            company,
            currency,
            paymentMethod: paymentMethodName,
            totalAmount: receipt.totalPaid.toFixed(2),
            totalBeforeDiscount: totalBeforeDiscount.toFixed(2),
            discountAmount: discountAmountValue.toFixed(2),
            discountRate: Number(invoiceDiscountRate.toFixed(2)),
            hasDiscount,

            items: receipt.items.map(item => {
                const invoiceItem = receipt.invoice?.items.find(i => i.id === item.invoiceItemId);
                return {
                    description: invoiceItem?.description || item.description || 'N/A',
                    type: invoiceItem ? (itemTypeLabels[invoiceItem.type as string] || invoiceItem.type || '') : '',
                    amount: item.amountPaid.toFixed(2),
                };
            }),

            fontFamily: pdfConfig.fontFamily ?? 'Inter',
            primaryColor: pdfConfig.primaryColor ?? '#0ea5e9',
            secondaryColor: pdfConfig.secondaryColor ?? '#f3f4f6',
            tableTextColor: getInvertColor(pdfConfig.secondaryColor),
            includeLogo: !!pdfConfig.logoB64,
            logoB64: pdfConfig.logoB64 ?? '',
            padding: pdfConfig.padding ?? 40,

            labels: {
                receipt: pdfConfig.receipt,
                paymentDate: pdfConfig.paymentDate,
                receivedFrom: pdfConfig.receivedFrom,
                invoiceRefer: pdfConfig.invoiceRefer,
                description: pdfConfig.description,
                type: pdfConfig.type,
                discount: pdfConfig.discount,
                totalReceived: pdfConfig.totalReceived,
                paymentMethod: pdfConfig.paymentMethod,
                paymentDetails: pdfConfig.paymentDetails,
                legalId: pdfConfig.legalId,
                VATId: pdfConfig.VATId,
                hour: pdfConfig.hour,
                day: pdfConfig.day,
                deposit: pdfConfig.deposit,
                service: pdfConfig.service,
                product: pdfConfig.product
            },

            vatExemptText: (company as any).exemptVat && ((company as any).country || '').toUpperCase() === 'FRANCE' ? 'TVA non applicable, art. 293 B du CGI' : null,
        });

        const pdfBuffer = await getPDF(html);
        return pdfBuffer;
    }


    async sendReceiptByEmail(id: string) {
        const receipt = await prisma.receipt.findUnique({
            where: { id },
            include: {
                client: true,
                company: true,
                invoice: {
                    include: {
                        client: true,
                        company: true,
                    }
                }
            },
        });

        if (!receipt) {
            logger.error('Receipt not found', { category: 'receipt', details: { id } });
            throw new BadRequestException('Receipt not found');
        }

        const client = receipt.invoice?.client ?? receipt.client;
        const company = receipt.invoice?.company ?? receipt.company;

        if (!client || !company) {
            logger.error('Receipt has no associated client or company', { category: 'receipt', details: { id } });
            throw new BadRequestException('Receipt has no associated client or company');
        }

        const pdfBuffer = await this.getReceiptPdf(id);

        const mailTemplate = await prisma.mailTemplate.findFirst({
            where: { type: 'RECEIPT' },
            select: { subject: true, body: true }
        });

        if (!mailTemplate) {
            logger.error('Email template for receipt not found.', { category: 'receipt' });
            throw new BadRequestException('Email template for receipt not found.');
        }

        const envVariables = {
            APP_URL: process.env.APP_URL,
            RECEIPT_NUMBER: receipt.rawNumber || receipt.number.toString(),
            COMPANY_NAME: company.name,
            CLIENT_NAME: client.name,
        };

        if (!client.contactEmail) {
            logger.error('Client has no email configured; receipt not sent', { category: 'receipt', details: { id } });
            throw new BadRequestException('Client has no email configured; receipt not sent');
        }

        const mailOptions = {
            to: client.contactEmail,
            subject: mailTemplate.subject.replace(/{{(\w+)}}/g, (_, key) => envVariables[key] || ''),
            html: mailTemplate.body.replace(/{{(\w+)}}/g, (_, key) => envVariables[key] || ''),
            attachments: [{
                filename: `receipt-${receipt.rawNumber || receipt.number}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf',
            }],
        };

        try {
            await this.mailService.sendMail(mailOptions);
        } catch (error) {
            logger.error('Failed to send receipt email', { category: 'receipt', details: { error } });
            throw new BadRequestException('Failed to send receipt email. Please check your SMTP configuration.');
        }

        return { message: 'Receipt sent successfully' };
    }
}
