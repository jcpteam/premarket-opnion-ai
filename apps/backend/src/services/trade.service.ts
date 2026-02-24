import { PrismaClient, Trade, Position } from '@prisma/client';
import { logger } from '../config/logger';
import { OrderBookService, TradeExecution } from './orderbook.service';

export interface ExecuteTradeRequest {
  marketId: string;
  outcomeId: string;
  buyerId: string;
  sellerId: string;
  buyOrderId: string;
  sellOrderId: string;
  quantity: number;
  price: number;
  totalValue: number;
  buyerFee: number;
  sellerFee: number;
}

export interface BalanceUpdate {
  userId: string;
  balanceChange: number;
  newBalance: number;
  reason: string;
}

export interface PositionUpdate {
  userId: string;
  marketId: string;
  outcomeId: string;
  quantityChange: number;
  newQuantity: number;
  newAveragePrice: number;
  newTotalCost: number;
  newCurrentValue: number;
  newUnrealizedPnL: number;
}

export interface TradeExecutionResult {
  trade: Trade;
  balanceUpdates: BalanceUpdate[];
  positionUpdates: PositionUpdate[];
  auditLog: AuditLogEntry[];
}

export interface AuditLogEntry {
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  details: Record<string, any>;
  timestamp: Date;
}

export interface UserBalance {
  userId: string;
  balance: number;
  lockedBalance: number;
  availableBalance: number;
}

/**
 * Trade Execution and Settlement Service
 * Handles atomic trade execution, balance updates, and position management
 * 
 * Requirements: 2.5, 7.5
 * - Execute trades with atomic operations
 * - Update trader balances and share holdings immediately
 * - Maintain trade history and audit logging
 * - Handle position tracking and P&L calculations
 */
