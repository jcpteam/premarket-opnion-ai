import { PrismaClient } from '@prisma/client';
import { MarketDataService } from '../services/marketdata.service';
import { WebSocketService } from '../services/websocket.service';

// Mock dependencies
jest.mock('../config/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('MarketDataService', () => {
  let marketDataService: MarketDataService;
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockWebSocketService: jest.Mocked<WebSocketService>;

  beforeEach(() => {
    // Create mock Prisma client
    mockPrisma = {
      outcome: {
        findUnique: jest.fn()
      },
      trade: {
        aggregate: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn()
      },
      order: {
        findMany: jest.fn()
      },
      market: {
        findMany: jest.fn()
      }
    } as any;

    // Create mock WebSocket service
    mockWebSocketService = {
      broadcastPriceUpdate: jest.fn(),
      broadcastOrderBookUpdate: jest.fn(),
      broadcastTradeExecution: jest.fn()
    } as any;

    marketDataService = new MarketDataService(mockPrisma, mockWebSocketService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    marketDataService.stopRealTimeUpdates();
  });

  describe('getMarketDataSnapshot', () => {
    it('should return market data snapshot', async () => {
      const marketId = 'market-1';
      const outcomeId = 'outcome-1';

      (mockPrisma.outcome.findUnique as jest.Mock).mockResolvedValue({
        id: outcomeId,
        currentPrice: 0.65,
        bestBid: 0.64,
        bestAsk: 0.66,
        spread: 0.02
      });

      (mockPrisma.trade.aggregate as jest.Mock).mockResolvedValue({
        _sum: { totalValue: 10000 },
        _count: 50
      });

      (mockPrisma.trade.findFirst as jest.Mock).mockResolvedValue({
        price: 0.65,
        createdAt: new Date()
      });

      const snapshot = await marketDataService.getMarketDataSnapshot(marketId, outcomeId);

      expect(snapshot).toHaveProperty('marketId', marketId);
      expect(snapshot).toHaveProperty('outcomeId', outcomeId);
      expect(snapshot).toHaveProperty('currentPrice', 0.65);
      expect(snapshot).toHaveProperty('bestBid', 0.64);
      expect(snapshot).toHaveProperty('bestAsk', 0.66);
      expect(snapshot).toHaveProperty('spread', 0.02);
      expect(snapshot).toHaveProperty('volume24h', 10000);
      expect(snapshot).toHaveProperty('timestamp');
    });

    it('should use cached data if recent', async () => {
      const marketId = 'market-1';
      const outcomeId = 'outcome-1';

      (mockPrisma.outcome.findUnique as jest.Mock).mockResolvedValue({
        id: outcomeId,
        currentPrice: 0.65,
        bestBid: 0.64,
        bestAsk: 0.66,
        spread: 0.02
      });

      (mockPrisma.trade.aggregate as jest.Mock).mockResolvedValue({
        _sum: { totalValue: 10000 },
        _count: 50
      });

      (mockPrisma.trade.findFirst as jest.Mock).mockResolvedValue({
        price: 0.65,
        createdAt: new Date()
      });

      // First call
      const snapshot1 = await marketDataService.getMarketDataSnapshot(marketId, outcomeId);
      
      // Clear mock call count
      (mockPrisma.outcome.findUnique as jest.Mock).mockClear();
      
      // Second call should use cache
      const snapshot2 = await marketDataService.getMarketDataSnapshot(marketId, outcomeId);

      // Should not call database again
      expect(mockPrisma.outcome.findUnique).toHaveBeenCalledTimes(0);
      expect(snapshot1.currentPrice).toBe(snapshot2.currentPrice);
    });

    it('should throw error if outcome not found', async () => {
      (mockPrisma.outcome.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        marketDataService.getMarketDataSnapshot('market-1', 'invalid-outcome')
      ).rejects.toThrow('Outcome not found');
    });
  });

  describe('getOrderBookDepth', () => {
    it('should return order book depth with bid and ask levels', async () => {
      const marketId = 'market-1';
      const outcomeId = 'outcome-1';

      (mockPrisma.order.findMany as jest.Mock).mockResolvedValue([
        { type: 'BUY', price: 0.60, remainingQuantity: 100 },
        { type: 'BUY', price: 0.60, remainingQuantity: 50 },
        { type: 'BUY', price: 0.59, remainingQuantity: 75 },
        { type: 'SELL', price: 0.65, remainingQuantity: 80 },
        { type: 'SELL', price: 0.66, remainingQuantity: 60 }
      ]);

      const depth = await marketDataService.getOrderBookDepth(marketId, outcomeId);

      expect(depth.marketId).toBe(marketId);
      expect(depth.outcomeId).toBe(outcomeId);
      expect(depth.bids.length).toBeGreaterThan(0);
      expect(depth.asks.length).toBeGreaterThan(0);
      expect(depth.bids[0].price).toBeGreaterThanOrEqual(depth.bids[depth.bids.length - 1].price);
      expect(depth.asks[0].price).toBeLessThanOrEqual(depth.asks[depth.asks.length - 1].price);
      expect(depth.totalBidVolume).toBeGreaterThan(0);
      expect(depth.totalAskVolume).toBeGreaterThan(0);
    });

    it('should aggregate orders at same price level', async () => {
      const marketId = 'market-1';
      const outcomeId = 'outcome-1';

      (mockPrisma.order.findMany as jest.Mock).mockResolvedValue([
        { type: 'BUY', price: 0.60, remainingQuantity: 100 },
        { type: 'BUY', price: 0.60, remainingQuantity: 50 },
        { type: 'BUY', price: 0.60, remainingQuantity: 25 }
      ]);

      const depth = await marketDataService.getOrderBookDepth(marketId, outcomeId);

      expect(depth.bids.length).toBe(1);
      expect(depth.bids[0].price).toBe(0.60);
      expect(depth.bids[0].quantity).toBe(175);
      expect(depth.bids[0].orderCount).toBe(3);
    });

    it('should limit depth to specified levels', async () => {
      const marketId = 'market-1';
      const outcomeId = 'outcome-1';

      const orders = [];
      for (let i = 0; i < 20; i++) {
        orders.push({ type: 'BUY', price: 0.50 + i * 0.01, remainingQuantity: 10 });
      }

      (mockPrisma.order.findMany as jest.Mock).mockResolvedValue(orders);

      const depth = await marketDataService.getOrderBookDepth(marketId, outcomeId, 5);

      expect(depth.bids.length).toBeLessThanOrEqual(5);
    });
  });

  describe('streamOrderBookDepth', () => {
    it('should broadcast order book depth updates', async () => {
      const marketId = 'market-1';
      const outcomeId = 'outcome-1';

      (mockPrisma.order.findMany as jest.Mock).mockResolvedValue([
        { type: 'BUY', price: 0.60, remainingQuantity: 100 },
        { type: 'SELL', price: 0.65, remainingQuantity: 80 }
      ]);

      await marketDataService.streamOrderBookDepth(marketId, outcomeId);

      expect(mockWebSocketService.broadcastOrderBookUpdate).toHaveBeenCalledWith(
        marketId,
        outcomeId,
        expect.objectContaining({
          bids: expect.any(Array),
          asks: expect.any(Array),
          totalBidVolume: expect.any(Number),
          totalAskVolume: expect.any(Number),
          timestamp: expect.any(String)
        })
      );
    });
  });

  describe('broadcastTradeNotification', () => {
    it('should broadcast trade execution and update market data', async () => {
      const trade = {
        tradeId: 'trade-1',
        marketId: 'market-1',
        outcomeId: 'outcome-1',
        price: 0.65,
        quantity: 100,
        totalValue: 65,
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        timestamp: new Date()
      };

      (mockPrisma.outcome.findUnique as jest.Mock).mockResolvedValue({
        id: trade.outcomeId,
        currentPrice: 0.65,
        bestBid: 0.64,
        bestAsk: 0.66,
        spread: 0.02
      });

      (mockPrisma.trade.aggregate as jest.Mock).mockResolvedValue({
        _sum: { totalValue: 10000 },
        _count: 50
      });

      (mockPrisma.trade.findFirst as jest.Mock).mockResolvedValue({
        price: 0.65,
        createdAt: new Date()
      });

      (mockPrisma.order.findMany as jest.Mock).mockResolvedValue([]);

      await marketDataService.broadcastTradeNotification(trade);

      expect(mockWebSocketService.broadcastTradeExecution).toHaveBeenCalledWith(
        trade.marketId,
        trade.outcomeId,
        expect.objectContaining({
          tradeId: trade.tradeId,
          price: trade.price,
          quantity: trade.quantity
        })
      );

      expect(mockWebSocketService.broadcastPriceUpdate).toHaveBeenCalled();
      expect(mockWebSocketService.broadcastOrderBookUpdate).toHaveBeenCalled();
    });
  });

  describe('getPriceHistory', () => {
    it('should return price history with OHLCV data', async () => {
      const marketId = 'market-1';
      const outcomeId = 'outcome-1';

      const now = Date.now();
      (mockPrisma.trade.findMany as jest.Mock).mockResolvedValue([
        { price: 0.60, totalValue: 60, createdAt: new Date(now - 3600000) },
        { price: 0.65, totalValue: 65, createdAt: new Date(now - 3000000) },
        { price: 0.62, totalValue: 62, createdAt: new Date(now - 2400000) },
        { price: 0.68, totalValue: 68, createdAt: new Date(now - 1800000) }
      ]);

      const history = await marketDataService.getPriceHistory(marketId, outcomeId, '1h', 24);

      expect(history.marketId).toBe(marketId);
      expect(history.outcomeId).toBe(outcomeId);
      expect(history.interval).toBe('1h');
      expect(history.prices).toBeInstanceOf(Array);
      
      if (history.prices.length > 0) {
        const pricePoint = history.prices[0];
        expect(pricePoint).toHaveProperty('timestamp');
        expect(pricePoint).toHaveProperty('open');
        expect(pricePoint).toHaveProperty('high');
        expect(pricePoint).toHaveProperty('low');
        expect(pricePoint).toHaveProperty('close');
        expect(pricePoint).toHaveProperty('volume');
      }
    });

    it('should aggregate trades into correct intervals', async () => {
      const marketId = 'market-1';
      const outcomeId = 'outcome-1';

      const now = Date.now();
      const oneHour = 60 * 60 * 1000;

      (mockPrisma.trade.findMany as jest.Mock).mockResolvedValue([
        { price: 0.60, totalValue: 60, createdAt: new Date(now - oneHour * 2) },
        { price: 0.65, totalValue: 65, createdAt: new Date(now - oneHour * 2 + 1000) },
        { price: 0.70, totalValue: 70, createdAt: new Date(now - oneHour) }
      ]);

      const history = await marketDataService.getPriceHistory(marketId, outcomeId, '1h', 24);

      expect(history.prices.length).toBeGreaterThan(0);
    });
  });

  describe('getMarketStatistics', () => {
    it('should return market statistics', async () => {
      const marketId = 'market-1';

      (mockPrisma.trade.findMany as jest.Mock).mockResolvedValue([
        { totalValue: 100, buyerId: 'buyer-1', sellerId: 'seller-1' },
        { totalValue: 150, buyerId: 'buyer-2', sellerId: 'seller-1' },
        { totalValue: 200, buyerId: 'buyer-1', sellerId: 'seller-2' }
      ]);

      const stats = await marketDataService.getMarketStatistics(marketId);

      expect(stats.totalVolume).toBe(450);
      expect(stats.totalTrades).toBe(3);
      expect(stats.uniqueTraders).toBe(4); // buyer-1, buyer-2, seller-1, seller-2
      expect(stats.averageTradeSize).toBe(150);
      expect(stats.timestamp).toBeInstanceOf(Date);
    });

    it('should handle market with no trades', async () => {
      const marketId = 'market-empty';

      (mockPrisma.trade.findMany as jest.Mock).mockResolvedValue([]);

      const stats = await marketDataService.getMarketStatistics(marketId);

      expect(stats.totalVolume).toBe(0);
      expect(stats.totalTrades).toBe(0);
      expect(stats.uniqueTraders).toBe(0);
      expect(stats.averageTradeSize).toBe(0);
    });
  });

  describe('Real-time Updates', () => {
    it('should start real-time updates', () => {
      marketDataService.startRealTimeUpdates(1000);
      
      // Should not throw error
      expect(() => marketDataService.startRealTimeUpdates(1000)).not.toThrow();
    });

    it('should stop real-time updates', () => {
      marketDataService.startRealTimeUpdates(1000);
      marketDataService.stopRealTimeUpdates();
      
      // Should not throw error
      expect(() => marketDataService.stopRealTimeUpdates()).not.toThrow();
    });
  });

  describe('Cache Management', () => {
    it('should clear cache', () => {
      marketDataService.clearCache();
      
      const stats = marketDataService.getCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should return cache statistics', async () => {
      const marketId = 'market-1';
      const outcomeId = 'outcome-1';

      (mockPrisma.outcome.findUnique as jest.Mock).mockResolvedValue({
        id: outcomeId,
        currentPrice: 0.65,
        bestBid: 0.64,
        bestAsk: 0.66,
        spread: 0.02
      });

      (mockPrisma.trade.aggregate as jest.Mock).mockResolvedValue({
        _sum: { totalValue: 10000 },
        _count: 50
      });

      (mockPrisma.trade.findFirst as jest.Mock).mockResolvedValue({
        price: 0.65,
        createdAt: new Date()
      });

      await marketDataService.getMarketDataSnapshot(marketId, outcomeId);

      const stats = marketDataService.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);
      expect(stats.oldestEntry).toBeInstanceOf(Date);
      expect(stats.newestEntry).toBeInstanceOf(Date);
    });
  });
});
