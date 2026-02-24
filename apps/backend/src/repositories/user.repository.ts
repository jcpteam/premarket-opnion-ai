import { PrismaClient, User } from '@prisma/client';
import { BaseRepository } from './base.repository';

export interface IUserRepository {
  findByWalletAddress(walletAddress: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  updateTradingStats(userId: string, stats: {
    totalVolume?: number;
    totalTrades?: number;
    winRate?: number;
    profitLoss?: number;
  }): Promise<User>;
  getTopTraders(limit: number): Promise<User[]>;
}

/**
 * User Repository
 * Handles all database operations for User entity
 * 
 * Requirements: 8.1, 9.1
 */
export class UserRepository extends BaseRepository<User> implements IUserRepository {
  constructor(prisma: PrismaClient) {
    super(prisma, 'user');
  }

  async findByWalletAddress(walletAddress: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { walletAddress }
    });
  }

  async findByUsername(username: string): Promise<User | null> {
    if (!username) return null;
    
    return this.prisma.user.findUnique({
      where: { username }
    });
  }

  async updateTradingStats(userId: string, stats: {
    totalVolume?: number;
    totalTrades?: number;
    winRate?: number;
    profitLoss?: number;
  }): Promise<User> {
    const updateData: any = {
      updatedAt: new Date()
    };

    if (stats.totalVolume !== undefined) {
      updateData.totalVolume = { increment: stats.totalVolume };
    }
    if (stats.totalTrades !== undefined) {
      updateData.totalTrades = { increment: stats.totalTrades };
    }
    if (stats.winRate !== undefined) {
      updateData.winRate = stats.winRate;
    }
    if (stats.profitLoss !== undefined) {
      updateData.profitLoss = { increment: stats.profitLoss };
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: updateData
    });
  }

  async getTopTraders(limit: number = 10): Promise<User[]> {
    return this.prisma.user.findMany({
      orderBy: [
        { totalVolume: 'desc' },
        { winRate: 'desc' }
      ],
      take: limit
    });
  }
}
