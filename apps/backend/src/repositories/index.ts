import { PrismaClient } from '@prisma/client';
import { UserRepository } from './user.repository';
import { MarketRepository } from './market.repository';
import { OrderRepository } from './order.repository';
import { TradeRepository } from './trade.repository';
import { PositionRepository } from './position.repository';

/**
 * Repository Factory
 * Creates and manages repository instances with connection pooling
 * 
 * Requirements: 8.1, 9.1
 */
export class RepositoryFactory {
  private static instance: RepositoryFactory;
  private prisma: PrismaClient;
  private repositories: Map<string, any>;

  private constructor() {
    const databaseUrl = process.env.DATABASE_URL;
    
    this.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      ...(databaseUrl && {
        datasources: {
          db: {
            url: databaseUrl
          }
        }
      })
    });
    this.repositories = new Map();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): RepositoryFactory {
    if (!RepositoryFactory.instance) {
      RepositoryFactory.instance = new RepositoryFactory();
    }
    return RepositoryFactory.instance;
  }

  /**
   * Get Prisma client instance
   */
  public getPrisma(): PrismaClient {
    return this.prisma;
  }

  /**
   * Get User Repository
   */
  public getUserRepository(): UserRepository {
    if (!this.repositories.has('user')) {
      this.repositories.set('user', new UserRepository(this.prisma));
    }
    return this.repositories.get('user');
  }

  /**
   * Get Market Repository
   */
  public getMarketRepository(): MarketRepository {
    if (!this.repositories.has('market')) {
      this.repositories.set('market', new MarketRepository(this.prisma));
    }
    return this.repositories.get('market');
  }

  /**
   * Get Order Repository
   */
  public getOrderRepository(): OrderRepository {
    if (!this.repositories.has('order')) {
      this.repositories.set('order', new OrderRepository(this.prisma));
    }
    return this.repositories.get('order');
  }

  /**
   * Get Trade Repository
   */
  public getTradeRepository(): TradeRepository {
    if (!this.repositories.has('trade')) {
      this.repositories.set('trade', new TradeRepository(this.prisma));
    }
    return this.repositories.get('trade');
  }

  /**
   * Get Position Repository
   */
  public getPositionRepository(): PositionRepository {
    if (!this.repositories.has('position')) {
      this.repositories.set('position', new PositionRepository(this.prisma));
    }
    return this.repositories.get('position');
  }

  /**
   * Disconnect from database
   */
  public async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }

  /**
   * Connect to database
   */
  public async connect(): Promise<void> {
    await this.prisma.$connect();
  }
}

// Export repositories
export { UserRepository } from './user.repository';
export { MarketRepository } from './market.repository';
export { OrderRepository } from './order.repository';
export { TradeRepository } from './trade.repository';
export { PositionRepository } from './position.repository';
export { BaseRepository, IBaseRepository } from './base.repository';
