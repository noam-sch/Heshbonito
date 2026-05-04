-- AddColumn: defaultVatRate to Company
ALTER TABLE "Company" ADD COLUMN "defaultVatRate" DOUBLE PRECISION NOT NULL DEFAULT 18;
