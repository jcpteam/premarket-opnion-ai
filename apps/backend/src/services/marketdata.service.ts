import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';
import { WebSocketService } from './websocket.service';

export interface MarketDataSnapshot {
  marketId: string;
  outcomeId: string;
  currentPrice: number;
  bestBid: number | null;
  bestAsk: number | null;
  spread: number | null;
  volume24h: number;
  priceChange24h: number;
  lastTradePrice: number | null;
  lastTradeTime: Date | null;
  timestamp: Date;
}

export interface OrderBookDepth {
  marketId: string;
  outcomeId: string;
  bids: PriceLevel[];
  asks: PriceLevel[];
  totalBidVolume: number;
  totalAskVolume: number;
  timestamp: Date;
}

export interface PriceLevel {
  price: number;
  quantity: number;
  orderCount: number;
}

export interface TradeNotification {
  tradeId: string;
  marketId: string;
  outcomeId: string;
  price: number;
  quantity: number;
  totalValue: number;
  buyerId: string;
  sellerId: string;
  timestamp: Date;
}

export interface PriceHistory {
  marketId: string;
  outcomeId: string;
  prices: PricePoint[];
  interval: '1m' | '5m' | '15m' | '1h' | '1d';
}

export interface PricePoint {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Market Data Service
 * Provides real-time market data streaming and aggregation
 * 
 * Requirements: 6.4, 10.1, 10.2
 * - Display current prices, volume, and price history
 * - Update charts and indicators in real-time
 * - Provide market depth visualization
 */
export class MarketDataService {
  private prisma: PrismaClient;
  private webSocketService: WebSocketService;
  private priceCache: Map<string, MarketDataSnapshot> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(prisma: PrismaClient, webSocketService: WebSocketService) {
    this.prisma = prisma;
    this.webSocketService = webSocketService;
  }

