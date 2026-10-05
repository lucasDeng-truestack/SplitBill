-- AlterTable: record what was paid per method instead of one total
ALTER TABLE "Person" ADD COLUMN "paidCashCents" INTEGER,
ADD COLUMN "paidQrCents" INTEGER;

UPDATE "Person" SET "paidCashCents" = "paidCents", "paidQrCents" = 0
WHERE "paidCents" IS NOT NULL AND "paymentMethod" = 'CASH';
UPDATE "Person" SET "paidQrCents" = "paidCents", "paidCashCents" = 0
WHERE "paidCents" IS NOT NULL AND "paymentMethod" = 'QR';

ALTER TABLE "Person" DROP COLUMN "paidCents";
