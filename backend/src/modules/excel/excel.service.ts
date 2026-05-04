import * as ExcelJS from 'exceljs';
import { BadRequestException, Injectable } from '@nestjs/common';
import prisma from '@/prisma/prisma.service';

export interface ImportError {
    row: number;
    field: string;
    message: string;
}

export interface ParsedQuoteRow {
    docKey: string;
    clientName: string;
    title?: string;
    notes?: string;
    validUntil?: string;
    currency?: string;
    discountRate?: number;
    description: string;
    quantity: number;
    unitPrice: number;
    vatRate: number;
    type: string;
}

export interface ParsedInvoiceRow {
    docKey: string;
    clientName: string;
    notes?: string;
    dueDate?: string;
    currency?: string;
    discountRate?: number;
    description: string;
    quantity: number;
    unitPrice: number;
    vatRate: number;
    type: string;
}

const ITEM_TYPES = ['HOUR', 'DAY', 'DEPOSIT', 'SERVICE', 'PRODUCT'];

function styledHeader(ws: ExcelJS.Worksheet, headers: { key: string; header: string; width: number }[]) {
    ws.columns = headers.map(h => ({ key: h.key, header: h.header, width: h.width }));
    const headerRow = ws.getRow(1);
    headerRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
        cell.alignment = { horizontal: 'right', readingOrder: 'rtl' };
        cell.border = { bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } } };
    });
    ws.views = [{ rightToLeft: true }];
}

function formatDate(d: Date | null | undefined): string {
    if (!d) return '';
    return new Date(d).toLocaleDateString('he-IL');
}

function statusLabel(status: string): string {
    const map: Record<string, string> = {
        DRAFT: 'טיוטה',
        SENT: 'נשלח',
        VIEWED: 'נצפה',
        SIGNED: 'חתום',
        EXPIRED: 'פג תוקף',
        PENDING: 'ממתין',
        PAID: 'שולם',
        PARTIAL: 'שולם חלקית',
        OVERDUE: 'פגה',
    };
    return map[status] || status;
}

@Injectable()
export class ExcelService {

    // ─────────────────────────────
    // EXPORT
    // ─────────────────────────────

    async exportQuotes(): Promise<Buffer> {
        const quotes = await prisma.quote.findMany({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
            include: { items: true, client: true },
        });

        const wb = new ExcelJS.Workbook();
        wb.creator = 'Heshbonito';
        wb.created = new Date();

        // Summary sheet
        const summaryWs = wb.addWorksheet('סיכום', { views: [{ rightToLeft: true }] });
        styledHeader(summaryWs, [
            { key: 'number', header: 'מספר', width: 10 },
            { key: 'date', header: 'תאריך', width: 14 },
            { key: 'client', header: 'לקוח', width: 24 },
            { key: 'title', header: 'כותרת', width: 24 },
            { key: 'status', header: 'סטטוס', width: 12 },
            { key: 'subtotal', header: 'סכום לפני מע"מ', width: 16 },
            { key: 'vat', header: 'מע"מ', width: 12 },
            { key: 'total', header: 'סה"כ', width: 12 },
            { key: 'currency', header: 'מטבע', width: 8 },
            { key: 'validUntil', header: 'תוקף עד', width: 14 },
        ]);

        for (const q of quotes) {
            const row = summaryWs.addRow({
                number: q.number,
                date: formatDate(q.createdAt),
                client: (q.client as any)?.name || (q.client as any)?.contactFirstname || '',
                title: q.title || '',
                status: statusLabel(q.status),
                subtotal: q.totalHT,
                vat: q.totalVAT,
                total: q.totalTTC,
                currency: q.currency || '',
                validUntil: formatDate(q.validUntil),
            });
            row.eachCell(cell => { cell.alignment = { horizontal: 'right', readingOrder: 'rtl' }; });
        }

        // Items sheet
        const itemsWs = wb.addWorksheet('פריטים', { views: [{ rightToLeft: true }] });
        styledHeader(itemsWs, [
            { key: 'number', header: 'מספר מסמך', width: 12 },
            { key: 'client', header: 'לקוח', width: 24 },
            { key: 'description', header: 'תיאור', width: 30 },
            { key: 'quantity', header: 'כמות', width: 10 },
            { key: 'unitPrice', header: 'מחיר יחידה', width: 14 },
            { key: 'type', header: 'סוג', width: 12 },
            { key: 'vatRate', header: 'שיעור מע"מ %', width: 14 },
            { key: 'total', header: 'סה"כ', width: 12 },
        ]);

        for (const q of quotes) {
            const clientName = (q.client as any)?.name || (q.client as any)?.contactFirstname || '';
            for (const item of q.items) {
                const row = itemsWs.addRow({
                    number: q.number,
                    client: clientName,
                    description: item.description,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    type: item.type,
                    vatRate: item.vatRate,
                    total: item.quantity * item.unitPrice,
                });
                row.eachCell(cell => { cell.alignment = { horizontal: 'right', readingOrder: 'rtl' }; });
            }
        }

        return wb.xlsx.writeBuffer() as unknown as Promise<Buffer>;
    }

