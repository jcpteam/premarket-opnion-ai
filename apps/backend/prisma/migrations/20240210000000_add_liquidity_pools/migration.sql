-- CreateTable
CREATE TABLE "liquidity_pools" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "totalLiquidity" DOUBLE PRECISION NOT NULL,
    "shares" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "liquidity_pools_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "liquidity_pools_marketId_idx" ON "liquidity_pools"("marketId");

-- CreateIndex
CREATE INDEX "liquidity_pools_providerId_idx" ON "liquidity_pools"("providerId");

-- CreateIndex
CREATE INDEX "liquidity_pools_marketId_providerId_idx" ON "liquidity_pools"("marketId", "providerId");

-- AddForeignKey
ALTER TABLE "liquidity_pools" ADD CONSTRAINT "liquidity_pools_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidity_pools" ADD CONSTRAINT "liquidity_pools_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add check constraints
ALTER TABLE "liquidity_pools" ADD CONSTRAINT "liquidity_pools_totalLiquidity_check" CHECK ("totalLiquidity" >= 0);
ALTER TABLE "liquidity_pools" ADD CONSTRAINT "liquidity_pools_shares_check" CHECK ("shares" >= 0);
