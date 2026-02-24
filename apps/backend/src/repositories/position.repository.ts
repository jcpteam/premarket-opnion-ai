import { PrismaClient, Position } from '@prisma/client';
import { BaseRepository } from './base.repository';

export interface IPositionRepository {
  findByUser(userId: string): Promise<Position[]>;
  findByMarket(marketId: string): Promise<Position[]>;
  findUserPosition(userId: string, marketId: string, outcomeId: string): Promise<Position | null>;
  upsertPosition(data: {
    userId: string;
    marketId: string;
    outcomeId: string;
    quantity: number;
    averagePrice: number;
    totalCost: number;
  }): Promise<Position>;
  updatePositionValue(positionId: string, currentValue: number, unrealizedPnL: number): Promise<Position>;
}

/**
 * Position Repository
 * Handles all database operations for Position entity
 * 
 * Requirements: 8.1, 9.1
 */
export class PositionRepository extends BaseRepository<Position> implements IPositionRepository {
  constructor(prisma: PrismaClient) {
    super(prisma, 'position');
  }

  async findByUser(userId: string): Promise<Position[]> {
    return this.prisma.position.findMany({
      where: { userId },
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
    }) as any;
  }

  async findByMarket(marketId: string): Promise<Position[]> {
    return this.prisma.position.findMany({
      where: { marketId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            walletAddress: true
          }
        },
        outcome: {
          select: {
            id: true,
            name: true,
            currentPrice: true
          }
        }
      }
    }) as any;
  }

  async findUserPosition(
    userId: string,
    marketId: string,
    outcomeId: string
  ): Promise<Position | null> {
    return this.prisma.position.findUnique({
      where: {
        userId_marketId_outcomeId: {
          userId,
          marketId,
          outcomeId
        }
      }
    });
  }

  async upsertPosition(data: {
    userId: string;
    marketId: string;
    outcomeId: string;
    quantity: number;
    averagePrice: number;
    totalCost: number;
  }): Promise<Position> {
    const currentValue = data.quantity * data.averagePrice;
    const unrealizedPnL = currentValue - data.totalCost;

    return this.prisma.position.upsert({
      where: {
        userId_marketId_outcomeId: {
          userId: data.userId,
          marketId: data.marketId,
          outcomeId: data.outcomeId
        }
      },
      create: {
        userId: data.userId,
        marketId: data.marketId,
        outcomeId: data.outcomeId,
        quantity: data.quantity,
        averagePrice: data.averagePrice,
        totalCost: data.totalCost,
        currentValue,
        unrealizedPnL
      },
      update: {
        quantity: { increment: data.quantity },
        totalCost: { increment: data.totalCost },
        currentValue,
        unrealizedPnL,
        updatedAt: new Date()
      }
    });
  }

  async updatePositionValue(
    positionId: string,
    currentValue: number,
    unrealizedPnL: number
  ): Promise<Position> {
    return this.prisma.position.update({
      where: { id: positionId },
      data: {
        currentValue,
        unrealizedPnL,
        updatedAt: new Date()
      }
    });
  }
}