    async exportInvoices(): Promise<Buffer> {
        const invoices = await prisma.invoice.findMany({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
            include: { items: true, client: true },
        });

        const wb = new ExcelJS.Workbook();
        wb.creator = 'Heshbonito';

        const summaryWs = wb.addWorksheet('סיכום', { views: [{ rightToLeft: true }] });
        styledHeader(summaryWs, [
            { key: 'number', header: 'מספר', width: 10 },
            { key: 'date', header: 'תאריך', width: 14 },
            { key: 'client', header: 'לקוח', width: 24 },
            { key: 'status', header: 'סטטוס', width: 12 },
            { key: 'subtotal', header: 'סכום לפני מע"מ', width: 16 },
            { key: 'vat', header: 'מע"מ', width: 12 },
            { key: 'total', header: 'סה"כ', width: 12 },
            { key: 'currency', header: 'מטבע', width: 8 },
            { key: 'dueDate', header: 'תאריך פירעון', width: 14 },
        ]);

        for (const inv of invoices) {
            const row = summaryWs.addRow({
                number: inv.number,
                date: formatDate(inv.createdAt),
                client: (inv.client as any)?.name || (inv.client as any)?.contactFirstname || '',
                status: statusLabel(inv.status),
                subtotal: inv.totalHT,
                vat: inv.totalVAT,
                total: inv.totalTTC,
                currency: inv.currency || '',
                dueDate: formatDate(inv.dueDate),
            });
            row.eachCell(cell => { cell.alignment = { horizontal: 'right', readingOrder: 'rtl' }; });
        }

        const itemsWs = wb.addWorksheet('פריטים', { views: [{ rightToLeft: true }] });
        styledHeader(itemsWs, [
            { key: 'number', header: 'מספר מסמך', width: 12 },
            { key: 'client', header: 'לקוח', width: 24 },
            { key: 'description', header: 'תיאור', width: 30 },
            { key: 'quantity', header: 'כמות', width: 10 },
            { key: 'unitPrice', header: 'מחיר יחידה', width: 14 },
            { key: 'type', header: 'סוג', width: 12 },
            { key: 'vatRate', header: 'שיעור מע"מ %', width: 14 },
            { key: 'total', header: 'סה"כ', width: 12 },
        ]);

        for (const inv of invoices) {
            const clientName = (inv.client as any)?.name || (inv.client as any)?.contactFirstname || '';
            for (const item of inv.items) {
                const row = itemsWs.addRow({
                    number: inv.number,
                    client: clientName,
                    description: item.description,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    type: item.type,
                    vatRate: item.vatRate,
                    total: item.quantity * item.unitPrice,
                });
                row.eachCell(cell => { cell.alignment = { horizontal: 'right', readingOrder: 'rtl' }; });
            }
        }

        return wb.xlsx.writeBuffer() as unknown as Promise<Buffer>;
    }

