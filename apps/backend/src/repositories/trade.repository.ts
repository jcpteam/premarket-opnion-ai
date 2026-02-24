import { PrismaClient, Trade } from '@prisma/client';
import { BaseRepository } from './base.repository';

export interface TradeFilters {
  marketId?: string;
  outcomeId?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface ITradeRepository {
  findByUser(userId: string): Promise<Trade[]>;
  findByMarket(marketId: string, outcomeId?: string): Promise<Trade[]>;
  findRecent(limit: number): Promise<Trade[]>;
  getTradeHistory(filters: TradeFilters): Promise<Trade[]>;
  getTradeVolume(marketId: string, startDate?: Date): Promise<number>;
}

/**
 * Trade Repository
 * Handles all database operations for Trade entity
 * 
 * Requirements: 8.1, 9.1
 */
export class TradeRepository extends BaseRepository<Trade> implements ITradeRepository {
  constructor(prisma: PrismaClient) {
    super(prisma, 'trade');
  }

  async findByUser(userId: string): Promise<Trade[]> {
    return this.prisma.trade.findMany({
      where: {
        OR: [
          { buyerId: userId },
          { sellerId: userId }
        ]
      },
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
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    }) as any;
  }

  async findByMarket(marketId: string, outcomeId?: string): Promise<Trade[]> {
    const where: any = { marketId };
    
    if (outcomeId) {
      where.outcomeId = outcomeId;
    }

    return this.prisma.trade.findMany({
      where,
      include: {
        buyer: {
          select: {
            id: true,
            username: true,
            walletAddress: true
          }
        },
        seller: {
          select: {
            id: true,
            username: true,
            walletAddress: true
          }
        },
        outcome: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    }) as any;
  }

  async findRecent(limit: number = 50): Promise<Trade[]> {
    return this.prisma.trade.findMany({
      take: limit,
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
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    }) as any;
  }

  async getTradeHistory(filters: TradeFilters): Promise<Trade[]> {
    const where: any = {};

    if (filters.marketId) {
      where.marketId = filters.marketId;
    }

    if (filters.outcomeId) {
      where.outcomeId = filters.outcomeId;
    }

    if (filters.userId) {
      where.OR = [
        { buyerId: filters.userId },
        { sellerId: filters.userId }
      ];
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    return this.prisma.trade.findMany({
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
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    }) as any;
  }

  async getTradeVolume(marketId: string, startDate?: Date): Promise<number> {
    const where: any = { marketId };

    if (startDate) {
      where.createdAt = {
        gte: startDate
      };
    }

    const result = await this.prisma.trade.aggregate({
      where,
      _sum: {
        totalValue: true
      }
    });

    return result._sum.totalValue || 0;
  }
}