  /**
   * Start real-time market data updates
   */
  startRealTimeUpdates(intervalMs: number = 1000): void {
    if (this.updateInterval) {
      logger.warn('Real-time updates already running');
      return;
    }

    this.updateInterval = setInterval(async () => {
      await this.updateAllMarketData();
    }, intervalMs);

    logger.info('Real-time market data updates started', {
      intervalMs,
      service: 'prediction-market-api',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Stop real-time market data updates
   */
  stopRealTimeUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      
      logger.info('Real-time market data updates stopped', {
        service: 'prediction-market-api',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Update all active market data
   */
  private async updateAllMarketData(): Promise<void> {
    try {
      // Get all active markets
      const activeMarkets = await this.prisma.market.findMany({
        where: { status: 'ACTIVE' },
        include: { outcomes: true }
      });

      for (const market of activeMarkets) {
        for (const outcome of market.outcomes) {
          await this.updateMarketDataSnapshot(market.id, outcome.id);
        }
      }
    } catch (error) {
      logger.error('Failed to update market data', {
        error: error instanceof Error ? error.message : 'Unknown error',
        service: 'prediction-market-api',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get current market data snapshot
   */
  async getMarketDataSnapshot(marketId: string, outcomeId: string): Promise<MarketDataSnapshot> {
    const cacheKey = `${marketId}:${outcomeId}`;
    const cached = this.priceCache.get(cacheKey);

    // Return cached data if recent (within 5 seconds)
    if (cached && (Date.now() - cached.timestamp.getTime()) < 5000) {
      return cached;
    }

    // Fetch fresh data
    return await this.updateMarketDataSnapshot(marketId, outcomeId);
  }

  /**
   * Update market data snapshot and broadcast
   */
  private async updateMarketDataSnapshot(marketId: string, outcomeId: string): Promise<MarketDataSnapshot> {
    const cacheKey = `${marketId}:${outcomeId}`;

    // Get outcome data
    const outcome = await this.prisma.outcome.findUnique({
      where: { id: outcomeId }
    });

    if (!outcome) {
      throw new Error('Outcome not found');
    }

    // Calculate 24h volume
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const trades24h = await this.prisma.trade.aggregate({
      where: {
        marketId,
        outcomeId,
        createdAt: { gte: twentyFourHoursAgo }
      },
      _sum: { totalValue: true },
      _count: true
    });

    // Get last trade
    const lastTrade = await this.prisma.trade.findFirst({
      where: { marketId, outcomeId },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate 24h price change
    const priceChange24h = await this.calculate24hPriceChange(marketId, outcomeId);

    const snapshot: MarketDataSnapshot = {
      marketId,
      outcomeId,
      currentPrice: outcome.currentPrice,
      bestBid: outcome.bestBid,
      bestAsk: outcome.bestAsk,
      spread: outcome.spread,
      volume24h: trades24h._sum.totalValue || 0,
      priceChange24h,
      lastTradePrice: lastTrade?.price || null,
      lastTradeTime: lastTrade?.createdAt || null,
      timestamp: new Date()
    };

    // Update cache
    const previousSnapshot = this.priceCache.get(cacheKey);
    this.priceCache.set(cacheKey, snapshot);

    // Broadcast if price changed
    if (!previousSnapshot || previousSnapshot.currentPrice !== snapshot.currentPrice) {
      this.webSocketService.broadcastPriceUpdate(marketId, outcomeId, {
        currentPrice: snapshot.currentPrice,
        bestBid: snapshot.bestBid,
        bestAsk: snapshot.bestAsk,
        spread: snapshot.spread,
        volume24h: snapshot.volume24h,
        priceChange24h: snapshot.priceChange24h,
        lastTradePrice: snapshot.lastTradePrice,
        timestamp: snapshot.timestamp.toISOString()
      });
    }

    return snapshot;
  }

  /**
   * Calculate 24h price change percentage
   */
  private async calculate24hPriceChange(marketId: string, outcomeId: string): Promise<number> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const oldTrade = await this.prisma.trade.findFirst({
      where: {
        marketId,
        outcomeId,
        createdAt: { lte: twentyFourHoursAgo }
      },
      orderBy: { createdAt: 'desc' }
    });

    const currentOutcome = await this.prisma.outcome.findUnique({
      where: { id: outcomeId }
    });

    if (!oldTrade || !currentOutcome) {
      return 0;
    }

    const priceChange = ((currentOutcome.currentPrice - oldTrade.price) / oldTrade.price) * 100;
    return Math.round(priceChange * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Get order book depth for visualization
   */
  async getOrderBookDepth(marketId: string, outcomeId: string, levels: number = 10): Promise<OrderBookDepth> {
    // Get all open orders for this outcome
    const orders = await this.prisma.order.findMany({
      where: {
        marketId,
        outcomeId,
        status: { in: ['PENDING', 'PARTIAL'] } // Orders that are still active
      },
      orderBy: { price: 'desc' }
    });

    // Aggregate orders by price level
    const bidMap = new Map<number, { quantity: number; orderCount: number }>();
    const askMap = new Map<number, { quantity: number; orderCount: number }>();

    for (const order of orders) {
      const map = order.type === 'BUY' ? bidMap : askMap;
      const existing = map.get(order.price) || { quantity: 0, orderCount: 0 };
      
      map.set(order.price, {
        quantity: existing.quantity + order.remainingQuantity,
        orderCount: existing.orderCount + 1
      });
    }

    // Convert to sorted arrays
    const bids: PriceLevel[] = Array.from(bidMap.entries())
      .map(([price, data]) => ({ price, ...data }))
      .sort((a, b) => b.price - a.price)
      .slice(0, levels);

    const asks: PriceLevel[] = Array.from(askMap.entries())
      .map(([price, data]) => ({ price, ...data }))
      .sort((a, b) => a.price - b.price)
      .slice(0, levels);

    const totalBidVolume = bids.reduce((sum, level) => sum + level.quantity, 0);
    const totalAskVolume = asks.reduce((sum, level) => sum + level.quantity, 0);

    return {
      marketId,
      outcomeId,
      bids,
      asks,
      totalBidVolume,
      totalAskVolume,
      timestamp: new Date()
    };
  }

  /**
   * Stream order book depth updates
   */
  async streamOrderBookDepth(marketId: string, outcomeId: string, levels: number = 10): Promise<void> {
    const depth = await this.getOrderBookDepth(marketId, outcomeId, levels);
    
    this.webSocketService.broadcastOrderBookUpdate(marketId, outcomeId, {
      bids: depth.bids,
      asks: depth.asks,
      totalBidVolume: depth.totalBidVolume,
      totalAskVolume: depth.totalAskVolume,
      timestamp: depth.timestamp.toISOString()
    });

    logger.info('Order book depth streamed', {
      marketId,
      outcomeId,
      bidLevels: depth.bids.length,
      askLevels: depth.asks.length,
      service: 'prediction-market-api',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast trade execution notification
   */
  async broadcastTradeNotification(trade: TradeNotification): Promise<void> {
    this.webSocketService.broadcastTradeExecution(trade.marketId, trade.outcomeId, {
      tradeId: trade.tradeId,
      price: trade.price,
      quantity: trade.quantity,
      totalValue: trade.totalValue,
      buyerId: trade.buyerId,
      sellerId: trade.sellerId,
      timestamp: trade.timestamp.toISOString()
    });

    // Update market data snapshot after trade
    await this.updateMarketDataSnapshot(trade.marketId, trade.outcomeId);

    // Update order book depth
    await this.streamOrderBookDepth(trade.marketId, trade.outcomeId);

    logger.info('Trade notification broadcasted', {
      tradeId: trade.tradeId,
      marketId: trade.marketId,
      outcomeId: trade.outcomeId,
      price: trade.price,
      quantity: trade.quantity,
      service: 'prediction-market-api',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get price history for charting
   */
  async getPriceHistory(
    marketId: string,
    outcomeId: string,
    interval: '1m' | '5m' | '15m' | '1h' | '1d' = '1h',
    limit: number = 100
  ): Promise<PriceHistory> {
    const intervalMs = this.getIntervalMs(interval);
    const startTime = new Date(Date.now() - intervalMs * limit);

    // Get all trades in the time range
    const trades = await this.prisma.trade.findMany({
      where: {
        marketId,
        outcomeId,
        createdAt: { gte: startTime }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Aggregate trades into price points
    const pricePoints: PricePoint[] = [];
    const buckets = new Map<number, { prices: number[]; volumes: number[] }>();

    for (const trade of trades) {
      const bucketTime = Math.floor(trade.createdAt.getTime() / intervalMs) * intervalMs;
      const bucket = buckets.get(bucketTime) || { prices: [], volumes: [] };
      
      bucket.prices.push(trade.price);
      bucket.volumes.push(trade.totalValue);
      buckets.set(bucketTime, bucket);
    }

    // Convert buckets to price points
    for (const [bucketTime, data] of Array.from(buckets.entries()).sort((a, b) => a[0] - b[0])) {
      if (data.prices.length > 0) {
        pricePoints.push({
          timestamp: new Date(bucketTime),
          open: data.prices[0],
          high: Math.max(...data.prices),
          low: Math.min(...data.prices),
          close: data.prices[data.prices.length - 1],
          volume: data.volumes.reduce((sum, v) => sum + v, 0)
        });
      }
    }

    return {
      marketId,
      outcomeId,
      prices: pricePoints,
      interval
    };
  }

  /**
   * Get interval in milliseconds
   */
  private getIntervalMs(interval: '1m' | '5m' | '15m' | '1h' | '1d'): number {
    const intervals = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    };
    return intervals[interval];
  }

  /**
   * Get market statistics
   */
  async getMarketStatistics(marketId: string): Promise<{
    totalVolume: number;
    totalTrades: number;
    uniqueTraders: number;
    averageTradeSize: number;
    timestamp: Date;
  }> {
    const trades = await this.prisma.trade.findMany({
      where: { marketId },
      select: {
        totalValue: true,
        buyerId: true,
        sellerId: true
      }
    });

    const totalVolume = trades.reduce((sum, t) => sum + t.totalValue, 0);
    const totalTrades = trades.length;
    const uniqueTraders = new Set([...trades.map(t => t.buyerId), ...trades.map(t => t.sellerId)]).size;
    const averageTradeSize = totalTrades > 0 ? totalVolume / totalTrades : 0;

    return {
      totalVolume,
      totalTrades,
      uniqueTraders,
      averageTradeSize,
      timestamp: new Date()
    };
  }

  /**
   * Clear price cache
   */
  clearCache(): void {
    this.priceCache.clear();
    logger.info('Market data cache cleared', {
      service: 'prediction-market-api',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    oldestEntry: Date | null;
    newestEntry: Date | null;
  } {
    const entries = Array.from(this.priceCache.values());
    
    return {
      size: entries.length,
      oldestEntry: entries.length > 0 ? new Date(Math.min(...entries.map(e => e.timestamp.getTime()))) : null,
      newestEntry: entries.length > 0 ? new Date(Math.max(...entries.map(e => e.timestamp.getTime()))) : null
    };
  }
}
