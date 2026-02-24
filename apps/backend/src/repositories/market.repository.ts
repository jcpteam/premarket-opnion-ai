import { PrismaClient, Market, MarketStatus, MarketType } from '@prisma/client';
import { BaseRepository } from './base.repository';

export interface MarketFilters {
  status?: MarketStatus;
  type?: MarketType;
  category?: string;
  creatorId?: string;
  search?: string;
  tags?: string[];
}

export interface PaginationOptions {
  skip?: number;
  take?: number;
  orderBy?: any;
}

export interface IMarketRepository {
  findWithOutcomes(id: string): Promise<Market | null>;
  findByStatus(status: MarketStatus): Promise<Market[]>;
  search(query: string, options?: PaginationOptions): Promise<Market[]>;
  findByFilters(filters: MarketFilters, options?: PaginationOptions): Promise<Market[]>;
  updateVolume(marketId: string, volume: number): Promise<Market>;
  getActiveMarkets(): Promise<Market[]>;
  getMarketsReadyForResolution(): Promise<Market[]>;
}

/**
 * Market Repository
 * Handles all database operations for Market entity
 * 
 * Requirements: 8.1, 9.1
 */
export class MarketRepository extends BaseRepository<Market> implements IMarketRepository {
  constructor(prisma: PrismaClient) {
    super(prisma, 'market');
  }

  async findWithOutcomes(id: string): Promise<Market | null> {
    return this.prisma.market.findUnique({
      where: { id },
      include: {
        outcomes: true,
        creator: {
          select: {
            id: true,
            username: true,
            walletAddress: true
          }
        }
      }
    }) as any;
  }

  async findByStatus(status: MarketStatus): Promise<Market[]> {
    return this.prisma.market.findMany({
      where: { status },
      include: {
        outcomes: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    }) as any;
  }

  async search(query: string, options: PaginationOptions = {}): Promise<Market[]> {
    const { skip = 0, take = 20, orderBy = { createdAt: 'desc' } } = options;

    return this.prisma.market.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { category: { contains: query, mode: 'insensitive' } }
        ]
      },
      include: {
        outcomes: true
      },
      skip,
      take,
      orderBy
    }) as any;
  }

  async findByFilters(filters: MarketFilters, options: PaginationOptions = {}): Promise<Market[]> {
    const { skip = 0, take = 20, orderBy = { createdAt: 'desc' } } = options;
    
    const where: any = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.creatorId) {
      where.creatorId = filters.creatorId;
    }

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    if (filters.tags && filters.tags.length > 0) {
      where.tags = {
        hasSome: filters.tags
      };
    }

    return this.prisma.market.findMany({
      where,
      include: {
        outcomes: true,
        creator: {
          select: {
            id: true,
            username: true,
            walletAddress: true
          }
        }
      },
      skip,
      take,
      orderBy
    }) as any;
  }

  async updateVolume(marketId: string, volume: number): Promise<Market> {
    return this.prisma.market.update({
      where: { id: marketId },
      data: {
        totalVolume: { increment: volume },
        updatedAt: new Date()
      }
    });
  }

  async getActiveMarkets(): Promise<Market[]> {
    return this.prisma.market.findMany({
      where: {
        status: 'ACTIVE',
        endDate: {
          gt: new Date()
        }
      },
      include: {
        outcomes: true
      },
      orderBy: {
        totalVolume: 'desc'
      }
    }) as any;
  }

  async getMarketsReadyForResolution(): Promise<Market[]> {
    return this.prisma.market.findMany({
      where: {
        status: 'ACTIVE',
        endDate: {
          lte: new Date()
        }
      },
      include: {
        outcomes: true
      },
      orderBy: {
        endDate: 'asc'
      }
    }) as any;
  }
}
