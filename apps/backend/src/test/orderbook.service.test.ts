import { PrismaClient } from '@prisma/client';
import { OrderBookService, PlaceOrderRequest } from '../services/orderbook.service';

// Mock Prisma Client
const mockPrisma = {
  order: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  trade: {
    create: jest.fn(),
  },
  outcome: {
    update: jest.fn(),
  },
} as unknown as PrismaClient;

describe('OrderBookService', () => {
  let orderBookService: OrderBookService;
  const mockMarketId = 'market-1';
  const mockOutcomeId = 'outcome-1';
  const mockUserId1 = 'user-1';
  const mockUserId2 = 'user-2';

  beforeEach(() => {
    orderBookService = new OrderBookService(mockPrisma);
    jest.clearAllMocks();
  });

  describe('initializeOrderBook', () => {
    it('should initialize empty order book when no existing orders', async () => {
      (mockPrisma.order.findMany as jest.Mock).mockResolvedValue([]);

      await orderBookService.initializeOrderBook(mockMarketId, mockOutcomeId);

      const snapshot = orderBookService.getOrderBookSnapshot(mockMarketId, mockOutcomeId);
      
      expect(snapshot).toBeDefined();
      expect(snapshot!.marketId).toBe(mockMarketId);
      expect(snapshot!.outcomeId).toBe(mockOutcomeId);
      expect(snapshot!.bids).toEqual([]);
      expect(snapshot!.asks).toEqual([]);
      expect(snapshot!.bestBid).toBeNull();
      expect(snapshot!.bestAsk).toBeNull();
      expect(snapshot!.spread).toBeNull();
    });

    it('should initialize order book with existing orders', async () => {
      const existingOrders = [
        {
          id: 'order-1',
          userId: mockUserId1,
          marketId: mockMarketId,
          outcomeId: mockOutcomeId,
          type: 'BUY',
          orderType: 'LIMIT',
          quantity: 100,
          price: 0.6,
          remainingQuantity: 100,
          createdAt: new Date('2024-01-01T10:00:00Z')
        },
        {
          id: 'order-2',
          userId: mockUserId2,
          marketId: mockMarketId,
          outcomeId: mockOutcomeId,
          type: 'SELL',
          orderType: 'LIMIT',
          quantity: 50,
          price: 0.7,
          remainingQuantity: 50,
          createdAt: new Date('2024-01-01T10:01:00Z')
        }
      ];

      (mockPrisma.order.findMany as jest.Mock).mockResolvedValue(existingOrders);

      await orderBookService.initializeOrderBook(mockMarketId, mockOutcomeId);

      const snapshot = orderBookService.getOrderBookSnapshot(mockMarketId, mockOutcomeId);
      
      expect(snapshot).toBeDefined();
      expect(snapshot!.bids).toHaveLength(1);
      expect(snapshot!.asks).toHaveLength(1);
      expect(snapshot!.bestBid).toBe(0.6);
      expect(snapshot!.bestAsk).toBe(0.7);
      expect(snapshot!.spread).toBeCloseTo(0.1, 10);
    });
  });

  describe('placeOrder', () => {
    beforeEach(async () => {
      (mockPrisma.order.findMany as jest.Mock).mockResolvedValue([]);
      await orderBookService.initializeOrderBook(mockMarketId, mockOutcomeId);
    });

    it('should place limit buy order when no matching sell orders', async () => {
      const orderRequest: PlaceOrderRequest = {
        userId: mockUserId1,
        marketId: mockMarketId,
        outcomeId: mockOutcomeId,
        type: 'BUY',
        orderType: 'LIMIT',
        quantity: 100,
        price: 0.6
      };

      (mockPrisma.order.create as jest.Mock).mockResolvedValue({
        id: 'order-1',
        ...orderRequest
      });

      const result = await orderBookService.placeOrder(orderRequest);

      expect(result.trades).toHaveLength(0);
      expect(result.remainingOrder).toBeDefined();
      expect(result.remainingOrder!.quantity).toBe(100);
      expect(result.remainingOrder!.remainingQuantity).toBe(100);

      const snapshot = orderBookService.getOrderBookSnapshot(mockMarketId, mockOutcomeId);
      expect(snapshot!.bids).toHaveLength(1);
      expect(snapshot!.bestBid).toBe(0.6);
    });

    it('should place limit sell order when no matching buy orders', async () => {
      const orderRequest: PlaceOrderRequest = {
        userId: mockUserId1,
        marketId: mockMarketId,
        outcomeId: mockOutcomeId,
        type: 'SELL',
        orderType: 'LIMIT',
        quantity: 50,
        price: 0.7
      };

      (mockPrisma.order.create as jest.Mock).mockResolvedValue({
        id: 'order-1',
        ...orderRequest
      });

      const result = await orderBookService.placeOrder(orderRequest);

      expect(result.trades).toHaveLength(0);
      expect(result.remainingOrder).toBeDefined();

      const snapshot = orderBookService.getOrderBookSnapshot(mockMarketId, mockOutcomeId);
      expect(snapshot!.asks).toHaveLength(1);
      expect(snapshot!.bestAsk).toBe(0.7);
    });

    it('should match buy order with existing sell order', async () => {
      // First, place a sell order
      const sellOrderRequest: PlaceOrderRequest = {
        userId: mockUserId1,
        marketId: mockMarketId,
        outcomeId: mockOutcomeId,
        type: 'SELL',
        orderType: 'LIMIT',
        quantity: 50,
        price: 0.6
      };

      (mockPrisma.order.create as jest.Mock).mockResolvedValueOnce({
        id: 'sell-order-1',
        ...sellOrderRequest
      });

      await orderBookService.placeOrder(sellOrderRequest);

      // Now place a matching buy order
      const buyOrderRequest: PlaceOrderRequest = {
        userId: mockUserId2,
        marketId: mockMarketId,
        outcomeId: mockOutcomeId,
        type: 'BUY',
        orderType: 'LIMIT',
        quantity: 30,
        price: 0.6
      };

      (mockPrisma.order.create as jest.Mock).mockResolvedValueOnce({
        id: 'buy-order-1',
        ...buyOrderRequest
      });

      (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'sell-order-1',
        filledQuantity: 0,
        quantity: 50
      });

      const result = await orderBookService.placeOrder(buyOrderRequest);

      expect(result.trades).toHaveLength(1);
      expect(result.trades[0].quantity).toBe(30);
      expect(result.trades[0].price).toBe(0.6);
      expect(result.trades[0].buyerId).toBe(mockUserId2);
      expect(result.trades[0].sellerId).toBe(mockUserId1);
      expect(result.remainingOrder).toBeUndefined(); // Fully filled
    });

    it('should partially match buy order with existing sell order', async () => {
      // First, place a sell order
      const sellOrderRequest: PlaceOrderRequest = {
        userId: mockUserId1,
        marketId: mockMarketId,
        outcomeId: mockOutcomeId,
        type: 'SELL',
        orderType: 'LIMIT',
        quantity: 30,
        price: 0.6
      };

      (mockPrisma.order.create as jest.Mock).mockResolvedValueOnce({
        id: 'sell-order-1',
        ...sellOrderRequest
      });

      await orderBookService.placeOrder(sellOrderRequest);

      // Now place a larger buy order
      const buyOrderRequest: PlaceOrderRequest = {
        userId: mockUserId2,
        marketId: mockMarketId,
        outcomeId: mockOutcomeId,
        type: 'BUY',
        orderType: 'LIMIT',
        quantity: 50,
        price: 0.6
      };

      (mockPrisma.order.create as jest.Mock).mockResolvedValueOnce({
        id: 'buy-order-1',
        ...buyOrderRequest
      });

      (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'sell-order-1',
        filledQuantity: 0,
        quantity: 30
      });

      const result = await orderBookService.placeOrder(buyOrderRequest);

      expect(result.trades).toHaveLength(1);
      expect(result.trades[0].quantity).toBe(30);
      expect(result.remainingOrder).toBeDefined();
      expect(result.remainingOrder!.remainingQuantity).toBe(20);
    });

    it('should handle market buy order', async () => {
      // First, place a sell order
      const sellOrderRequest: PlaceOrderRequest = {
        userId: mockUserId1,
        marketId: mockMarketId,
        outcomeId: mockOutcomeId,
        type: 'SELL',
        orderType: 'LIMIT',
        quantity: 50,
        price: 0.7
      };

      (mockPrisma.order.create as jest.Mock).mockResolvedValueOnce({
        id: 'sell-order-1',
        ...sellOrderRequest
      });

      await orderBookService.placeOrder(sellOrderRequest);

      // Now place a market buy order
      const marketBuyRequest: PlaceOrderRequest = {
        userId: mockUserId2,
        marketId: mockMarketId,
        outcomeId: mockOutcomeId,
        type: 'BUY',
        orderType: 'MARKET',
        quantity: 30
      };

      (mockPrisma.order.create as jest.Mock).mockResolvedValueOnce({
        id: 'buy-order-1',
        ...marketBuyRequest,
        price: 0.7
      });

      (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'sell-order-1',
        filledQuantity: 0,
        quantity: 50
      });

      const result = await orderBookService.placeOrder(marketBuyRequest);

      expect(result.trades).toHaveLength(1);
      expect(result.trades[0].price).toBe(0.7); // Market order takes best ask price
      expect(result.trades[0].quantity).toBe(30);
    });

    it('should validate order request parameters', async () => {
      const invalidRequests = [
        {
          // Missing userId
          marketId: mockMarketId,
          outcomeId: mockOutcomeId,
          type: 'BUY' as const,
          orderType: 'LIMIT' as const,
          quantity: 100,
          price: 0.6
        },
        {
          userId: mockUserId1,
          marketId: mockMarketId,
          outcomeId: mockOutcomeId,
          type: 'INVALID' as any,
          orderType: 'LIMIT' as const,
          quantity: 100,
          price: 0.6
        },
        {
          userId: mockUserId1,
          marketId: mockMarketId,
          outcomeId: mockOutcomeId,
          type: 'BUY' as const,
          orderType: 'LIMIT' as const,
          quantity: 0, // Invalid quantity
          price: 0.6
        },
        {
          userId: mockUserId1,
          marketId: mockMarketId,
          outcomeId: mockOutcomeId,
          type: 'BUY' as const,
          orderType: 'LIMIT' as const,
          quantity: 100,
          price: 1.5 // Invalid price
        }
      ];

      for (const request of invalidRequests) {
        await expect(orderBookService.placeOrder(request as any)).rejects.toThrow();
      }
    });
  });

  describe('cancelOrder', () => {
    beforeEach(async () => {
      (mockPrisma.order.findMany as jest.Mock).mockResolvedValue([]);
      await orderBookService.initializeOrderBook(mockMarketId, mockOutcomeId);
    });

    it('should cancel pending order successfully', async () => {
      const orderRequest: PlaceOrderRequest = {
        userId: mockUserId1,
        marketId: mockMarketId,
        outcomeId: mockOutcomeId,
        type: 'BUY',
        orderType: 'LIMIT',
        quantity: 100,
        price: 0.6
      };

      (mockPrisma.order.create as jest.Mock).mockResolvedValue({
        id: 'order-1',
        ...orderRequest
      });

      await orderBookService.placeOrder(orderRequest);

      (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-1',
        userId: mockUserId1,
        marketId: mockMarketId,
        outcomeId: mockOutcomeId,
        status: 'PENDING'
      });

      const result = await orderBookService.cancelOrder('order-1', mockUserId1);

      expect(result).toBe(true);
      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: {
          status: 'CANCELLED',
          updatedAt: expect.any(Date)
        }
      });
    });

    it('should reject cancellation by unauthorized user', async () => {
      (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-1',
        userId: mockUserId1,
        marketId: mockMarketId,
        outcomeId: mockOutcomeId,
        status: 'PENDING'
      });

      await expect(
        orderBookService.cancelOrder('order-1', mockUserId2)
      ).rejects.toThrow('Unauthorized to cancel this order');
    });

    it('should reject cancellation of filled order', async () => {
      (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-1',
        userId: mockUserId1,
        marketId: mockMarketId,
        outcomeId: mockOutcomeId,
        status: 'FILLED'
      });

      await expect(
        orderBookService.cancelOrder('order-1', mockUserId1)
      ).rejects.toThrow('Order cannot be cancelled');
    });

    it('should reject cancellation of non-existent order', async () => {
      (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        orderBookService.cancelOrder('non-existent', mockUserId1)
      ).rejects.toThrow('Order not found');
    });
  });

  describe('getOrderBookDepth', () => {
    beforeEach(async () => {
      (mockPrisma.order.findMany as jest.Mock).mockResolvedValue([]);
      await orderBookService.initializeOrderBook(mockMarketId, mockOutcomeId);
    });

    it('should return empty depth for empty order book', () => {
      const depth = orderBookService.getOrderBookDepth(mockMarketId, mockOutcomeId);
      
      expect(depth.bids).toEqual([]);
      expect(depth.asks).toEqual([]);
    });

    it('should return order book depth with multiple price levels', async () => {
      // Place multiple orders at different price levels
      const orders = [
        {
          userId: mockUserId1,
          marketId: mockMarketId,
          outcomeId: mockOutcomeId,
          type: 'BUY' as const,
          orderType: 'LIMIT' as const,
          quantity: 100,
          price: 0.6
        },
        {
          userId: mockUserId1,
          marketId: mockMarketId,
          outcomeId: mockOutcomeId,
          type: 'BUY' as const,
          orderType: 'LIMIT' as const,
          quantity: 50,
          price: 0.55
        },
        {
          userId: mockUserId2,
          marketId: mockMarketId,
          outcomeId: mockOutcomeId,
          type: 'SELL' as const,
          orderType: 'LIMIT' as const,
          quantity: 75,
          price: 0.65
        }
      ];

      let orderId = 1;
      for (const order of orders) {
        (mockPrisma.order.create as jest.Mock).mockResolvedValueOnce({
          id: `order-${orderId++}`,
          ...order
        });
        await orderBookService.placeOrder(order);
      }

      const depth = orderBookService.getOrderBookDepth(mockMarketId, mockOutcomeId);
      
      expect(depth.bids).toHaveLength(2);
      expect(depth.asks).toHaveLength(1);
      expect(depth.bids[0].price).toBe(0.6); // Best bid first
      expect(depth.bids[1].price).toBe(0.55);
      expect(depth.asks[0].price).toBe(0.65);
    });

    it('should limit depth to specified number of levels', async () => {
      // Place multiple buy orders
      const orders = Array.from({ length: 15 }, (_, i) => ({
        userId: mockUserId1,
        marketId: mockMarketId,
        outcomeId: mockOutcomeId,
        type: 'BUY' as const,
        orderType: 'LIMIT' as const,
        quantity: 10,
        price: 0.5 - (i * 0.01) // Decreasing prices
      }));

      let orderId = 1;
      for (const order of orders) {
        (mockPrisma.order.create as jest.Mock).mockResolvedValueOnce({
          id: `order-${orderId++}`,
          ...order
        });
        await orderBookService.placeOrder(order);
      }

      const depth = orderBookService.getOrderBookDepth(mockMarketId, mockOutcomeId, 5);
      
      expect(depth.bids).toHaveLength(5);
    });
  });

  describe('price-time priority', () => {
    beforeEach(async () => {
      (mockPrisma.order.findMany as jest.Mock).mockResolvedValue([]);
      await orderBookService.initializeOrderBook(mockMarketId, mockOutcomeId);
    });

    it('should maintain price priority for buy orders', async () => {
      const orders = [
        { price: 0.55, userId: mockUserId1 },
        { price: 0.60, userId: mockUserId2 }, // Better price
        { price: 0.50, userId: mockUserId1 }
      ];

      let orderId = 1;
      for (const order of orders) {
        (mockPrisma.order.create as jest.Mock).mockResolvedValueOnce({
          id: `order-${orderId++}`,
          userId: order.userId,
          marketId: mockMarketId,
          outcomeId: mockOutcomeId,
          type: 'BUY',
          orderType: 'LIMIT',
          quantity: 100,
          price: order.price
        });

        await orderBookService.placeOrder({
          userId: order.userId,
          marketId: mockMarketId,
          outcomeId: mockOutcomeId,
          type: 'BUY',
          orderType: 'LIMIT',
          quantity: 100,
          price: order.price
        });
      }

      const snapshot = orderBookService.getOrderBookSnapshot(mockMarketId, mockOutcomeId);
      expect(snapshot!.bestBid).toBe(0.60); // Best price first
      expect(snapshot!.bids[0].price).toBe(0.60);
      expect(snapshot!.bids[1].price).toBe(0.55);
      expect(snapshot!.bids[2].price).toBe(0.50);
    });

    it('should maintain time priority within same price level', async () => {
      // Place orders at same price but different times
      const orders = [
        { userId: mockUserId1, expectedPosition: 1 }, // Second order
        { userId: mockUserId2, expectedPosition: 0 }, // First order (placed second, but we'll verify order)
        { userId: mockUserId1, expectedPosition: 2 }  // Third order
      ];

      let orderId = 1;
      for (const order of orders) {
        (mockPrisma.order.create as jest.Mock).mockResolvedValueOnce({
          id: `order-${orderId++}`,
          userId: order.userId,
          marketId: mockMarketId,
          outcomeId: mockOutcomeId,
          type: 'BUY',
          orderType: 'LIMIT',
          quantity: 100,
          price: 0.60
        });

        await orderBookService.placeOrder({
          userId: order.userId,
          marketId: mockMarketId,
          outcomeId: mockOutcomeId,
          type: 'BUY',
          orderType: 'LIMIT',
          quantity: 100,
          price: 0.60
        });
      }

      const snapshot = orderBookService.getOrderBookSnapshot(mockMarketId, mockOutcomeId);
      const priceLevel = snapshot!.bids[0];
      
      expect(priceLevel.orders).toHaveLength(3);
      // Orders should be in time priority (first placed, first in queue)
      expect(priceLevel.orders[0].userId).toBe(mockUserId1); // First order placed
      expect(priceLevel.orders[1].userId).toBe(mockUserId2); // Second order placed
      expect(priceLevel.orders[2].userId).toBe(mockUserId1); // Third order placed
    });
  });

  describe('trade execution and fees', () => {
    beforeEach(async () => {
      (mockPrisma.order.findMany as jest.Mock).mockResolvedValue([]);
      await orderBookService.initializeOrderBook(mockMarketId, mockOutcomeId);
    });

    it('should calculate correct trade fees', async () => {
      // Place sell order first
      (mockPrisma.order.create as jest.Mock).mockResolvedValueOnce({
        id: 'sell-order-1',
        userId: mockUserId1,
        marketId: mockMarketId,
        outcomeId: mockOutcomeId,
        type: 'SELL',
        orderType: 'LIMIT',
        quantity: 100,
        price: 0.60
      });

      await orderBookService.placeOrder({
        userId: mockUserId1,
        marketId: mockMarketId,
        outcomeId: mockOutcomeId,
        type: 'SELL',
        orderType: 'LIMIT',
        quantity: 100,
        price: 0.60
      });

      // Place matching buy order
      (mockPrisma.order.create as jest.Mock).mockResolvedValueOnce({
        id: 'buy-order-1',
        userId: mockUserId2,
        marketId: mockMarketId,
        outcomeId: mockOutcomeId,
        type: 'BUY',
        orderType: 'LIMIT',
        quantity: 50,
        price: 0.60
      });

      (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'sell-order-1',
        filledQuantity: 0,
        quantity: 100
      });

      const result = await orderBookService.placeOrder({
        userId: mockUserId2,
        marketId: mockMarketId,
        outcomeId: mockOutcomeId,
        type: 'BUY',
        orderType: 'LIMIT',
        quantity: 50,
        price: 0.60
      });

      expect(result.trades).toHaveLength(1);
      const trade = result.trades[0];
      
      expect(trade.totalValue).toBe(30); // 50 * 0.60
      expect(trade.buyerFee).toBe(0.06); // 30 * 0.002
      expect(trade.sellerFee).toBe(0.06); // 30 * 0.002
    });
  });
});