    async exportReceipts(): Promise<Buffer> {
        const receipts = await prisma.receipt.findMany({
            orderBy: { createdAt: 'desc' },
            include: { invoice: { include: { client: true } } },
        });

        const wb = new ExcelJS.Workbook();
        wb.creator = 'Heshbonito';

        const summaryWs = wb.addWorksheet('קבלות', { views: [{ rightToLeft: true }] });
        styledHeader(summaryWs, [
            { key: 'number', header: 'מספר קבלה', width: 12 },
            { key: 'date', header: 'תאריך', width: 14 },
            { key: 'client', header: 'לקוח', width: 24 },
            { key: 'invoiceNumber', header: 'מספר חשבונית', width: 14 },
            { key: 'total', header: 'סכום ששולם', width: 14 },
            { key: 'currency', header: 'מטבע', width: 8 },
        ]);

        for (const r of receipts) {
            const inv = r.invoice as any;
            const client = inv?.client;
            const clientName = client?.name || client?.contactFirstname || '';
            const row = summaryWs.addRow({
                number: r.number,
                date: formatDate(r.createdAt),
                client: clientName,
                invoiceNumber: inv?.number || '',
                total: r.totalPaid,
                currency: inv?.currency || '',
            });
            row.eachCell(cell => { cell.alignment = { horizontal: 'right', readingOrder: 'rtl' }; });
        }

        return wb.xlsx.writeBuffer() as unknown as Promise<Buffer>;
    }

    // ─────────────────────────────
    // TEMPLATES
    // ─────────────────────────────

    async getQuoteTemplate(): Promise<Buffer> {
        const wb = new ExcelJS.Workbook();
        wb.creator = 'Heshbonito';

        const ws = wb.addWorksheet('הצעות מחיר', { views: [{ rightToLeft: true }] });
        styledHeader(ws, [
            { key: 'docKey', header: 'מזהה מסמך', width: 14 },
            { key: 'clientName', header: 'שם לקוח', width: 24 },
            { key: 'title', header: 'כותרת', width: 24 },
            { key: 'notes', header: 'הערות', width: 24 },
            { key: 'validUntil', header: 'תוקף עד (DD/MM/YYYY)', width: 22 },
            { key: 'currency', header: 'מטבע (ILS/USD/EUR)', width: 20 },
            { key: 'discountRate', header: 'הנחה %', width: 10 },
            { key: 'description', header: 'תיאור פריט', width: 30 },
            { key: 'quantity', header: 'כמות', width: 10 },
            { key: 'unitPrice', header: 'מחיר יחידה', width: 14 },
            { key: 'vatRate', header: 'מע"מ %', width: 10 },
            { key: 'type', header: 'סוג (HOUR/DAY/SERVICE/PRODUCT/DEPOSIT)', width: 36 },
        ]);

        // Example row
        ws.addRow({
            docKey: '1',
            clientName: 'שם הלקוח',
            title: 'הצעת מחיר לפרויקט',
            notes: '',
            validUntil: '31/12/2025',
            currency: 'ILS',
            discountRate: 0,
            description: 'פריט לדוגמה',
            quantity: 1,
            unitPrice: 1000,
            vatRate: 18,
            type: 'SERVICE',
        });
        ws.addRow({
            docKey: '1',
            clientName: 'שם הלקוח',
            title: 'הצעת מחיר לפרויקט',
            notes: '',
            validUntil: '',
            currency: '',
            discountRate: '',
            description: 'פריט נוסף באותו מסמך',
            quantity: 2,
            unitPrice: 500,
            vatRate: 18,
            type: 'HOUR',
        });

        const noteWs = wb.addWorksheet('הוראות');
        noteWs.addRow(['הוראות שימוש:']);
        noteWs.addRow(['1. כל שורה מייצגת פריט אחד בהצעת מחיר.']);
        noteWs.addRow(['2. שורות עם אותו "מזהה מסמך" ו"שם לקוח" יקובצו להצעה אחת.']);
        noteWs.addRow(['3. שדות כותרת, הערות, תוקף ומטבע נלקחים מהשורה הראשונה בכל קבוצה.']);
        noteWs.addRow(['4. שם הלקוח חייב להיות שם מדויק של לקוח קיים במערכת.']);
        noteWs.addRow(['5. סוג פריט: HOUR, DAY, SERVICE, PRODUCT, DEPOSIT.']);

        return wb.xlsx.writeBuffer() as unknown as Promise<Buffer>;
    }

