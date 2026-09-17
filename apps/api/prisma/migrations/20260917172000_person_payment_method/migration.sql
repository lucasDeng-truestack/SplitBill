-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'QR');

-- AlterTable
ALTER TABLE "Person" ADD COLUMN "paymentMethod" "PaymentMethod";
