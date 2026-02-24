import { PrismaClient, OrderType, OrderStatus, OrderSubType } from '@prisma/client';
import { logger } from '../config/logger';
import { WebSocketService } from './websocket.service';

export interface OrderBookEntry {
  id: string;
  userId: string;
  marketId: string;
  outcomeId: string;
  type: OrderType;
  orderType: OrderSubType;
  quantity: number;
  price: number;
  remainingQuantity: number;
  createdAt: Date;
}

export interface OrderBookLevel {
  price: number;
  quantity: number;
  orderCount: number;
  orders: OrderBookEntry[];
}

export interface OrderBookSnapshot {
  marketId: string;
  outcomeId: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  bestBid: number | null;
  bestAsk: number | null;
  spread: number | null;
  lastUpdated: Date;
}

export interface PlaceOrderRequest {
  userId: string;
  marketId: string;
  outcomeId: string;
  type: OrderType;
  orderType: OrderSubType;
  quantity: number;
  price?: number; // Optional for market orders
}

export interface OrderMatchResult {
  trades: TradeExecution[];
  remainingOrder: OrderBookEntry | undefined;
  priceUpdates: PriceUpdate[];
}

export interface TradeExecution {
  buyOrderId: string;
  sellOrderId: string;
  buyerId: string;
  sellerId: string;
  quantity: number;
  price: number;
  totalValue: number;
  buyerFee: number;
  sellerFee: number;
}

export interface PriceUpdate {
  outcomeId: string;
  newPrice: number;
  bestBid: number | null;
  bestAsk: number | null;
  spread: number | null;
}

/**
 * Order Book Service
 * Implements in-memory order book with price-time priority matching
 * 
 * Requirements: 2.1, 2.2, 2.3
 * - Match buy orders with compatible sell orders at best available price
 * - Match sell orders with compatible buy orders at best available price
 * - Add orders to queue when no matches exist
 * - Maintain price-time priority ordering
 * - Validate orders and implement risk management
 */
export class OrderBookService {
  private prisma: PrismaClient;
  private webSocketService: WebSocketService | undefined;
  private orderBooks: Map<string, Map<string, OrderBookSnapshot>>;
  private readonly FEE_RATE = 0.002; // 0.2% trading fee
  private readonly MIN_PRICE = 0.01;
  private readonly MAX_PRICE = 0.99;

  constructor(prisma: PrismaClient, webSocketService?: WebSocketService) {
    this.prisma = prisma;
    this.webSocketService = webSocketService;
    this.orderBooks = new Map();
  }