    async getInvoiceTemplate(): Promise<Buffer> {
        const wb = new ExcelJS.Workbook();
        wb.creator = 'Heshbonito';

        const ws = wb.addWorksheet('חשבוניות', { views: [{ rightToLeft: true }] });
        styledHeader(ws, [
            { key: 'docKey', header: 'מזהה מסמך', width: 14 },
            { key: 'clientName', header: 'שם לקוח', width: 24 },
            { key: 'notes', header: 'הערות', width: 24 },
            { key: 'dueDate', header: 'תאריך פירעון (DD/MM/YYYY)', width: 26 },
            { key: 'currency', header: 'מטבע (ILS/USD/EUR)', width: 20 },
            { key: 'discountRate', header: 'הנחה %', width: 10 },
            { key: 'description', header: 'תיאור פריט', width: 30 },
            { key: 'quantity', header: 'כמות', width: 10 },
            { key: 'unitPrice', header: 'מחיר יחידה', width: 14 },
            { key: 'vatRate', header: 'מע"מ %', width: 10 },
            { key: 'type', header: 'סוג (HOUR/DAY/SERVICE/PRODUCT/DEPOSIT)', width: 36 },
        ]);

        ws.addRow({
            docKey: '1',
            clientName: 'שם הלקוח',
            notes: '',
            dueDate: '31/12/2025',
            currency: 'ILS',
            discountRate: 0,
            description: 'פריט לדוגמה',
            quantity: 1,
            unitPrice: 1000,
            vatRate: 18,
            type: 'SERVICE',
        });

        const noteWs = wb.addWorksheet('הוראות');
        noteWs.addRow(['הוראות שימוש:']);
        noteWs.addRow(['1. כל שורה מייצגת פריט אחד בחשבונית.']);
        noteWs.addRow(['2. שורות עם אותו "מזהה מסמך" ו"שם לקוח" יקובצו לחשבונית אחת.']);
        noteWs.addRow(['3. שם הלקוח חייב להיות שם מדויק של לקוח קיים במערכת.']);
        noteWs.addRow(['4. סוג פריט: HOUR, DAY, SERVICE, PRODUCT, DEPOSIT.']);

        return wb.xlsx.writeBuffer() as unknown as Promise<Buffer>;
    }

    // ─────────────────────────────
    // PARSE (shared)
    // ─────────────────────────────

    private cellStr(cell: ExcelJS.Cell): string {
        const v = cell.value;
        if (v === null || v === undefined) return '';
        if (typeof v === 'object' && 'richText' in v) {
            return (v as ExcelJS.CellRichTextValue).richText.map((r: any) => r.text).join('');
        }
        return String(v).trim();
    }

    private cellNum(cell: ExcelJS.Cell): number | undefined {
        const v = cell.value;
        if (v === null || v === undefined || v === '') return undefined;
        const n = parseFloat(String(v));
        return isNaN(n) ? undefined : n;
    }

    // ─────────────────────────────
    // VALIDATE / IMPORT — QUOTES
    // ─────────────────────────────

    async validateQuotesImport(buffer: Buffer): Promise<{ valid: ParsedQuoteRow[]; errors: ImportError[] }> {
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buffer as any);
        const ws = wb.worksheets[0];
        if (!ws) throw new BadRequestException('Invalid file: no worksheet found');

        const errors: ImportError[] = [];
        const rows: ParsedQuoteRow[] = [];

        // Get all clients for lookup
        const clients = await prisma.client.findMany({ select: { name: true, contactFirstname: true, contactLastname: true } });
        const clientNames = new Set(clients.map((c: any) => (c.name || `${c.contactFirstname || ''} ${c.contactLastname || ''}`.trim()).toLowerCase()));

