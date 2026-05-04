export class CreateReceiptDto {
    // Optional — when present, the receipt is created from an invoice and
    // items must reference invoice items. When absent, the receipt is
    // standalone and clientId / items[].description are required.
    invoiceId?: string;
    // Standalone-only fields
    clientId?: string;
    currency?: string;
    items: {
        // Either invoiceItemId (invoice-linked) or description (standalone)
        invoiceItemId?: string;
        description?: string;
        amountPaid: number | string;
    }[];
    paymentMethodId?: string;
    paymentMethod?: string;
    paymentDetails?: string;
    notes?: string;
}

export class EditReceiptDto extends CreateReceiptDto {
    id: string;
}
