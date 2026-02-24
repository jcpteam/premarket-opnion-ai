import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';
import { WebSocketService } from './websocket.service';

export interface ResolveMarketRequest {
  marketId: string;
  winningOutcomeId: string;
  evidence?: string;
  resolutionSource?: string;
  resolvedBy: string;
}

export interface DisputeResolutionRequest {
  resolutionId: string;
  disputedBy: string;
  reason: string;
  evidence?: string;
}

export interface PayoutCalculation {
  userId: string;
  positionId: string;
  shares: number;
  averagePrice: number;
  payout: number;
  profit: number;
}

export interface ResolutionResult {
  resolution: any;
  payouts: PayoutCalculation[];
  totalPayout: number;
  affectedUsers: number;
}

/**
 * Resolution Service
 * Handles market resolution, payout calculation, and dispute management
 * 
 * Requirements: 4.1, 4.2, 4.4, 4.5
 * - Mark markets as ready for resolution when end date is reached
 * - Distribute winnings to holders of winning shares
 * - Calculate and transfer payouts
 * - Provide dispute resolution mechanism
 * - Make resolutions permanent and immutable
 */
export class ResolutionService {
  private prisma: PrismaClient;
  private webSocketService: WebSocketService | undefined;
  private readonly DISPUTE_PERIOD_HOURS = 24;

  constructor(prisma: PrismaClient, webSocketService?: WebSocketService) {
    this.prisma = prisma;
    this.webSocketService = webSocketService;
  }