        ws.eachRow((row, rowIndex) => {
            if (rowIndex === 1) return; // skip header
            const docKey = this.cellStr(row.getCell(1));
            const clientName = this.cellStr(row.getCell(2));
            const title = this.cellStr(row.getCell(3));
            const notes = this.cellStr(row.getCell(4));
            const validUntil = this.cellStr(row.getCell(5));
            const currency = this.cellStr(row.getCell(6));
            const discountRate = this.cellNum(row.getCell(7));
            const description = this.cellStr(row.getCell(8));
            const quantity = this.cellNum(row.getCell(9));
            const unitPrice = this.cellNum(row.getCell(10));
            const vatRate = this.cellNum(row.getCell(11));
            const type = this.cellStr(row.getCell(12)).toUpperCase();

            // Skip empty rows
            if (!docKey && !clientName && !description) return;

            if (!clientName) errors.push({ row: rowIndex, field: 'שם לקוח', message: 'שם לקוח הוא שדה חובה' });
            else if (!clientNames.has(clientName.toLowerCase())) errors.push({ row: rowIndex, field: 'שם לקוח', message: `לקוח לא נמצא: ${clientName}` });

            if (!description) errors.push({ row: rowIndex, field: 'תיאור פריט', message: 'תיאור פריט הוא שדה חובה' });
            if (quantity === undefined || quantity <= 0) errors.push({ row: rowIndex, field: 'כמות', message: 'כמות חייבת להיות מספר חיובי' });
            if (unitPrice === undefined || unitPrice < 0) errors.push({ row: rowIndex, field: 'מחיר יחידה', message: 'מחיר יחידה חייב להיות מספר חיובי' });
            if (type && !ITEM_TYPES.includes(type)) errors.push({ row: rowIndex, field: 'סוג', message: `סוג לא תקין: ${type}. הסוגים הנתמכים: ${ITEM_TYPES.join(', ')}` });

            rows.push({
                docKey: docKey || `row_${rowIndex}`,
                clientName,
                title: title || undefined,
                notes: notes || undefined,
                validUntil: validUntil || undefined,
                currency: currency || undefined,
                discountRate,
                description,
                quantity: quantity ?? 1,
                unitPrice: unitPrice ?? 0,
                vatRate: vatRate ?? 18,
                type: ITEM_TYPES.includes(type) ? type : 'SERVICE',
            });
        });

