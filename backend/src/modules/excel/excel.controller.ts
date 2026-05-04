import {
    Body,
    Controller,
    Get,
    HttpCode,
    Post,
    Res,
    UploadedFile,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ExcelService, ParsedInvoiceRow, ParsedQuoteRow } from './excel.service';

@Controller('excel')
export class ExcelController {
    constructor(private readonly excelService: ExcelService) { }

    // ─────────────────────────────
    // EXPORT
    // ─────────────────────────────

    @Get('quotes/export')
    async exportQuotes(@Res() res: Response) {
        const buffer = await this.excelService.exportQuotes();
        const filename = `quotes-${new Date().toISOString().split('T')[0]}.xlsx`;
        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': buffer.length.toString(),
        });
        res.send(buffer);
    }

    @Get('invoices/export')
    async exportInvoices(@Res() res: Response) {
        const buffer = await this.excelService.exportInvoices();
        const filename = `invoices-${new Date().toISOString().split('T')[0]}.xlsx`;
        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': buffer.length.toString(),
        });
        res.send(buffer);
    }

    @Get('receipts/export')
    async exportReceipts(@Res() res: Response) {
        const buffer = await this.excelService.exportReceipts();
        const filename = `receipts-${new Date().toISOString().split('T')[0]}.xlsx`;
        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': buffer.length.toString(),
        });
        res.send(buffer);
    }

    // ─────────────────────────────
    // TEMPLATES
    // ─────────────────────────────

    @Get('quotes/template')
    async getQuoteTemplate(@Res() res: Response) {
        const buffer = await this.excelService.getQuoteTemplate();
        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="quote-template.xlsx"',
            'Content-Length': buffer.length.toString(),
        });
        res.send(buffer);
    }

    @Get('invoices/template')
    async getInvoiceTemplate(@Res() res: Response) {
        const buffer = await this.excelService.getInvoiceTemplate();
        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="invoice-template.xlsx"',
            'Content-Length': buffer.length.toString(),
        });
        res.send(buffer);
    }

    // ─────────────────────────────
    // VALIDATE
    // ─────────────────────────────

    @Post('quotes/validate')
    @HttpCode(200)
    @UseInterceptors(FileInterceptor('file'))
    async validateQuotes(@UploadedFile() file: Express.Multer.File) {
        if (!file) throw new Error('No file uploaded');
        return this.excelService.validateQuotesImport(file.buffer);
    }

    @Post('invoices/validate')
    @HttpCode(200)
    @UseInterceptors(FileInterceptor('file'))
    async validateInvoices(@UploadedFile() file: Express.Multer.File) {
        if (!file) throw new Error('No file uploaded');
        return this.excelService.validateInvoicesImport(file.buffer);
    }

    // ─────────────────────────────
    // IMPORT
    // ─────────────────────────────

    @Post('quotes/import')
    @HttpCode(200)
    async importQuotes(@Body() body: { rows: ParsedQuoteRow[] }) {
        return this.excelService.importQuotes(body.rows);
    }

    @Post('invoices/import')
    @HttpCode(200)
    async importInvoices(@Body() body: { rows: ParsedInvoiceRow[] }) {
        return this.excelService.importInvoices(body.rows);
    }
}
