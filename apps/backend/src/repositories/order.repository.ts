import { PrismaClient, Order, OrderStatus } from '@prisma/client';
import { BaseRepository } from './base.repository';

export interface IOrderRepository {
  findByUser(userId: string, status?: OrderStatus): Promise<Order[]>;
  findByMarket(marketId: string, outcomeId?: string): Promise<Order[]>;
  findActiveOrders(marketId: string, outcomeId: string): Promise<Order[]>;
  updateOrderStatus(orderId: string, status: OrderStatus, filledQuantity?: number): Promise<Order>;
  cancelOrder(orderId: string): Promise<Order>;
}

/**
 * Order Repository
 * Handles all database operations for Order entity
 * 
 * Requirements: 8.1, 9.1
 */
export class OrderRepository extends BaseRepository<Order> implements IOrderRepository {
  constructor(prisma: PrismaClient) {
    super(prisma, 'order');
  }

  async findByUser(userId: string, status?: OrderStatus): Promise<Order[]> {
    const where: any = { userId };
    
    if (status) {
      where.status = status;
    }

    return this.prisma.order.findMany({
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
        createdAt: 'desc'
      }
    }) as any;
  }

  async findByMarket(marketId: string, outcomeId?: string): Promise<Order[]> {
    const where: any = { marketId };
    
    if (outcomeId) {
      where.outcomeId = outcomeId;
    }

    return this.prisma.order.findMany({
      where,
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
            name: true
          }
        }
      },
      orderBy: [
        { price: 'desc' },
        { createdAt: 'asc' }
      ]
    }) as any;
  }

  async findActiveOrders(marketId: string, outcomeId: string): Promise<Order[]> {
    return this.prisma.order.findMany({
      where: {
        marketId,
        outcomeId,
        status: {
          in: ['PENDING', 'PARTIAL']
        }
      },
      orderBy: [
        { price: 'desc' },
        { createdAt: 'asc' }
      ]
    });
  }

  async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    filledQuantity?: number
  ): Promise<Order> {
    const updateData: any = {
      status,
      updatedAt: new Date()
    };

    if (filledQuantity !== undefined) {
      const order = await this.findById(orderId);
      if (order) {
        updateData.filledQuantity = order.filledQuantity + filledQuantity;
        updateData.remainingQuantity = order.quantity - updateData.filledQuantity;
      }
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: updateData
    });
  }

  async cancelOrder(orderId: string): Promise<Order> {
    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        updatedAt: new Date()
      }
    });
  }
}
