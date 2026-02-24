import { PrismaClient } from '@prisma/client';

/**
 * Base Repository Interface
 * Provides common CRUD operations for all repositories
 */
export interface IBaseRepository<T> {
  findById(id: string): Promise<T | null>;
  findMany(filter?: any): Promise<T[]>;
  create(data: any): Promise<T>;
  update(id: string, data: any): Promise<T>;
  delete(id: string): Promise<boolean>;
  count(filter?: any): Promise<number>;
}

/**
 * Base Repository Implementation
 * Abstract class providing common functionality for all repositories
 */
export abstract class BaseRepository<T> implements IBaseRepository<T> {
  protected prisma: PrismaClient;
  protected modelName: string;

  constructor(prisma: PrismaClient, modelName: string) {
    this.prisma = prisma;
    this.modelName = modelName;
  }

  protected getModel(): any {
    return (this.prisma as any)[this.modelName];
  }

  async findById(id: string): Promise<T | null> {
    return this.getModel().findUnique({
      where: { id }
    });
  }

  async findMany(filter: any = {}): Promise<T[]> {
    return this.getModel().findMany(filter);
  }

  async create(data: any): Promise<T> {
    return this.getModel().create({
      data
    });
  }

  async update(id: string, data: any): Promise<T> {
    return this.getModel().update({
      where: { id },
      data
    });
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.getModel().delete({
        where: { id }
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  async count(filter: any = {}): Promise<number> {
    return this.getModel().count(filter);
  }

  /**
   * Execute operations in a transaction
   */
  async transaction<R>(
    callback: (tx: Omit<PrismaClient, '$on' | '$connect' | '$disconnect' | '$use' | '$transaction' | '$extends'>) => Promise<R>
  ): Promise<R> {
    return this.prisma.$transaction(callback) as Promise<R>;
  }
}
