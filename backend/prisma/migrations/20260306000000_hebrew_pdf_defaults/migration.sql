-- AlterTable: change column defaults to Hebrew
ALTER TABLE "PDFConfig" ALTER COLUMN "invoice"        SET DEFAULT 'חשבונית';
ALTER TABLE "PDFConfig" ALTER COLUMN "quote"          SET DEFAULT 'הצעת מחיר';
ALTER TABLE "PDFConfig" ALTER COLUMN "receipt"        SET DEFAULT 'קבלה';
ALTER TABLE "PDFConfig" ALTER COLUMN "description"    SET DEFAULT 'תיאור:';
ALTER TABLE "PDFConfig" ALTER COLUMN "date"           SET DEFAULT 'תאריך:';
ALTER TABLE "PDFConfig" ALTER COLUMN "dueDate"        SET DEFAULT 'תאריך פירעון:';
ALTER TABLE "PDFConfig" ALTER COLUMN "validUntil"     SET DEFAULT 'בתוקף עד:';
ALTER TABLE "PDFConfig" ALTER COLUMN "paymentDate"    SET DEFAULT 'תאריך תשלום:';
ALTER TABLE "PDFConfig" ALTER COLUMN "billTo"         SET DEFAULT 'לחיוב:';
ALTER TABLE "PDFConfig" ALTER COLUMN "quoteFor"       SET DEFAULT 'הצעה עבור:';
ALTER TABLE "PDFConfig" ALTER COLUMN "receivedFrom"   SET DEFAULT 'התקבל מ:';
ALTER TABLE "PDFConfig" ALTER COLUMN "invoiceRefer"   SET DEFAULT 'אסמכתה לחשבונית:';
ALTER TABLE "PDFConfig" ALTER COLUMN "quantity"       SET DEFAULT 'כמות';
ALTER TABLE "PDFConfig" ALTER COLUMN "vatRate"        SET DEFAULT 'מע"מ (%)';
ALTER TABLE "PDFConfig" ALTER COLUMN "unitPrice"      SET DEFAULT 'מחיר יחידה';
ALTER TABLE "PDFConfig" ALTER COLUMN "subtotal"       SET DEFAULT 'סכום ביניים:';
ALTER TABLE "PDFConfig" ALTER COLUMN "discount"       SET DEFAULT 'הנחה:';
ALTER TABLE "PDFConfig" ALTER COLUMN "total"          SET DEFAULT 'סה"כ:';
ALTER TABLE "PDFConfig" ALTER COLUMN "vat"            SET DEFAULT 'מע"מ:';
ALTER TABLE "PDFConfig" ALTER COLUMN "grandTotal"     SET DEFAULT 'סה"כ לתשלום:';
ALTER TABLE "PDFConfig" ALTER COLUMN "totalReceived"  SET DEFAULT 'סה"כ התקבל:';
ALTER TABLE "PDFConfig" ALTER COLUMN "notes"          SET DEFAULT 'הערות:';
ALTER TABLE "PDFConfig" ALTER COLUMN "paymentMethod"  SET DEFAULT 'אמצעי תשלום:';
ALTER TABLE "PDFConfig" ALTER COLUMN "paymentDetails" SET DEFAULT 'פרטי תשלום:';
ALTER TABLE "PDFConfig" ALTER COLUMN "type"           SET DEFAULT 'סוג';
ALTER TABLE "PDFConfig" ALTER COLUMN "hour"           SET DEFAULT 'שעה';
ALTER TABLE "PDFConfig" ALTER COLUMN "day"            SET DEFAULT 'יום';
ALTER TABLE "PDFConfig" ALTER COLUMN "deposit"        SET DEFAULT 'מקדמה';
ALTER TABLE "PDFConfig" ALTER COLUMN "service"        SET DEFAULT 'שירות';
ALTER TABLE "PDFConfig" ALTER COLUMN "product"        SET DEFAULT 'מוצר';
ALTER TABLE "PDFConfig" ALTER COLUMN "paymentMethodBankTransfer" SET DEFAULT 'העברה בנקאית';
ALTER TABLE "PDFConfig" ALTER COLUMN "paymentMethodPayPal"       SET DEFAULT 'PayPal';
ALTER TABLE "PDFConfig" ALTER COLUMN "paymentMethodCash"         SET DEFAULT 'מזומן';
ALTER TABLE "PDFConfig" ALTER COLUMN "paymentMethodCheck"        SET DEFAULT 'המחאה';
ALTER TABLE "PDFConfig" ALTER COLUMN "paymentMethodOther"        SET DEFAULT 'אחר';
ALTER TABLE "PDFConfig" ALTER COLUMN "VATId"   SET DEFAULT 'מע"מ';
ALTER TABLE "PDFConfig" ALTER COLUMN "legalId" SET DEFAULT 'מס'' עוסק/ח.פ.';

-- Update existing rows that still have English defaults
UPDATE "PDFConfig" SET
  "invoice"        = 'חשבונית',
  "quote"          = 'הצעת מחיר',
  "receipt"        = 'קבלה',
  "description"    = 'תיאור:',
  "date"           = 'תאריך:',
  "dueDate"        = 'תאריך פירעון:',
  "validUntil"     = 'בתוקף עד:',
  "paymentDate"    = 'תאריך תשלום:',
  "billTo"         = 'לחיוב:',
  "quoteFor"       = 'הצעה עבור:',
  "receivedFrom"   = 'התקבל מ:',
  "invoiceRefer"   = 'אסמכתה לחשבונית:',
  "quantity"       = 'כמות',
  "vatRate"        = 'מע"מ (%)',
  "unitPrice"      = 'מחיר יחידה',
  "subtotal"       = 'סכום ביניים:',
  "discount"       = 'הנחה:',
  "total"          = 'סה"כ:',
  "vat"            = 'מע"מ:',
  "grandTotal"     = 'סה"כ לתשלום:',
  "totalReceived"  = 'סה"כ התקבל:',
  "notes"          = 'הערות:',
  "paymentMethod"  = 'אמצעי תשלום:',
  "paymentDetails" = 'פרטי תשלום:',
  "type"           = 'סוג',
  "hour"           = 'שעה',
  "day"            = 'יום',
  "deposit"        = 'מקדמה',
  "service"        = 'שירות',
  "product"        = 'מוצר',
  "paymentMethodBankTransfer" = 'העברה בנקאית',
  "paymentMethodPayPal"       = 'PayPal',
  "paymentMethodCash"         = 'מזומן',
  "paymentMethodCheck"        = 'המחאה',
  "paymentMethodOther"        = 'אחר',
  "VATId"   = 'מע"מ',
  "legalId" = 'מס'' עוסק/ח.פ.'
WHERE "invoice" = 'Invoice';
