-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('PROCESSING', 'REVIEW', 'COLLECTING', 'COMPLETED');

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MYR',
    "status" "ReceiptStatus" NOT NULL DEFAULT 'REVIEW',
    "subtotalCents" INTEGER,
    "discountCents" INTEGER,
    "serviceChargeCents" INTEGER,
    "taxCents" INTEGER,
    "roundingCents" INTEGER,
    "totalCents" INTEGER,
    "imagePath" TEXT,
    "parserProvider" TEXT,
    "parserRawJson" JSONB,
    "validationIssues" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptItem" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "totalPriceCents" INTEGER NOT NULL,
    "assignedQuantity" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReceiptItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemAssignment" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReceiptItem_receiptId_idx" ON "ReceiptItem"("receiptId");

-- CreateIndex
CREATE INDEX "Person_receiptId_idx" ON "Person"("receiptId");

-- CreateIndex
CREATE INDEX "ItemAssignment_receiptId_idx" ON "ItemAssignment"("receiptId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemAssignment_personId_itemId_key" ON "ItemAssignment"("personId", "itemId");

-- AddForeignKey
ALTER TABLE "ReceiptItem" ADD CONSTRAINT "ReceiptItem_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemAssignment" ADD CONSTRAINT "ItemAssignment_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemAssignment" ADD CONSTRAINT "ItemAssignment_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemAssignment" ADD CONSTRAINT "ItemAssignment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ReceiptItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
