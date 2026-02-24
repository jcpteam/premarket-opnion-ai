import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';
import { WebSocketService } from './websocket.service';

export interface LiquidityPool {
  id: string;
  marketId: string;
  providerId: string;
  totalLiquidity: number;
  shares: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface LiquidityPosition {
  poolId: string;
  marketId: string;
  outcomeId: string;
  quantity: number;
  lockedValue: number;
}

export interface DepositRequest {
  userId: string;
  marketId: string;
  amount: number;
}

export interface WithdrawRequest {
  userId: string;
  marketId: string;
  poolId: string;
  shares?: number; // If not specified, withdraw all
}

export interface LiquidityStats {
  totalLiquidity: number;
  totalShares: number;
  sharePrice: number;
  feesCollected: number;
  apr: number;
}

export interface SpreadAdjustment {
  outcomeId: string;
  oldSpread: number;
  newSpread: number;
  volatility: number;
  reason: string;
}

/**
 * Liquidity Service
 * Implements automated market maker (AMM) functionality
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.5
 * - Create market maker positions across all outcomes when liquidity is deposited
 * - Collect trading fees for liquidity providers
 * - Calculate pool shares and transfer funds on withdrawal
 * - Maintain minimum liquidity levels
 * - Adjust spreads based on market volatility
 */
export class LiquidityService {
  private prisma: PrismaClient;
  private readonly MIN_LIQUIDITY = 100; // Minimum liquidity per market
  private readonly BASE_SPREAD = 0.02; // 2% base spread
  private readonly MAX_SPREAD = 0.10; // 10% maximum spread
  private readonly VOLATILITY_THRESHOLD = 0.05; // 5% volatility threshold
  private readonly FEE_RATE = 0.002; // 0.2% trading fee for LPs
  private liquidityPools: Map<string, Map<string, LiquidityPool>>; // marketId -> userId -> pool

  constructor(prisma: PrismaClient, webSocketService?: WebSocketService) {
    this.prisma = prisma;
    // WebSocket service available for future use
    if (webSocketService) {
      // Reserved for future real-time updates
    }
    this.liquidityPools = new Map();
  }

