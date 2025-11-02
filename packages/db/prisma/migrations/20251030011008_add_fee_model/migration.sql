-- CreateTable
CREATE TABLE "Fee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lotId" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "amountUsd" INTEGER NOT NULL,
    "feeRate" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "collectedAt" DATETIME,
    "collectedBy" TEXT,
    "chain" TEXT,
    "txHash" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Fee_sourceType_sourceId_idx" ON "Fee"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "Fee_lotId_idx" ON "Fee"("lotId");

-- CreateIndex
CREATE INDEX "Fee_status_idx" ON "Fee"("status");

-- CreateIndex
CREATE INDEX "Fee_createdAt_idx" ON "Fee"("createdAt");