  /**
   * Mark markets as ready for resolution when end date is reached
   */
  async markMarketsReadyForResolution(): Promise<string[]> {
    try {
      const now = new Date();
      
      // Find active markets that have passed their end date
      const expiredMarkets = await this.prisma.market.findMany({
        where: {
          status: 'ACTIVE',
          endDate: { lte: now }
        }
      });

      const updatedMarketIds: string[] = [];

      for (const market of expiredMarkets) {
        await this.prisma.market.update({
          where: { id: market.id },
          data: { status: 'CLOSED' }
        });

        updatedMarketIds.push(market.id);

        // Broadcast market status change
        if (this.webSocketService) {
          this.webSocketService.broadcastMarketStatusChange(market.id, {
            previousStatus: 'ACTIVE',
            newStatus: 'CLOSED',
            reason: 'Market end date reached',
            timestamp: new Date().toISOString()
          });
        }

        logger.info('Market marked ready for resolution', {
          marketId: market.id,
          endDate: market.endDate,
          service: 'prediction-market-api',
          timestamp: new Date().toISOString()
        });
      }

      return updatedMarketIds;
    } catch (error) {
      logger.error('Failed to mark markets ready for resolution', {
        error: error instanceof Error ? error.message : 'Unknown error',
        service: 'prediction-market-api',
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Resolve a market with a winning outcome
   */
  async resolveMarket(request: ResolveMarketRequest): Promise<ResolutionResult> {
    try {
      // Validate request
      this.validateResolveRequest(request);

      // Get market and verify it can be resolved
      const market = await this.prisma.market.findUnique({
        where: { id: request.marketId },
        include: { outcomes: true }
      });

      if (!market) {
        throw new Error('Market not found');
      }

      if (market.status === 'RESOLVED') {
        throw new Error('Market is already resolved');
      }

      if (market.status === 'ACTIVE') {
        throw new Error('Market must be closed before resolution');
      }

      // Verify winning outcome exists
      const winningOutcome = market.outcomes.find(o => o.id === request.winningOutcomeId);
      if (!winningOutcome) {
        throw new Error('Invalid winning outcome');
      }

      // Create resolution record
      const disputeDeadline = new Date();
      disputeDeadline.setHours(disputeDeadline.getHours() + this.DISPUTE_PERIOD_HOURS);

      const resolution = await this.prisma.resolution.create({
        data: {
          marketId: request.marketId,
          outcome: request.winningOutcomeId,
          evidence: request.evidence || null,
          status: 'PENDING',
          disputeDeadline,
          resolvedBy: request.resolvedBy
        }
      });

      // Update market status
      await this.prisma.market.update({
        where: { id: request.marketId },
        data: {
          status: 'RESOLVED',
          winningOutcome: request.winningOutcomeId,
          resolutionSource: request.resolutionSource || null,
          resolutionDate: new Date()
        }
      });

      // Calculate and process payouts
      const payouts = await this.calculatePayouts(request.marketId, request.winningOutcomeId);
      await this.processPayouts(payouts);

      const totalPayout = payouts.reduce((sum, p) => sum + p.payout, 0);
      const affectedUsers = new Set(payouts.map(p => p.userId)).size;

      // Broadcast resolution
      if (this.webSocketService) {
        this.webSocketService.broadcastMarketStatusChange(request.marketId, {
          previousStatus: 'CLOSED',
          newStatus: 'RESOLVED',
          winningOutcome: request.winningOutcomeId,
          resolvedBy: request.resolvedBy,
          disputeDeadline: disputeDeadline.toISOString(),
          timestamp: new Date().toISOString()
        });
      }

      logger.info('Market resolved successfully', {
        marketId: request.marketId,
        winningOutcome: request.winningOutcomeId,
        resolvedBy: request.resolvedBy,
        totalPayout,
        affectedUsers,
        service: 'prediction-market-api',
        timestamp: new Date().toISOString()
      });

      return {
        resolution,
        payouts,
        totalPayout,
        affectedUsers
      };
    } catch (error) {
      logger.error('Failed to resolve market', {
        request,
        error: error instanceof Error ? error.message : 'Unknown error',
        service: 'prediction-market-api',
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Calculate payouts for winning positions
   */
  private async calculatePayouts(marketId: string, winningOutcomeId: string): Promise<PayoutCalculation[]> {
    // Get all positions for the winning outcome
    const positions = await this.prisma.position.findMany({
      where: {
        marketId,
        outcomeId: winningOutcomeId,
        quantity: { gt: 0 }
      }
    });

    const payouts: PayoutCalculation[] = [];

    for (const position of positions) {
      // Each share pays out $1 (or equivalent)
      const payout = position.quantity * 1.0;
      const profit = payout - position.totalCost;

      payouts.push({
        userId: position.userId,
        positionId: position.id,
        shares: position.quantity,
        averagePrice: position.averagePrice,
        payout,
        profit
      });
    }

    return payouts;
  }

  /**
   * Process payouts to users
   */
  private async processPayouts(payouts: PayoutCalculation[]): Promise<void> {
    for (const payout of payouts) {
      // Update user profit/loss statistics
      await this.prisma.user.update({
        where: { id: payout.userId },
        data: {
          profitLoss: { increment: payout.profit }
        }
      });

      // Update position to reflect payout
      await this.prisma.position.update({
        where: { id: payout.positionId },
        data: {
          unrealizedPnL: payout.profit,
          updatedAt: new Date()
        }
      });

      logger.info('Payout processed', {
        userId: payout.userId,
        positionId: payout.positionId,
        payout: payout.payout,
        profit: payout.profit,
        service: 'prediction-market-api',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Dispute a market resolution
   */
  async disputeResolution(request: DisputeResolutionRequest): Promise<any> {
    try {
      // Get resolution
      const resolution = await this.prisma.resolution.findUnique({
        where: { id: request.resolutionId },
        include: { market: true }
      });

      if (!resolution) {
        throw new Error('Resolution not found');
      }

      if (resolution.status === 'RESOLVED') {
        throw new Error('Resolution is already finalized and cannot be disputed');
      }

      // Check if dispute period has expired
      if (resolution.disputeDeadline && new Date() > resolution.disputeDeadline) {
        throw new Error('Dispute period has expired');
      }

      // Update resolution status to disputed
      const updatedResolution = await this.prisma.resolution.update({
        where: { id: request.resolutionId },
        data: {
          status: 'DISPUTED'
        }
      });

      // Update market status back to closed for review
      await this.prisma.market.update({
        where: { id: resolution.marketId },
        data: {
          status: 'CLOSED'
        }
      });

      // Broadcast dispute
      if (this.webSocketService) {
        this.webSocketService.broadcastMarketStatusChange(resolution.marketId, {
          previousStatus: 'RESOLVED',
          newStatus: 'CLOSED',
          reason: 'Resolution disputed',
          disputedBy: request.disputedBy,
          disputeReason: request.reason,
          timestamp: new Date().toISOString()
        });
      }

      logger.info('Resolution disputed', {
        resolutionId: request.resolutionId,
        marketId: resolution.marketId,
        disputedBy: request.disputedBy,
        reason: request.reason,
        service: 'prediction-market-api',
        timestamp: new Date().toISOString()
      });

      return updatedResolution;
    } catch (error) {
      logger.error('Failed to dispute resolution', {
        request,
        error: error instanceof Error ? error.message : 'Unknown error',
        service: 'prediction-market-api',
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Finalize a resolution after dispute period
   */
  async finalizeResolution(resolutionId: string): Promise<any> {
    try {
      const resolution = await this.prisma.resolution.findUnique({
        where: { id: resolutionId }
      });

      if (!resolution) {
        throw new Error('Resolution not found');
      }

      if (resolution.status === 'RESOLVED') {
        throw new Error('Resolution is already finalized');
      }

      if (resolution.status === 'DISPUTED') {
        throw new Error('Resolution is disputed and cannot be finalized');
      }

      // Check if dispute period has passed
      if (resolution.disputeDeadline && new Date() < resolution.disputeDeadline) {
        throw new Error('Dispute period has not yet expired');
      }

      // Finalize resolution
      const finalizedResolution = await this.prisma.resolution.update({
        where: { id: resolutionId },
        data: {
          status: 'RESOLVED'
        }
      });

      logger.info('Resolution finalized', {
        resolutionId,
        marketId: resolution.marketId,
        service: 'prediction-market-api',
        timestamp: new Date().toISOString()
      });

      return finalizedResolution;
    } catch (error) {
      logger.error('Failed to finalize resolution', {
        resolutionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        service: 'prediction-market-api',
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Get resolution status for a market
   */
  async getResolutionStatus(marketId: string): Promise<any> {
    const resolution = await this.prisma.resolution.findFirst({
      where: { marketId },
      orderBy: { createdAt: 'desc' },
      include: {
        resolver: {
          select: {
            id: true,
            username: true,
            walletAddress: true
          }
        },
        market: {
          select: {
            id: true,
            title: true,
            status: true,
            winningOutcome: true
          }
        }
      }
    });

    return resolution;
  }

  /**
   * Get all pending resolutions
   */
  async getPendingResolutions(): Promise<any[]> {
    const resolutions = await this.prisma.resolution.findMany({
      where: {
        status: 'PENDING'
      },
      include: {
        market: {
          select: {
            id: true,
            title: true,
            endDate: true
          }
        },
        resolver: {
          select: {
            id: true,
            username: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return resolutions;
  }

  /**
   * Get disputed resolutions
   */
  async getDisputedResolutions(): Promise<any[]> {
    const resolutions = await this.prisma.resolution.findMany({
      where: {
        status: 'DISPUTED'
      },
      include: {
        market: {
          select: {
            id: true,
            title: true
          }
        },
        resolver: {
          select: {
            id: true,
            username: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return resolutions;
  }

  /**
   * Validate resolve request
   */
  private validateResolveRequest(request: ResolveMarketRequest): void {
    if (!request.marketId) {
      throw new Error('Market ID is required');
    }

    if (!request.winningOutcomeId) {
      throw new Error('Winning outcome ID is required');
    }

    if (!request.resolvedBy) {
      throw new Error('Resolver ID is required');
    }
  }

  /**
   * Auto-finalize resolutions after dispute period
   */
  async autoFinalizeResolutions(): Promise<number> {
    try {
      const now = new Date();
      
      // Find pending resolutions past dispute deadline
      const expiredResolutions = await this.prisma.resolution.findMany({
        where: {
          status: 'PENDING',
          disputeDeadline: { lte: now }
        }
      });

      let finalizedCount = 0;

      for (const resolution of expiredResolutions) {
        try {
          await this.finalizeResolution(resolution.id);
          finalizedCount++;
        } catch (error) {
          logger.error('Failed to auto-finalize resolution', {
            resolutionId: resolution.id,
            error: error instanceof Error ? error.message : 'Unknown error',
            service: 'prediction-market-api',
            timestamp: new Date().toISOString()
          });
        }
      }

      if (finalizedCount > 0) {
        logger.info('Auto-finalized resolutions', {
          count: finalizedCount,
          service: 'prediction-market-api',
          timestamp: new Date().toISOString()
        });
      }

      return finalizedCount;
    } catch (error) {
      logger.error('Failed to auto-finalize resolutions', {
        error: error instanceof Error ? error.message : 'Unknown error',
        service: 'prediction-market-api',
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }
}