export class TradeService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient, _orderBookService: OrderBookService) {
    this.prisma = prisma;
    // orderBookService stored for future use in integration
  }

  /**
   * Execute a trade with atomic operations
   * Updates balances, positions, and creates audit trail
   */
  async executeTrade(request: ExecuteTradeRequest): Promise<TradeExecutionResult> {
    try {
      // Validate trade request
      await this.validateTradeRequest(request);

      // Execute trade in transaction to ensure atomicity
      const result = await this.prisma.$transaction(async (tx) => {
        // Create trade record
        const trade = await tx.trade.create({
          data: {
            marketId: request.marketId,
            outcomeId: request.outcomeId,
            buyerId: request.buyerId,
            sellerId: request.sellerId,
            buyOrderId: request.buyOrderId,
            sellOrderId: request.sellOrderId,
            quantity: request.quantity,
            price: request.price,
            totalValue: request.totalValue,
            buyerFee: request.buyerFee,
            sellerFee: request.sellerFee
          }
        });

        // Update balances
        const balanceUpdates = await this.updateBalances(tx, request);

        // Update positions
        const positionUpdates = await this.updatePositions(tx, request);

        // Update market volume
        await this.updateMarketVolume(tx, request.marketId, request.totalValue);

        // Update user trading statistics
        await this.updateUserStats(tx, request.buyerId, request.sellerId, request.totalValue);

        // Create audit log entries
        const auditLog = this.createAuditLog(request, trade.id);

        return {
          trade,
          balanceUpdates,
          positionUpdates,
          auditLog
        };
      });

      logger.info('Trade executed successfully', {
        tradeId: result.trade.id,
        marketId: request.marketId,
        outcomeId: request.outcomeId,
        buyerId: request.buyerId,
        sellerId: request.sellerId,
        quantity: request.quantity,
        price: request.price,
        totalValue: request.totalValue
      });

      return result;

    } catch (error) {
      logger.error('Failed to execute trade', {
        request,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Execute multiple trades from order book matching
   */
  async executeTradesFromMatching(trades: TradeExecution[], marketId: string, outcomeId: string): Promise<TradeExecutionResult[]> {
    const results: TradeExecutionResult[] = [];

    try {
      for (const trade of trades) {
        const request: ExecuteTradeRequest = {
          marketId,
          outcomeId,
          buyerId: trade.buyerId,
          sellerId: trade.sellerId,
          buyOrderId: trade.buyOrderId,
          sellOrderId: trade.sellOrderId,
          quantity: trade.quantity,
          price: trade.price,
          totalValue: trade.totalValue,
          buyerFee: trade.buyerFee,
          sellerFee: trade.sellerFee
        };

        const result = await this.executeTrade(request);
        results.push(result);
      }

      logger.info('Multiple trades executed successfully', {
        marketId,
        outcomeId,
        tradesCount: trades.length,
        totalVolume: trades.reduce((sum, t) => sum + t.totalValue, 0)
      });

      return results;

    } catch (error) {
      logger.error('Failed to execute multiple trades', {
        marketId,
        outcomeId,
        tradesCount: trades.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get user's current balance
   */
  async getUserBalance(userId: string): Promise<UserBalance> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          // Note: Balance fields would need to be added to User model
          // For now, we'll calculate from positions and trades
        }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Calculate balance from trades and positions
      // This is a simplified implementation - in production, you'd have dedicated balance tables
      const balance = await this.calculateUserBalance(userId);

      return {
        userId,
        balance: balance.total,
        lockedBalance: balance.locked,
        availableBalance: balance.available
      };

    } catch (error) {
      logger.error('Failed to get user balance', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get user's positions
   */
  async getUserPositions(userId: string, marketId?: string): Promise<Position[]> {
    try {
      const where: any = { userId };
      if (marketId) {
        where.marketId = marketId;
      }

      const positions = await this.prisma.position.findMany({
        where,
        include: {
          market: {
            select: {
              id: true,
              title: true,
              status: true
            }
          },
          outcome: {
            select: {
              id: true,
              name: true,
              currentPrice: true
            }
          }
        },
        orderBy: {
          updatedAt: 'desc'
        }
      });

      return positions;

    } catch (error) {
      logger.error('Failed to get user positions', {
        userId,
        marketId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get trade history for a user
   */
  async getUserTradeHistory(
    userId: string,
    marketId?: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{
    trades: Trade[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const where: any = {
        OR: [
          { buyerId: userId },
          { sellerId: userId }
        ]
      };

      if (marketId) {
        where.marketId = marketId;
      }

      const skip = (page - 1) * limit;

      const [trades, total] = await Promise.all([
        this.prisma.trade.findMany({
          where,
          include: {
            market: {
              select: {
                id: true,
                title: true
              }
            },
            outcome: {
              select: {
                id: true,
                name: true
              }
            },
            buyer: {
              select: {
                id: true,
                walletAddress: true,
                username: true
              }
            },
            seller: {
              select: {
                id: true,
                walletAddress: true,
                username: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          skip,
          take: limit
        }),
        this.prisma.trade.count({ where })
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        trades,
        total,
        page,
        limit,
        totalPages
      };

    } catch (error) {
      logger.error('Failed to get user trade history', {
        userId,
        marketId,
        page,
        limit,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get market trade history
   */
  async getMarketTradeHistory(
    marketId: string,
    outcomeId?: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{
    trades: Trade[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const where: any = { marketId };
      if (outcomeId) {
        where.outcomeId = outcomeId;
      }

      const skip = (page - 1) * limit;

      const [trades, total] = await Promise.all([
        this.prisma.trade.findMany({
          where,
          include: {
            outcome: {
              select: {
                id: true,
                name: true
              }
            },
            buyer: {
              select: {
                id: true,
                walletAddress: true,
                username: true
              }
            },
            seller: {
              select: {
                id: true,
                walletAddress: true,
                username: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          skip,
          take: limit
        }),
        this.prisma.trade.count({ where })
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        trades,
        total,
        page,
        limit,
        totalPages
      };

    } catch (error) {
      logger.error('Failed to get market trade history', {
        marketId,
        outcomeId,
        page,
        limit,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Calculate profit and loss for a position
   */
  async calculatePositionPnL(userId: string, marketId: string, outcomeId: string): Promise<{
    realizedPnL: number;
    unrealizedPnL: number;
    totalPnL: number;
  }> {
    try {
      const position = await this.prisma.position.findUnique({
        where: {
          userId_marketId_outcomeId: {
            userId,
            marketId,
            outcomeId
          }
        },
        include: {
          outcome: {
            select: {
              currentPrice: true
            }
          }
        }
      });

      if (!position) {
        return {
          realizedPnL: 0,
          unrealizedPnL: 0,
          totalPnL: 0
        };
      }

      // Calculate unrealized P&L based on current market price
      const currentValue = position.quantity * position.outcome.currentPrice;
      const unrealizedPnL = currentValue - position.totalCost;

      // For this implementation, we'll assume no realized P&L tracking
      // In production, you'd track this separately when positions are closed
      const realizedPnL = 0;

      return {
        realizedPnL,
        unrealizedPnL,
        totalPnL: realizedPnL + unrealizedPnL
      };

    } catch (error) {
      logger.error('Failed to calculate position P&L', {
        userId,
        marketId,
        outcomeId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Validate trade request
   */
  private async validateTradeRequest(request: ExecuteTradeRequest): Promise<void> {
    // Validate required fields
    if (!request.marketId || !request.outcomeId) {
      throw new Error('Market ID and Outcome ID are required');
    }

    if (!request.buyerId || !request.sellerId) {
      throw new Error('Buyer ID and Seller ID are required');
    }

    if (!request.buyOrderId || !request.sellOrderId) {
      throw new Error('Buy Order ID and Sell Order ID are required');
    }

    if (request.quantity <= 0) {
      throw new Error('Quantity must be greater than 0');
    }

    if (request.price < 0 || request.price > 1) {
      throw new Error('Price must be between 0 and 1');
    }

    if (request.totalValue <= 0) {
      throw new Error('Total value must be greater than 0');
    }

    // Validate that users exist
    const [buyer, seller] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: request.buyerId } }),
      this.prisma.user.findUnique({ where: { id: request.sellerId } })
    ]);

    if (!buyer) {
      throw new Error('Buyer not found');
    }

    if (!seller) {
      throw new Error('Seller not found');
    }

    // Validate that market and outcome exist
    const outcome = await this.prisma.outcome.findUnique({
      where: { id: request.outcomeId },
      include: {
        market: {
          select: {
            id: true,
            status: true
          }
        }
      }
    });

    if (!outcome) {
      throw new Error('Outcome not found');
    }

    if (outcome.market.status !== 'ACTIVE') {
      throw new Error('Market is not active');
    }

    // Validate orders exist and are valid
    const [buyOrder, sellOrder] = await Promise.all([
      this.prisma.order.findUnique({ where: { id: request.buyOrderId } }),
      this.prisma.order.findUnique({ where: { id: request.sellOrderId } })
    ]);

    if (!buyOrder || !sellOrder) {
      throw new Error('Orders not found');
    }

    if (buyOrder.userId !== request.buyerId || sellOrder.userId !== request.sellerId) {
      throw new Error('Order ownership mismatch');
    }
  }

  /**
   * Update user balances after trade
   */
  private async updateBalances(_tx: any, request: ExecuteTradeRequest): Promise<BalanceUpdate[]> {
    const updates: BalanceUpdate[] = [];

    // Note: This is a simplified implementation
    // In production, you'd have dedicated balance tables and more complex logic

    // Buyer pays: total value + buyer fee
    const buyerCost = request.totalValue + request.buyerFee;
    
    // Seller receives: total value - seller fee
    const sellerRevenue = request.totalValue - request.sellerFee;

    // For now, we'll just log the balance changes
    // In production, you'd update actual balance tables
    updates.push({
      userId: request.buyerId,
      balanceChange: -buyerCost,
      newBalance: 0, // Would be calculated from actual balance
      reason: `Trade execution - bought ${request.quantity} shares at ${request.price}`
    });

    updates.push({
      userId: request.sellerId,
      balanceChange: sellerRevenue,
      newBalance: 0, // Would be calculated from actual balance
      reason: `Trade execution - sold ${request.quantity} shares at ${request.price}`
    });

    return updates;
  }

  /**
   * Update user positions after trade
   */
  private async updatePositions(tx: any, request: ExecuteTradeRequest): Promise<PositionUpdate[]> {
    const updates: PositionUpdate[] = [];

    // Update buyer's position (increase)
    const buyerPosition = await this.upsertPosition(
      tx,
      request.buyerId,
      request.marketId,
      request.outcomeId,
      request.quantity,
      request.price
    );

    updates.push({
      userId: request.buyerId,
      marketId: request.marketId,
      outcomeId: request.outcomeId,
      quantityChange: request.quantity,
      newQuantity: buyerPosition.quantity,
      newAveragePrice: buyerPosition.averagePrice,
      newTotalCost: buyerPosition.totalCost,
      newCurrentValue: buyerPosition.currentValue,
      newUnrealizedPnL: buyerPosition.unrealizedPnL
    });

    // Update seller's position (decrease)
    const sellerPosition = await this.upsertPosition(
      tx,
      request.sellerId,
      request.marketId,
      request.outcomeId,
      -request.quantity,
      request.price
    );

    updates.push({
      userId: request.sellerId,
      marketId: request.marketId,
      outcomeId: request.outcomeId,
      quantityChange: -request.quantity,
      newQuantity: sellerPosition.quantity,
      newAveragePrice: sellerPosition.averagePrice,
      newTotalCost: sellerPosition.totalCost,
      newCurrentValue: sellerPosition.currentValue,
      newUnrealizedPnL: sellerPosition.unrealizedPnL
    });

    return updates;
  }

  /**
   * Upsert user position
   */
  private async upsertPosition(
    tx: any,
    userId: string,
    marketId: string,
    outcomeId: string,
    quantityChange: number,
    price: number
  ): Promise<Position> {
    const existingPosition = await tx.position.findUnique({
      where: {
        userId_marketId_outcomeId: {
          userId,
          marketId,
          outcomeId
        }
      }
    });

    if (existingPosition) {
      // Update existing position
      const newQuantity = existingPosition.quantity + quantityChange;
      
      let newAveragePrice = existingPosition.averagePrice;
      let newTotalCost = existingPosition.totalCost;

      if (quantityChange > 0) {
        // Buying more shares - update average price
        const additionalCost = quantityChange * price;
        newTotalCost = existingPosition.totalCost + additionalCost;
        newAveragePrice = newQuantity > 0 ? newTotalCost / newQuantity : 0;
      } else {
        // Selling shares - reduce total cost proportionally
        const costReduction = Math.abs(quantityChange) * existingPosition.averagePrice;
        newTotalCost = Math.max(0, existingPosition.totalCost - costReduction);
        newAveragePrice = newQuantity > 0 ? newTotalCost / newQuantity : 0;
      }

      // Get current market price for unrealized P&L calculation
      const outcome = await tx.outcome.findUnique({
        where: { id: outcomeId },
        select: { currentPrice: true }
      });

      const currentValue = newQuantity * outcome.currentPrice;
      const unrealizedPnL = currentValue - newTotalCost;

      return await tx.position.update({
        where: {
          userId_marketId_outcomeId: {
            userId,
            marketId,
            outcomeId
          }
        },
        data: {
          quantity: newQuantity,
          averagePrice: newAveragePrice,
          totalCost: newTotalCost,
          currentValue,
          unrealizedPnL,
          updatedAt: new Date()
        }
      });
    } else {
      // Create new position - only for positive quantities (buying)
      if (quantityChange <= 0) {
        // For selling without existing position, create a short position
        // In a real prediction market, this might not be allowed or handled differently
        const totalCost = Math.abs(quantityChange) * price;
        
        // Get current market price
        const outcome = await tx.outcome.findUnique({
          where: { id: outcomeId },
          select: { currentPrice: true }
        });

        const currentValue = quantityChange * outcome.currentPrice;
        const unrealizedPnL = currentValue + totalCost; // For short positions

        return await tx.position.create({
          data: {
            userId,
            marketId,
            outcomeId,
            quantity: quantityChange, // Negative for short position
            averagePrice: price,
            totalCost: -totalCost, // Negative cost for short position
            currentValue,
            unrealizedPnL
          }
        });
      }

      const totalCost = quantityChange * price;
      
      // Get current market price
      const outcome = await tx.outcome.findUnique({
        where: { id: outcomeId },
        select: { currentPrice: true }
      });

      const currentValue = quantityChange * outcome.currentPrice;
      const unrealizedPnL = currentValue - totalCost;

      return await tx.position.create({
        data: {
          userId,
          marketId,
          outcomeId,
          quantity: quantityChange,
          averagePrice: price,
          totalCost,
          currentValue,
          unrealizedPnL
        }
      });
    }
  }

  /**
   * Update market volume
   */
  private async updateMarketVolume(tx: any, marketId: string, tradeValue: number): Promise<void> {
    await tx.market.update({
      where: { id: marketId },
      data: {
        totalVolume: {
          increment: tradeValue
        },
        updatedAt: new Date()
      }
    });
  }

  /**
   * Update user trading statistics
   */
  private async updateUserStats(tx: any, buyerId: string, sellerId: string, tradeValue: number): Promise<void> {
    // Update buyer stats
    await tx.user.update({
      where: { id: buyerId },
      data: {
        totalVolume: {
          increment: tradeValue
        },
        totalTrades: {
          increment: 1
        },
        updatedAt: new Date()
      }
    });

    // Update seller stats
    await tx.user.update({
      where: { id: sellerId },
      data: {
        totalVolume: {
          increment: tradeValue
        },
        totalTrades: {
          increment: 1
        },
        updatedAt: new Date()
      }
    });
  }

  /**
   * Create audit log entries
   */
  private createAuditLog(request: ExecuteTradeRequest, tradeId: string): AuditLogEntry[] {
    const timestamp = new Date();
    
    return [
      {
        action: 'TRADE_EXECUTED',
        entityType: 'TRADE',
        entityId: tradeId,
        userId: request.buyerId,
        details: {
          role: 'buyer',
          marketId: request.marketId,
          outcomeId: request.outcomeId,
          quantity: request.quantity,
          price: request.price,
          totalValue: request.totalValue,
          fee: request.buyerFee
        },
        timestamp
      },
      {
        action: 'TRADE_EXECUTED',
        entityType: 'TRADE',
        entityId: tradeId,
        userId: request.sellerId,
        details: {
          role: 'seller',
          marketId: request.marketId,
          outcomeId: request.outcomeId,
          quantity: request.quantity,
          price: request.price,
          totalValue: request.totalValue,
          fee: request.sellerFee
        },
        timestamp
      }
    ];
  }

  /**
   * Calculate user balance (simplified implementation)
   */
  private async calculateUserBalance(_userId: string): Promise<{
    total: number;
    locked: number;
    available: number;
  }> {
    // This is a simplified implementation
    // In production, you'd have dedicated balance tables
    
    // For now, return default values
    return {
      total: 1000, // Default balance
      locked: 0,
      available: 1000
    };
  }
}