        return { valid: rows, errors };
    }

    async importQuotes(rows: ParsedQuoteRow[]): Promise<{ created: number }> {
        const company = await prisma.company.findFirst();
        if (!company) throw new BadRequestException('No company found');

        // Group rows by docKey + clientName
        const groups = new Map<string, ParsedQuoteRow[]>();
        for (const row of rows) {
            const key = `${row.docKey}__${row.clientName}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(row);
        }

        let created = 0;
        for (const [, groupRows] of groups) {
            const first = groupRows[0];
            const client = await prisma.client.findFirst({
                where: {
                    OR: [
                        { name: { equals: first.clientName, mode: 'insensitive' } },
                        { contactFirstname: { contains: first.clientName } },
                    ],
                },
            });
            if (!client) continue;

            const items = groupRows.map((r, i) => ({
                description: r.description,
                quantity: r.quantity,
                unitPrice: r.unitPrice,
                vatRate: r.vatRate,
                type: r.type as any,
                order: i,
            }));

            const discountRate = first.discountRate ?? 0;
            const isVatExempt = !!company.exemptVat;
            const { totalHT, totalVAT, totalTTC } = this.calcTotals(items, discountRate, isVatExempt);

            await prisma.quote.create({
                data: {
                    companyId: company.id,
                    clientId: client.id,
                    title: first.title,
                    notes: first.notes,
                    currency: (first.currency || client.currency || company.currency) as any,
                    discountRate,
                    validUntil: first.validUntil ? this.parseDate(first.validUntil) : null,
                    totalHT,
                    totalVAT,
                    totalTTC,
                    items: { create: items },
                },
            });
            created++;
        }

        return { created };
    }

    async validateInvoicesImport(buffer: Buffer): Promise<{ valid: ParsedInvoiceRow[]; errors: ImportError[] }> {
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buffer as any);
        const ws = wb.worksheets[0];
        if (!ws) throw new BadRequestException('Invalid file: no worksheet found');

        const errors: ImportError[] = [];
        const rows: ParsedInvoiceRow[] = [];

        const clients = await prisma.client.findMany({ select: { name: true, contactFirstname: true, contactLastname: true } });
        const clientNames = new Set(clients.map((c: any) => (c.name || `${c.contactFirstname || ''} ${c.contactLastname || ''}`.trim()).toLowerCase()));

        ws.eachRow((row, rowIndex) => {
            if (rowIndex === 1) return;
            const docKey = this.cellStr(row.getCell(1));
            const clientName = this.cellStr(row.getCell(2));
            const notes = this.cellStr(row.getCell(3));
            const dueDate = this.cellStr(row.getCell(4));
            const currency = this.cellStr(row.getCell(5));
            const discountRate = this.cellNum(row.getCell(6));
            const description = this.cellStr(row.getCell(7));
            const quantity = this.cellNum(row.getCell(8));
            const unitPrice = this.cellNum(row.getCell(9));
            const vatRate = this.cellNum(row.getCell(10));
            const type = this.cellStr(row.getCell(11)).toUpperCase();

            if (!docKey && !clientName && !description) return;

            if (!clientName) errors.push({ row: rowIndex, field: 'שם לקוח', message: 'שם לקוח הוא שדה חובה' });
            else if (!clientNames.has(clientName.toLowerCase())) errors.push({ row: rowIndex, field: 'שם לקוח', message: `לקוח לא נמצא: ${clientName}` });

            if (!description) errors.push({ row: rowIndex, field: 'תיאור פריט', message: 'תיאור פריט הוא שדה חובה' });
            if (quantity === undefined || quantity <= 0) errors.push({ row: rowIndex, field: 'כמות', message: 'כמות חייבת להיות מספר חיובי' });
            if (unitPrice === undefined || unitPrice < 0) errors.push({ row: rowIndex, field: 'מחיר יחידה', message: 'מחיר יחידה חייב להיות מספר חיובי' });
            if (type && !ITEM_TYPES.includes(type)) errors.push({ row: rowIndex, field: 'סוג', message: `סוג לא תקין: ${type}` });

            rows.push({
                docKey: docKey || `row_${rowIndex}`,
                clientName,
                notes: notes || undefined,
                dueDate: dueDate || undefined,
                currency: currency || undefined,
                discountRate,
                description,
                quantity: quantity ?? 1,
                unitPrice: unitPrice ?? 0,
                vatRate: vatRate ?? 18,
                type: ITEM_TYPES.includes(type) ? type : 'SERVICE',
            });
        });

        return { valid: rows, errors };
    }

    async importInvoices(rows: ParsedInvoiceRow[]): Promise<{ created: number }> {
        const company = await prisma.company.findFirst();
        if (!company) throw new BadRequestException('No company found');

        const groups = new Map<string, ParsedInvoiceRow[]>();
        for (const row of rows) {
            const key = `${row.docKey}__${row.clientName}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(row);
        }

        let created = 0;
        for (const [, groupRows] of groups) {
            const first = groupRows[0];
            const client = await prisma.client.findFirst({
                where: {
                    OR: [
                        { name: { equals: first.clientName, mode: 'insensitive' } },
                        { contactFirstname: { contains: first.clientName } },
                    ],
                },
            });
            if (!client) continue;

            const items = groupRows.map((r, i) => ({
                description: r.description,
                quantity: r.quantity,
                unitPrice: r.unitPrice,
                vatRate: r.vatRate,
                type: r.type as any,
                order: i,
            }));

            const discountRate = first.discountRate ?? 0;
            const isVatExempt = !!company.exemptVat;
            const { totalHT, totalVAT, totalTTC } = this.calcTotals(items, discountRate, isVatExempt);

            const invoiceData: any = {
                companyId: company.id,
                clientId: client.id,
                notes: first.notes,
                currency: (first.currency || client.currency || company.currency) as any,
                discountRate,
                totalHT,
                totalVAT,
                totalTTC,
                items: { create: items },
            };
            if (first.dueDate) {
                const parsed = this.parseDate(first.dueDate);
                if (parsed) invoiceData.dueDate = parsed;
            }
            await prisma.invoice.create({ data: invoiceData });
            created++;
        }

        return { created };
    }

    // ─────────────────────────────
    // HELPERS
    // ─────────────────────────────

    private calcTotals(items: { quantity: number; unitPrice: number; vatRate: number }[], discountRate: number, isVatExempt: boolean) {
        const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
        const afterDiscount = subtotal * (1 - (discountRate || 0) / 100);
        const totalHT = Math.round(afterDiscount * 100) / 100;
        const totalVAT = isVatExempt ? 0 : Math.round(items.reduce((sum, i) => {
            const lineTotal = i.quantity * i.unitPrice * (1 - (discountRate || 0) / 100);
            return sum + lineTotal * ((i.vatRate ?? 0) / 100);
        }, 0) * 100) / 100;
        const totalTTC = Math.round((totalHT + totalVAT) * 100) / 100;
        return { totalHT, totalVAT, totalTTC };
    }

    private parseDate(dateStr: string): Date | null {
        if (!dateStr) return null;
        // Try DD/MM/YYYY
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            const [d, m, y] = parts;
            const date = new Date(Number(y), Number(m) - 1, Number(d));
            if (!isNaN(date.getTime())) return date;
        }
        // Try ISO
        const iso = new Date(dateStr);
        if (!isNaN(iso.getTime())) return iso;
        return null;
    }
}
