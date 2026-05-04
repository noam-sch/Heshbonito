import type { Client } from "./client";
import type { Company } from "./company";
import type { Invoice } from "./invoice";
import type { PaymentMethod } from "./payment-method";

export interface ReceiptItem {
    id: string;
    // Optional — only present when the receipt is linked to an invoice
    invoiceItemId?: string | null;
    invoiceId?: string;
    invoice?: Invoice;
    // Used for standalone receipts (no linked invoice item)
    description?: string | null;
    amountPaid: number;
    receiptId: string;
    receipt?: Receipt;
}

export interface Receipt {
    id: string;
    number: number;
    rawNumber?: string; // Optional raw number for custom formats
    invoiceId?: string | null;
    invoice?: Invoice | null;
    clientId?: string | null;
    client?: Client | null;
    companyId?: string | null;
    company?: Company | null;
    currency?: string | null;
    items: ReceiptItem[];
    totalPaid: number;
    notes?: string | null;
    createdAt: string; // ISO date string
    updatedAt: string; // ISO date string
    paymentMethodId?: string;
    paymentMethod?: PaymentMethod;
}