  /**
   * Deposit liquidity into a market
   * Creates market maker positions across all outcomes
   * Requirement 5.1
   */
  async depositLiquidity(request: DepositRequest): Promise<LiquidityPool> {
    try {
      // Validate request
      this.validateDepositRequest(request);

      // Get market and outcomes
      const market = await this.prisma.market.findUnique({
        where: { id: request.marketId },
        include: { outcomes: true }
      });

      if (!market) {
        throw new Error('Market not found');
      }

      if (market.status !== 'ACTIVE') {
        throw new Error('Cannot add liquidity to inactive market');
      }

      if (market.outcomes.length === 0) {
        throw new Error('Market has no outcomes');
      }

      // Calculate shares based on existing pool
      const existingPools = await this.getMarketPools(request.marketId);
      const totalExistingLiquidity = existingPools.reduce((sum, pool) => sum + pool.totalLiquidity, 0);
      const totalExistingShares = existingPools.reduce((sum, pool) => sum + pool.shares, 0);

      let shares: number;
      if (totalExistingLiquidity === 0) {
        // First deposit: shares = amount
        shares = request.amount;
      } else {
        // Subsequent deposits: shares proportional to existing pool
        shares = (request.amount / totalExistingLiquidity) * totalExistingShares;
      }

      // Create liquidity pool record
      await this.prisma.$transaction(async (tx) => {
        // Create pool
        await tx.$executeRaw`
          INSERT INTO liquidity_pools (id, market_id, provider_id, total_liquidity, shares, created_at, updated_at)
          VALUES (gen_random_uuid(), ${request.marketId}, ${request.userId}, ${request.amount}, ${shares}, NOW(), NOW())
          RETURNING *
        `;

        // Create positions for each outcome
        const outcomeCount = market.outcomes.length;
        const liquidityPerOutcome = request.amount / outcomeCount;

        for (const outcome of market.outcomes) {
          // Create or update position
          await tx.position.upsert({
            where: {
              userId_marketId_outcomeId: {
                userId: request.userId,
                marketId: request.marketId,
                outcomeId: outcome.id
              }
            },
            create: {
              userId: request.userId,
              marketId: request.marketId,
              outcomeId: outcome.id,
              quantity: liquidityPerOutcome / outcome.currentPrice,
              averagePrice: outcome.currentPrice,
              totalCost: liquidityPerOutcome,
              currentValue: liquidityPerOutcome,
              unrealizedPnL: 0
            },
            update: {
              quantity: {
                increment: liquidityPerOutcome / outcome.currentPrice
              },
              totalCost: {
                increment: liquidityPerOutcome
              },
              currentValue: {
                increment: liquidityPerOutcome
              },
              updatedAt: new Date()
            }
          });
        }

        // Transaction complete
      });

      // Cache pool
      if (!this.liquidityPools.has(request.marketId)) {
        this.liquidityPools.set(request.marketId, new Map());
      }
      
      const poolData: LiquidityPool = {
        id: 'generated-id', // Would come from database
        marketId: request.marketId,
        providerId: request.userId,
        totalLiquidity: request.amount,
        shares: shares,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.liquidityPools.get(request.marketId)!.set(request.userId, poolData);

      logger.info('Liquidity deposited', {
        userId: request.userId,
        marketId: request.marketId,
        amount: request.amount,
        shares,
        outcomeCount: market.outcomes.length
      });

      return poolData;

    } catch (error) {
      logger.error('Failed to deposit liquidity', {
        request,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Withdraw liquidity from a market
   * Calculates share of pool and transfers funds
   * Requirement 5.3
   */
  async withdrawLiquidity(request: WithdrawRequest): Promise<{
    amount: number;
    feesEarned: number;
    positions: LiquidityPosition[];
  }> {
    try {
      // Get pool
      const pools = await this.getMarketPools(request.marketId);
      const userPool = pools.find(p => p.providerId === request.userId);

      if (!userPool) {
        throw new Error('No liquidity pool found for user');
      }

      // Calculate withdrawal amount
      const sharesToWithdraw = request.shares || userPool.shares;
      
      if (sharesToWithdraw > userPool.shares) {
        throw new Error('Insufficient shares');
      }

      const totalMarketLiquidity = pools.reduce((sum, p) => sum + p.totalLiquidity, 0);
      const totalMarketShares = pools.reduce((sum, p) => sum + p.shares, 0);
      
      // Calculate current value of shares (includes fees earned)
      const shareValue = totalMarketLiquidity / totalMarketShares;
      const withdrawalAmount = sharesToWithdraw * shareValue;
      const feesEarned = withdrawalAmount - (userPool.totalLiquidity * (sharesToWithdraw / userPool.shares));

      // Get user positions
      const positions = await this.prisma.position.findMany({
        where: {
          userId: request.userId,
          marketId: request.marketId
        }
      });

      // Calculate positions to close
      const positionsToClose: LiquidityPosition[] = [];
      const withdrawalRatio = sharesToWithdraw / userPool.shares;

      await this.prisma.$transaction(async (tx) => {
        // Update or delete positions
        for (const position of positions) {
          const quantityToRemove = position.quantity * withdrawalRatio;
          const valueToRemove = position.currentValue * withdrawalRatio;

          positionsToClose.push({
            poolId: userPool.id,
            marketId: request.marketId,
            outcomeId: position.outcomeId,
            quantity: quantityToRemove,
            lockedValue: valueToRemove
          });

          if (withdrawalRatio >= 1) {
            // Remove entire position
            await tx.position.delete({
              where: { id: position.id }
            });
          } else {
            // Reduce position
            await tx.position.update({
              where: { id: position.id },
              data: {
                quantity: position.quantity - quantityToRemove,
                totalCost: position.totalCost - valueToRemove,
                currentValue: position.currentValue - valueToRemove,
                updatedAt: new Date()
              }
            });
          }
        }

        // Update pool
        if (withdrawalRatio >= 1) {
          // Remove entire pool
          await tx.$executeRaw`
            DELETE FROM liquidity_pools WHERE id = ${userPool.id}
          `;
        } else {
          // Reduce pool
          await tx.$executeRaw`
            UPDATE liquidity_pools 
            SET total_liquidity = ${userPool.totalLiquidity - withdrawalAmount},
                shares = ${userPool.shares - sharesToWithdraw},
                updated_at = NOW()
            WHERE id = ${userPool.id}
          `;
        }

        // Update user profit/loss
        await tx.user.update({
          where: { id: request.userId },
          data: {
            profitLoss: {
              increment: feesEarned
            }
          }
        });
      });

      // Update cache
      if (withdrawalRatio >= 1) {
        this.liquidityPools.get(request.marketId)?.delete(request.userId);
      } else {
        const cachedPool = this.liquidityPools.get(request.marketId)?.get(request.userId);
        if (cachedPool) {
          cachedPool.totalLiquidity -= withdrawalAmount;
          cachedPool.shares -= sharesToWithdraw;
          cachedPool.updatedAt = new Date();
        }
      }

      logger.info('Liquidity withdrawn', {
        userId: request.userId,
        marketId: request.marketId,
        amount: withdrawalAmount,
        feesEarned,
        sharesToWithdraw
      });

      return {
        amount: withdrawalAmount,
        feesEarned,
        positions: positionsToClose
      };

    } catch (error) {
      logger.error('Failed to withdraw liquidity', {
        request,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Collect trading fees for liquidity providers
   * Called after each trade execution
   * Requirement 5.2
   */
  async collectTradingFees(marketId: string, tradeValue: number): Promise<void> {
    try {
      const feeAmount = tradeValue * this.FEE_RATE;
      
      // Get all pools for this market
      const pools = await this.getMarketPools(marketId);
      
      if (pools.length === 0) {
        return; // No liquidity providers
      }

      const totalShares = pools.reduce((sum, pool) => sum + pool.shares, 0);

      // Distribute fees proportionally to pool shares
      await this.prisma.$transaction(async (tx) => {
        for (const pool of pools) {
          const poolFeeShare = (pool.shares / totalShares) * feeAmount;
          
          // Add fees to pool liquidity
          await tx.$executeRaw`
            UPDATE liquidity_pools 
            SET total_liquidity = total_liquidity + ${poolFeeShare},
                updated_at = NOW()
            WHERE id = ${pool.id}
          `;

          // Update cached pool
          const cachedPool = this.liquidityPools.get(marketId)?.get(pool.providerId);
          if (cachedPool) {
            cachedPool.totalLiquidity += poolFeeShare;
            cachedPool.updatedAt = new Date();
          }
        }
      });

      logger.info('Trading fees collected', {
        marketId,
        tradeValue,
        feeAmount,
        poolCount: pools.length
      });

    } catch (error) {
      logger.error('Failed to collect trading fees', {
        marketId,
        tradeValue,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Check and maintain minimum liquidity levels
   * Requirement 5.4
   */
  async checkMinimumLiquidity(marketId: string): Promise<{
    hasMinimumLiquidity: boolean;
    currentLiquidity: number;
    minimumRequired: number;
  }> {
    try {
      const pools = await this.getMarketPools(marketId);
      const totalLiquidity = pools.reduce((sum, pool) => sum + pool.totalLiquidity, 0);

      const hasMinimumLiquidity = totalLiquidity >= this.MIN_LIQUIDITY;

      if (!hasMinimumLiquidity) {
        logger.warn('Market below minimum liquidity', {
          marketId,
          currentLiquidity: totalLiquidity,
          minimumRequired: this.MIN_LIQUIDITY
        });
      }

      return {
        hasMinimumLiquidity,
        currentLiquidity: totalLiquidity,
        minimumRequired: this.MIN_LIQUIDITY
      };

    } catch (error) {
      logger.error('Failed to check minimum liquidity', {
        marketId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Adjust spreads based on market volatility
   * Requirement 5.5
   */
  async adjustSpreads(marketId: string): Promise<SpreadAdjustment[]> {
    try {
      const market = await this.prisma.market.findUnique({
        where: { id: marketId },
        include: { outcomes: true }
      });

      if (!market) {
        throw new Error('Market not found');
      }

      const adjustments: SpreadAdjustment[] = [];

      // Calculate volatility for each outcome
      for (const outcome of market.outcomes) {
        const volatility = await this.calculateVolatility(marketId, outcome.id);
        
        let newSpread = this.BASE_SPREAD;
        let reason = 'Normal market conditions';

        if (volatility > this.VOLATILITY_THRESHOLD) {
          // Increase spread to protect liquidity providers
          const volatilityMultiplier = 1 + (volatility / this.VOLATILITY_THRESHOLD);
          newSpread = Math.min(this.BASE_SPREAD * volatilityMultiplier, this.MAX_SPREAD);
          reason = `High volatility detected (${(volatility * 100).toFixed(2)}%)`;
        }

        // Check liquidity levels
        const liquidityCheck = await this.checkMinimumLiquidity(marketId);
        if (!liquidityCheck.hasMinimumLiquidity) {
          newSpread = Math.min(newSpread * 1.5, this.MAX_SPREAD);
          reason += '; Low liquidity';
        }

        const oldSpread = outcome.spread;

        // Update spread if changed significantly
        if (Math.abs(newSpread - oldSpread) > 0.001) {
          await this.prisma.outcome.update({
            where: { id: outcome.id },
            data: {
              spread: newSpread,
              updatedAt: new Date()
            }
          });

          adjustments.push({
            outcomeId: outcome.id,
            oldSpread,
            newSpread,
            volatility,
            reason
          });

          logger.info('Spread adjusted', {
            marketId,
            outcomeId: outcome.id,
            oldSpread,
            newSpread,
            volatility,
            reason
          });
        }
      }

      return adjustments;

    } catch (error) {
      logger.error('Failed to adjust spreads', {
        marketId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get liquidity statistics for a market
   */
  async getLiquidityStats(marketId: string): Promise<LiquidityStats> {
    try {
      const pools = await this.getMarketPools(marketId);
      
      const totalLiquidity = pools.reduce((sum, pool) => sum + pool.totalLiquidity, 0);
      const totalShares = pools.reduce((sum, pool) => sum + pool.shares, 0);
      const sharePrice = totalShares > 0 ? totalLiquidity / totalShares : 1;

      // Calculate fees collected (difference between current liquidity and initial deposits)
      const initialDeposits = pools.reduce((sum, pool) => {
        // Approximate initial deposit as current liquidity / share price * initial shares
        return sum + (pool.shares * 1); // Assuming initial share price was 1
      }, 0);
      
      const feesCollected = totalLiquidity - initialDeposits;

      // Calculate APR (simplified - would need time-based calculation in production)
      const apr = initialDeposits > 0 ? (feesCollected / initialDeposits) * 100 : 0;

      return {
        totalLiquidity,
        totalShares,
        sharePrice,
        feesCollected: Math.max(0, feesCollected),
        apr
      };

    } catch (error) {
      logger.error('Failed to get liquidity stats', {
        marketId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get user's liquidity positions
   */
  async getUserLiquidityPositions(userId: string): Promise<LiquidityPool[]> {
    try {
      const allPools: LiquidityPool[] = [];

      // Get pools from database
      const pools = await this.prisma.$queryRaw<any[]>`
        SELECT * FROM liquidity_pools WHERE provider_id = ${userId}
      `;

      for (const pool of pools) {
        allPools.push({
          id: pool.id,
          marketId: pool.market_id,
          providerId: pool.provider_id,
          totalLiquidity: pool.total_liquidity,
          shares: pool.shares,
          createdAt: pool.created_at,
          updatedAt: pool.updated_at
        });
      }

      return allPools;

    } catch (error) {
      logger.error('Failed to get user liquidity positions', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Calculate volatility for an outcome
   */
  private async calculateVolatility(marketId: string, outcomeId: string): Promise<number> {
    try {
      // Get recent trades (last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const trades = await this.prisma.trade.findMany({
        where: {
          marketId,
          outcomeId,
          createdAt: {
            gte: oneDayAgo
          }
        },
        orderBy: {
          createdAt: 'asc'
        }
      });

      if (trades.length < 2) {
        return 0; // Not enough data
      }

      // Calculate price changes
      const priceChanges: number[] = [];
      for (let i = 1; i < trades.length; i++) {
        const change = Math.abs(trades[i].price - trades[i - 1].price);
        priceChanges.push(change);
      }

      // Calculate average absolute price change (simple volatility measure)
      const avgChange = priceChanges.reduce((sum, change) => sum + change, 0) / priceChanges.length;

      return avgChange;

    } catch (error) {
      logger.error('Failed to calculate volatility', {
        marketId,
        outcomeId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return 0;
    }
  }

  /**
   * Get all liquidity pools for a market
   */
  private async getMarketPools(marketId: string): Promise<LiquidityPool[]> {
    try {
      const pools = await this.prisma.$queryRaw<any[]>`
        SELECT * FROM liquidity_pools WHERE market_id = ${marketId}
      `;

      return pools.map(pool => ({
        id: pool.id,
        marketId: pool.market_id,
        providerId: pool.provider_id,
        totalLiquidity: pool.total_liquidity,
        shares: pool.shares,
        createdAt: pool.created_at,
        updatedAt: pool.updated_at
      }));

    } catch (error) {
      logger.error('Failed to get market pools', {
        marketId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  /**
   * Validate deposit request
   */
  private validateDepositRequest(request: DepositRequest): void {
    if (!request.userId) {
      throw new Error('User ID is required');
    }

    if (!request.marketId) {
      throw new Error('Market ID is required');
    }

    if (!request.amount || request.amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    if (request.amount < this.MIN_LIQUIDITY) {
      throw new Error(`Minimum deposit is ${this.MIN_LIQUIDITY}`);
    }
  }
}