  /**
   * Initialize order book for a market outcome
   */
  async initializeOrderBook(marketId: string, outcomeId: string): Promise<void> {
    try {
      if (!this.orderBooks.has(marketId)) {
        this.orderBooks.set(marketId, new Map());
      }

      const marketOrderBooks = this.orderBooks.get(marketId)!;
      
      if (!marketOrderBooks.has(outcomeId)) {
        // Load existing orders from database
        const existingOrders = await this.prisma.order.findMany({
          where: {
            marketId,
            outcomeId,
            status: {
              in: ['PENDING', 'PARTIAL']
            }
          },
          orderBy: [
            { price: 'desc' }, // Best prices first
            { createdAt: 'asc' } // Time priority
          ]
        });

        const orderBook: OrderBookSnapshot = {
          marketId,
          outcomeId,
          bids: [],
          asks: [],
          bestBid: null,
          bestAsk: null,
          spread: null,
          lastUpdated: new Date()
        };

        // Populate order book from existing orders
        for (const order of existingOrders) {
          const entry: OrderBookEntry = {
            id: order.id,
            userId: order.userId,
            marketId: order.marketId,
            outcomeId: order.outcomeId,
            type: order.type,
            orderType: order.orderType,
            quantity: order.quantity,
            price: order.price,
            remainingQuantity: order.remainingQuantity,
            createdAt: order.createdAt
          };

          this.addOrderToBook(orderBook, entry);
        }

        this.updateBookPrices(orderBook);
        marketOrderBooks.set(outcomeId, orderBook);

        logger.info('Order book initialized', {
          marketId,
          outcomeId,
          existingOrders: existingOrders.length,
          bestBid: orderBook.bestBid,
          bestAsk: orderBook.bestAsk
        });
      }
    } catch (error) {
      logger.error('Failed to initialize order book', {
        marketId,
        outcomeId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Place a new order and attempt to match it
   */
  async placeOrder(request: PlaceOrderRequest): Promise<OrderMatchResult> {
    try {
      // Validate order request
      this.validateOrderRequest(request);

      // Initialize order book if needed
      await this.initializeOrderBook(request.marketId, request.outcomeId);

      const orderBook = this.getOrderBook(request.marketId, request.outcomeId);
      
      // Handle market orders by setting appropriate price
      let orderPrice = request.price;
      if (request.orderType === 'MARKET') {
        orderPrice = this.getMarketOrderPrice(orderBook, request.type);
      }

      // Create order entry
      const orderId = await this.createOrderInDatabase(request, orderPrice!);
      
      const orderEntry: OrderBookEntry = {
        id: orderId,
        userId: request.userId,
        marketId: request.marketId,
        outcomeId: request.outcomeId,
        type: request.type,
        orderType: request.orderType,
        quantity: request.quantity,
        price: orderPrice!,
        remainingQuantity: request.quantity,
        createdAt: new Date()
      };

      // Attempt to match the order
      const matchResult = await this.matchOrder(orderBook, orderEntry);

      // Update order book and database
      await this.processMatchResult(orderBook, matchResult);

      logger.info('Order placed and processed', {
        orderId,
        userId: request.userId,
        marketId: request.marketId,
        outcomeId: request.outcomeId,
        type: request.type,
        quantity: request.quantity,
        price: orderPrice,
        tradesExecuted: matchResult.trades.length
      });

      return matchResult;

    } catch (error) {
      logger.error('Failed to place order', {
        request,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Cancel an existing order
   */
  async cancelOrder(orderId: string, userId: string): Promise<boolean> {
    try {
      // Get order from database
      const order = await this.prisma.order.findUnique({
        where: { id: orderId }
      });

      if (!order) {
        throw new Error('Order not found');
      }

      if (order.userId !== userId) {
        throw new Error('Unauthorized to cancel this order');
      }

      if (order.status === 'FILLED' || order.status === 'CANCELLED') {
        throw new Error('Order cannot be cancelled');
      }

      // Remove from order book
      const orderBook = this.getOrderBook(order.marketId, order.outcomeId);
      this.removeOrderFromBook(orderBook, orderId);

      // Update database
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'CANCELLED',
          updatedAt: new Date()
        }
      });

      this.updateBookPrices(orderBook);

      logger.info('Order cancelled', {
        orderId,
        userId,
        marketId: order.marketId,
        outcomeId: order.outcomeId
      });

      return true;

    } catch (error) {
      logger.error('Failed to cancel order', {
        orderId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get order book snapshot for a market outcome
   */
  getOrderBookSnapshot(marketId: string, outcomeId: string): OrderBookSnapshot | null {
    const marketOrderBooks = this.orderBooks.get(marketId);
    if (!marketOrderBooks) {
      return null;
    }

    return marketOrderBooks.get(outcomeId) || null;
  }

  /**
   * Get order book depth (aggregated by price level)
   */
  getOrderBookDepth(marketId: string, outcomeId: string, levels: number = 10): {
    bids: OrderBookLevel[];
    asks: OrderBookLevel[];
  } {
    const orderBook = this.getOrderBookSnapshot(marketId, outcomeId);
    
    if (!orderBook) {
      return { bids: [], asks: [] };
    }

    return {
      bids: orderBook.bids.slice(0, levels),
      asks: orderBook.asks.slice(0, levels)
    };
  }

  /**
   * Match an order against the order book
   */
  private async matchOrder(orderBook: OrderBookSnapshot, newOrder: OrderBookEntry): Promise<OrderMatchResult> {
    const trades: TradeExecution[] = [];
    const priceUpdates: PriceUpdate[] = [];
    let remainingOrder: OrderBookEntry | undefined = { ...newOrder };

    try {
      // Get opposing side orders
      const opposingSide = newOrder.type === 'BUY' ? orderBook.asks : orderBook.bids;

      for (const level of opposingSide) {
        if (remainingOrder.remainingQuantity <= 0) {
          break;
        }

        // Check if prices cross (can match)
        const canMatch = newOrder.type === 'BUY' 
          ? remainingOrder.price >= level.price
          : remainingOrder.price <= level.price;

        if (!canMatch) {
          break;
        }

        // Match against orders at this price level
        for (const existingOrder of level.orders) {
          if (remainingOrder.remainingQuantity <= 0) {
            break;
          }

          // Calculate trade quantity
          const tradeQuantity = Math.min(
            remainingOrder.remainingQuantity,
            existingOrder.remainingQuantity
          );

          // Execute trade
          const trade = this.createTrade(
            remainingOrder,
            existingOrder,
            tradeQuantity,
            existingOrder.price // Use existing order's price
          );

          trades.push(trade);

          // Update remaining quantities
          remainingOrder.remainingQuantity -= tradeQuantity;
          existingOrder.remainingQuantity -= tradeQuantity;

          // Remove fully filled orders
          if (existingOrder.remainingQuantity <= 0) {
            this.removeOrderFromBook(orderBook, existingOrder.id);
          }
        }

        // Remove empty price levels
        if (level.orders.length === 0) {
          const levelIndex = opposingSide.indexOf(level);
          opposingSide.splice(levelIndex, 1);
        }
      }

      // Add remaining order to book if not fully filled
      if (remainingOrder.remainingQuantity > 0) {
        this.addOrderToBook(orderBook, remainingOrder);
      } else {
        remainingOrder = undefined;
      }

      // Update prices and create price update
      this.updateBookPrices(orderBook);
      
      priceUpdates.push({
        outcomeId: orderBook.outcomeId,
        newPrice: this.calculateMidPrice(orderBook),
        bestBid: orderBook.bestBid,
        bestAsk: orderBook.bestAsk,
        spread: orderBook.spread
      });

      return {
        trades,
        remainingOrder,
        priceUpdates
      };

    } catch (error) {
      logger.error('Failed to match order', {
        newOrder,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Create a trade execution record
   */
  private createTrade(
    buyOrder: OrderBookEntry,
    sellOrder: OrderBookEntry,
    quantity: number,
    price: number
  ): TradeExecution {
    const totalValue = quantity * price;
    const buyerFee = totalValue * this.FEE_RATE;
    const sellerFee = totalValue * this.FEE_RATE;

    // Determine which order is buy and which is sell
    const isBuyOrderFirst = buyOrder.type === 'BUY';
    
    return {
      buyOrderId: isBuyOrderFirst ? buyOrder.id : sellOrder.id,
      sellOrderId: isBuyOrderFirst ? sellOrder.id : buyOrder.id,
      buyerId: isBuyOrderFirst ? buyOrder.userId : sellOrder.userId,
      sellerId: isBuyOrderFirst ? sellOrder.userId : buyOrder.userId,
      quantity,
      price,
      totalValue,
      buyerFee,
      sellerFee
    };
  }

  /**
   * Add order to the appropriate side of the order book
   */
  private addOrderToBook(orderBook: OrderBookSnapshot, order: OrderBookEntry): void {
    const side = order.type === 'BUY' ? orderBook.bids : orderBook.asks;
    
    // Find or create price level
    let priceLevel = side.find(level => level.price === order.price);
    
    if (!priceLevel) {
      priceLevel = {
        price: order.price,
        quantity: 0,
        orderCount: 0,
        orders: []
      };
      
      // Insert in price-priority order
      const insertIndex = side.findIndex(level => 
        order.type === 'BUY' ? level.price < order.price : level.price > order.price
      );
      
      if (insertIndex === -1) {
        side.push(priceLevel);
      } else {
        side.splice(insertIndex, 0, priceLevel);
      }
    }

    // Add order to price level maintaining time priority (earliest first)
    const insertIndex = priceLevel.orders.findIndex(existingOrder => 
      existingOrder.createdAt > order.createdAt
    );
    
    if (insertIndex === -1) {
      priceLevel.orders.push(order);
    } else {
      priceLevel.orders.splice(insertIndex, 0, order);
    }
    
    priceLevel.quantity += order.remainingQuantity;
    priceLevel.orderCount += 1;
  }

  /**
   * Remove order from order book
   */
  private removeOrderFromBook(orderBook: OrderBookSnapshot, orderId: string): void {
    const sides = [orderBook.bids, orderBook.asks];
    
    for (const side of sides) {
      for (const level of side) {
        const orderIndex = level.orders.findIndex(order => order.id === orderId);
        
        if (orderIndex !== -1) {
          const order = level.orders[orderIndex];
          level.quantity -= order.remainingQuantity;
          level.orderCount -= 1;
          level.orders.splice(orderIndex, 1);
          
          // Remove empty price levels
          if (level.orders.length === 0) {
            const levelIndex = side.indexOf(level);
            side.splice(levelIndex, 1);
          }
          
          return;
        }
      }
    }
  }

  /**
   * Update best bid, best ask, and spread
   */
  private updateBookPrices(orderBook: OrderBookSnapshot): void {
    orderBook.bestBid = orderBook.bids.length > 0 ? orderBook.bids[0].price : null;
    orderBook.bestAsk = orderBook.asks.length > 0 ? orderBook.asks[0].price : null;
    
    if (orderBook.bestBid !== null && orderBook.bestAsk !== null) {
      orderBook.spread = orderBook.bestAsk - orderBook.bestBid;
    } else {
      orderBook.spread = null;
    }
    
    orderBook.lastUpdated = new Date();
  }

  /**
   * Calculate mid-price for price updates
   */
  private calculateMidPrice(orderBook: OrderBookSnapshot): number {
    if (orderBook.bestBid !== null && orderBook.bestAsk !== null) {
      return (orderBook.bestBid + orderBook.bestAsk) / 2;
    } else if (orderBook.bestBid !== null) {
      return orderBook.bestBid;
    } else if (orderBook.bestAsk !== null) {
      return orderBook.bestAsk;
    } else {
      return 0.5; // Default mid-price
    }
  }

  /**
   * Get market order price (best available price)
   */
  private getMarketOrderPrice(orderBook: OrderBookSnapshot, orderType: OrderType): number {
    if (orderType === 'BUY') {
      return orderBook.bestAsk || this.MAX_PRICE;
    } else {
      return orderBook.bestBid || this.MIN_PRICE;
    }
  }

  /**
   * Get order book for market/outcome
   */
  private getOrderBook(marketId: string, outcomeId: string): OrderBookSnapshot {
    const marketOrderBooks = this.orderBooks.get(marketId);
    if (!marketOrderBooks) {
      throw new Error(`Order book not initialized for market ${marketId}`);
    }

    const orderBook = marketOrderBooks.get(outcomeId);
    if (!orderBook) {
      throw new Error(`Order book not initialized for outcome ${outcomeId}`);
    }

    return orderBook;
  }

  /**
   * Create order in database
   */
  private async createOrderInDatabase(request: PlaceOrderRequest, price: number): Promise<string> {
    const order = await this.prisma.order.create({
      data: {
        userId: request.userId,
        marketId: request.marketId,
        outcomeId: request.outcomeId,
        type: request.type,
        orderType: request.orderType,
        quantity: request.quantity,
        price: price,
        remainingQuantity: request.quantity,
        status: 'PENDING'
      }
    });

    return order.id;
  }

  /**
   * Process match result by updating database and order book
   */
  private async processMatchResult(orderBook: OrderBookSnapshot, result: OrderMatchResult): Promise<void> {
    // Execute trades in database
    for (const trade of result.trades) {
      await this.prisma.trade.create({
        data: {
          marketId: orderBook.marketId,
          outcomeId: orderBook.outcomeId,
          buyerId: trade.buyerId,
          sellerId: trade.sellerId,
          buyOrderId: trade.buyOrderId,
          sellOrderId: trade.sellOrderId,
          quantity: trade.quantity,
          price: trade.price,
          totalValue: trade.totalValue,
          buyerFee: trade.buyerFee,
          sellerFee: trade.sellerFee
        }
      });

      // Update order statuses
      await this.updateOrderAfterTrade(trade.buyOrderId, trade.quantity);
      await this.updateOrderAfterTrade(trade.sellOrderId, trade.quantity);

      // Broadcast trade execution via WebSocket
      if (this.webSocketService) {
        this.webSocketService.broadcastTradeExecution(orderBook.marketId, orderBook.outcomeId, {
          tradeId: `${trade.buyOrderId}-${trade.sellOrderId}`,
          buyOrderId: trade.buyOrderId,
          sellOrderId: trade.sellOrderId,
          buyerId: trade.buyerId,
          sellerId: trade.sellerId,
          quantity: trade.quantity,
          price: trade.price,
          totalValue: trade.totalValue,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Update outcome prices
    for (const priceUpdate of result.priceUpdates) {
      await this.prisma.outcome.update({
        where: { id: priceUpdate.outcomeId },
        data: {
          currentPrice: priceUpdate.newPrice,
          bestBid: priceUpdate.bestBid || 0,
          bestAsk: priceUpdate.bestAsk || 1,
          spread: priceUpdate.spread || 1,
          updatedAt: new Date()
        }
      });

      // Broadcast price update via WebSocket
      if (this.webSocketService) {
        this.webSocketService.broadcastPriceUpdate(orderBook.marketId, priceUpdate.outcomeId, {
          currentPrice: priceUpdate.newPrice,
          bestBid: priceUpdate.bestBid,
          bestAsk: priceUpdate.bestAsk,
          spread: priceUpdate.spread,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Broadcast order book update via WebSocket
    if (this.webSocketService) {
      this.webSocketService.broadcastOrderBookUpdate(orderBook.marketId, orderBook.outcomeId, {
        bids: orderBook.bids.map(level => ({
          price: level.price,
          quantity: level.quantity,
          orderCount: level.orderCount
        })),
        asks: orderBook.asks.map(level => ({
          price: level.price,
          quantity: level.quantity,
          orderCount: level.orderCount
        })),
        bestBid: orderBook.bestBid,
        bestAsk: orderBook.bestAsk,
        spread: orderBook.spread,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Update order after trade execution
   */
  private async updateOrderAfterTrade(orderId: string, tradedQuantity: number): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    const newFilledQuantity = order.filledQuantity + tradedQuantity;
    const newRemainingQuantity = order.quantity - newFilledQuantity;
    
    let newStatus: OrderStatus = 'PARTIAL';
    if (newRemainingQuantity <= 0) {
      newStatus = 'FILLED';
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        filledQuantity: newFilledQuantity,
        remainingQuantity: newRemainingQuantity,
        status: newStatus,
        updatedAt: new Date()
      }
    });
  }

  /**
   * Validate order request
   */
  private validateOrderRequest(request: PlaceOrderRequest): void {
    if (!request.userId) {
      throw new Error('User ID is required');
    }

    if (!request.marketId) {
      throw new Error('Market ID is required');
    }

    if (!request.outcomeId) {
      throw new Error('Outcome ID is required');
    }

    if (!request.type || !['BUY', 'SELL'].includes(request.type)) {
      throw new Error('Order type must be BUY or SELL');
    }

    if (!request.orderType || !['MARKET', 'LIMIT'].includes(request.orderType)) {
      throw new Error('Order type must be MARKET or LIMIT');
    }

    if (!request.quantity || request.quantity <= 0) {
      throw new Error('Quantity must be greater than 0');
    }

    if (request.orderType === 'LIMIT') {
      if (request.price === undefined || request.price < this.MIN_PRICE || request.price > this.MAX_PRICE) {
        throw new Error(`Price must be between ${this.MIN_PRICE} and ${this.MAX_PRICE}`);
      }
    }
  }
}