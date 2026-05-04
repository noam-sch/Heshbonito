-- Standalone receipts + ILS as the default currency
--
-- Changes:
--   * Receipt.invoiceId becomes nullable so a receipt can exist without an invoice.
--   * Receipt gets direct clientId / companyId / currency / notes columns so a
--     standalone receipt knows who it's for and in what currency, without needing
--     to traverse an invoice. For invoice-linked receipts these may be null
--     (the invoice remains the source of truth) or backfilled going forward.
--   * ReceiptItem.invoiceItemId becomes nullable and a `description` column is
--     added so standalone items can carry their own text.
--   * Existing FK on Receipt.invoiceId is dropped and recreated so it allows
--     NULLs.
--   * Company.currency default is changed from EUR to ILS.

-- AlterTable: Receipt — make invoiceId nullable, add direct relations + currency + notes
ALTER TABLE "public"."Receipt" DROP CONSTRAINT "Receipt_invoiceId_fkey";

ALTER TABLE "public"."Receipt" ALTER COLUMN "invoiceId" DROP NOT NULL;
ALTER TABLE "public"."Receipt" ADD COLUMN "clientId" TEXT;
ALTER TABLE "public"."Receipt" ADD COLUMN "companyId" TEXT;
ALTER TABLE "public"."Receipt" ADD COLUMN "currency" "public"."Currency";
ALTER TABLE "public"."Receipt" ADD COLUMN "notes" TEXT DEFAULT '';

-- Recreate FK to Invoice allowing NULL
ALTER TABLE "public"."Receipt" ADD CONSTRAINT "Receipt_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- New FKs for the direct client/company relations
ALTER TABLE "public"."Receipt" ADD CONSTRAINT "Receipt_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."Receipt" ADD CONSTRAINT "Receipt_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: ReceiptItem — make invoiceItemId nullable, add description
ALTER TABLE "public"."ReceiptItem" DROP CONSTRAINT "ReceiptItem_invoiceItemId_fkey";

ALTER TABLE "public"."ReceiptItem" ALTER COLUMN "invoiceItemId" DROP NOT NULL;
ALTER TABLE "public"."ReceiptItem" ADD COLUMN "description" TEXT;

-- Recreate FK to InvoiceItem allowing NULL
ALTER TABLE "public"."ReceiptItem" ADD CONSTRAINT "ReceiptItem_invoiceItemId_fkey"
    FOREIGN KEY ("invoiceItemId") REFERENCES "public"."InvoiceItem"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: Company — default currency is now ILS instead of EUR.
-- This only affects newly created companies; existing rows retain whatever
-- currency they were configured with.
ALTER TABLE "public"."Company" ALTER COLUMN "currency" SET DEFAULT 'ILS';
