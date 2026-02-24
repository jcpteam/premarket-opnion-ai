-- CreateEnum
CREATE TYPE "MarketType" AS ENUM ('BINARY', 'MULTI_OUTCOME');

-- CreateEnum
CREATE TYPE "MarketStatus" AS ENUM ('ACTIVE', 'CLOSED', 'RESOLVED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "OrderSubType" AS ENUM ('MARKET', 'LIMIT');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PARTIAL', 'FILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ResolutionStatus" AS ENUM ('PENDING', 'RESOLVED', 'DISPUTED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "username" TEXT,
    "email" TEXT,
    "profileImage" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "totalVolume" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTrades" INTEGER NOT NULL DEFAULT 0,
    "winRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "profitLoss" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "markets" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tags" TEXT[],
    "type" "MarketType" NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "resolutionDate" TIMESTAMP(3),
    "status" "MarketStatus" NOT NULL DEFAULT 'ACTIVE',
    "totalVolume" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalShares" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "winningOutcome" TEXT,
    "resolutionSource" TEXT,
    "creatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "markets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outcomes" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "currentPrice" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "totalShares" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bestBid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bestAsk" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "spread" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outcomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "outcomeId" TEXT NOT NULL,
    "type" "OrderType" NOT NULL,
    "orderType" "OrderSubType" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "filledQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remainingQuantity" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trades" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "outcomeId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "buyOrderId" TEXT NOT NULL,
    "sellOrderId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "totalValue" DOUBLE PRECISION NOT NULL,
    "buyerFee" DOUBLE PRECISION NOT NULL,
    "sellerFee" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "outcomeId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "averagePrice" DOUBLE PRECISION NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL,
    "unrealizedPnL" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resolutions" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "evidence" TEXT,
    "status" "ResolutionStatus" NOT NULL DEFAULT 'PENDING',
    "disputeDeadline" TIMESTAMP(3),
    "resolvedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resolutions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_walletAddress_key" ON "users"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_walletAddress_idx" ON "users"("walletAddress");

-- CreateIndex
CREATE INDEX "users_isAdmin_idx" ON "users"("isAdmin");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");

-- CreateIndex
CREATE INDEX "users_totalVolume_idx" ON "users"("totalVolume");

-- CreateIndex
CREATE INDEX "users_winRate_idx" ON "users"("winRate");

-- CreateIndex
CREATE INDEX "markets_status_idx" ON "markets"("status");

-- CreateIndex
CREATE INDEX "markets_category_idx" ON "markets"("category");

-- CreateIndex
CREATE INDEX "markets_type_idx" ON "markets"("type");

-- CreateIndex
CREATE INDEX "markets_creatorId_idx" ON "markets"("creatorId");

-- CreateIndex
CREATE INDEX "markets_endDate_idx" ON "markets"("endDate");

-- CreateIndex
CREATE INDEX "markets_createdAt_idx" ON "markets"("createdAt");

-- CreateIndex
CREATE INDEX "markets_totalVolume_idx" ON "markets"("totalVolume");

-- CreateIndex
CREATE INDEX "markets_status_endDate_idx" ON "markets"("status", "endDate");

-- CreateIndex
CREATE INDEX "markets_category_status_idx" ON "markets"("category", "status");

-- CreateIndex
CREATE INDEX "markets_type_status_idx" ON "markets"("type", "status");

-- CreateIndex
CREATE INDEX "outcomes_marketId_idx" ON "outcomes"("marketId");

-- CreateIndex
CREATE INDEX "outcomes_currentPrice_idx" ON "outcomes"("currentPrice");

-- CreateIndex
CREATE INDEX "outcomes_marketId_currentPrice_idx" ON "outcomes"("marketId", "currentPrice");

-- CreateIndex
CREATE INDEX "orders_userId_idx" ON "orders"("userId");

-- CreateIndex
CREATE INDEX "orders_marketId_idx" ON "orders"("marketId");

-- CreateIndex
CREATE INDEX "orders_outcomeId_idx" ON "orders"("outcomeId");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_type_idx" ON "orders"("type");

-- CreateIndex
CREATE INDEX "orders_price_idx" ON "orders"("price");

-- CreateIndex
CREATE INDEX "orders_createdAt_idx" ON "orders"("createdAt");

-- CreateIndex
CREATE INDEX "orders_userId_status_idx" ON "orders"("userId", "status");

-- CreateIndex
CREATE INDEX "orders_marketId_outcomeId_status_idx" ON "orders"("marketId", "outcomeId", "status");

-- CreateIndex
CREATE INDEX "orders_marketId_type_status_idx" ON "orders"("marketId", "type", "status");

-- CreateIndex
CREATE INDEX "trades_marketId_idx" ON "trades"("marketId");

-- CreateIndex
CREATE INDEX "trades_outcomeId_idx" ON "trades"("outcomeId");

-- CreateIndex
CREATE INDEX "trades_buyerId_idx" ON "trades"("buyerId");

-- CreateIndex
CREATE INDEX "trades_sellerId_idx" ON "trades"("sellerId");

-- CreateIndex
CREATE INDEX "trades_createdAt_idx" ON "trades"("createdAt");

-- CreateIndex
CREATE INDEX "trades_marketId_createdAt_idx" ON "trades"("marketId", "createdAt");

-- CreateIndex
CREATE INDEX "trades_buyerId_createdAt_idx" ON "trades"("buyerId", "createdAt");

-- CreateIndex
CREATE INDEX "trades_sellerId_createdAt_idx" ON "trades"("sellerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "positions_userId_marketId_outcomeId_key" ON "positions"("userId", "marketId", "outcomeId");

-- CreateIndex
CREATE INDEX "positions_userId_idx" ON "positions"("userId");

-- CreateIndex
CREATE INDEX "positions_marketId_idx" ON "positions"("marketId");

-- CreateIndex
CREATE INDEX "positions_outcomeId_idx" ON "positions"("outcomeId");

-- CreateIndex
CREATE INDEX "positions_userId_marketId_idx" ON "positions"("userId", "marketId");

-- CreateIndex
CREATE INDEX "resolutions_marketId_idx" ON "resolutions"("marketId");

-- CreateIndex
CREATE INDEX "resolutions_status_idx" ON "resolutions"("status");

-- CreateIndex
CREATE INDEX "resolutions_resolvedBy_idx" ON "resolutions"("resolvedBy");

-- CreateIndex
CREATE INDEX "resolutions_createdAt_idx" ON "resolutions"("createdAt");

-- AddForeignKey
ALTER TABLE "markets" ADD CONSTRAINT "markets_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outcomes" ADD CONSTRAINT "outcomes_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "outcomes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "outcomes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_buyOrderId_fkey" FOREIGN KEY ("buyOrderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_sellOrderId_fkey" FOREIGN KEY ("sellOrderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "outcomes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resolutions" ADD CONSTRAINT "resolutions_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resolutions" ADD CONSTRAINT "resolutions_resolvedBy_fkey" FOREIGN KEY ("resolvedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add Check Constraints for Data Integrity
-- User constraints
ALTER TABLE "users" ADD CONSTRAINT "users_totalVolume_check" CHECK ("totalVolume" >= 0);
ALTER TABLE "users" ADD CONSTRAINT "users_totalTrades_check" CHECK ("totalTrades" >= 0);
ALTER TABLE "users" ADD CONSTRAINT "users_winRate_check" CHECK ("winRate" >= 0 AND "winRate" <= 1);

-- Market constraints
ALTER TABLE "markets" ADD CONSTRAINT "markets_totalVolume_check" CHECK ("totalVolume" >= 0);
ALTER TABLE "markets" ADD CONSTRAINT "markets_totalShares_check" CHECK ("totalShares" >= 0);

-- Outcome constraints (for binary markets, prices should be between 0 and 1)
ALTER TABLE "outcomes" ADD CONSTRAINT "outcomes_currentPrice_check" CHECK ("currentPrice" >= 0 AND "currentPrice" <= 1);
ALTER TABLE "outcomes" ADD CONSTRAINT "outcomes_totalShares_check" CHECK ("totalShares" >= 0);
ALTER TABLE "outcomes" ADD CONSTRAINT "outcomes_bestBid_check" CHECK ("bestBid" >= 0 AND "bestBid" <= 1);
ALTER TABLE "outcomes" ADD CONSTRAINT "outcomes_bestAsk_check" CHECK ("bestAsk" >= 0 AND "bestAsk" <= 1);
ALTER TABLE "outcomes" ADD CONSTRAINT "outcomes_spread_check" CHECK ("spread" >= 0);
ALTER TABLE "outcomes" ADD CONSTRAINT "outcomes_bid_ask_check" CHECK ("bestAsk" >= "bestBid");

-- Order constraints
ALTER TABLE "orders" ADD CONSTRAINT "orders_quantity_check" CHECK ("quantity" > 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_price_check" CHECK ("price" >= 0 AND "price" <= 1);
ALTER TABLE "orders" ADD CONSTRAINT "orders_filledQuantity_check" CHECK ("filledQuantity" >= 0 AND "filledQuantity" <= "quantity");
ALTER TABLE "orders" ADD CONSTRAINT "orders_remainingQuantity_check" CHECK ("remainingQuantity" >= 0 AND "remainingQuantity" <= "quantity");

-- Trade constraints
ALTER TABLE "trades" ADD CONSTRAINT "trades_quantity_check" CHECK ("quantity" > 0);
ALTER TABLE "trades" ADD CONSTRAINT "trades_price_check" CHECK ("price" >= 0 AND "price" <= 1);
ALTER TABLE "trades" ADD CONSTRAINT "trades_totalValue_check" CHECK ("totalValue" >= 0);
ALTER TABLE "trades" ADD CONSTRAINT "trades_buyerFee_check" CHECK ("buyerFee" >= 0);
ALTER TABLE "trades" ADD CONSTRAINT "trades_sellerFee_check" CHECK ("sellerFee" >= 0);

-- Position constraints
ALTER TABLE "positions" ADD CONSTRAINT "positions_averagePrice_check" CHECK ("averagePrice" >= 0 AND "averagePrice" <= 1);
ALTER TABLE "positions" ADD CONSTRAINT "positions_totalCost_check" CHECK ("totalCost" >= 0);
ALTER TABLE "positions" ADD CONSTRAINT "positions_currentValue_check" CHECK ("currentValue" >= 0);