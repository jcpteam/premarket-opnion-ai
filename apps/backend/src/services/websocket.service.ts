import { Server, Socket } from 'socket.io';
import { logger } from '../config/logger';
import jwt from 'jsonwebtoken';

export interface MarketDataUpdate {
  marketId: string;
  outcomeId?: string;
  type: 'price_update' | 'order_book_update' | 'trade_executed' | 'market_status_change';
  data: any;
  timestamp: Date;
}

export interface ClientSubscription {
  socketId: string;
  userId?: string;
  marketIds: Set<string>;
  outcomeIds: Set<string>;
  subscriptionTypes: Set<string>;
}

export class WebSocketService {
  private io: Server;
  private clients: Map<string, ClientSubscription> = new Map();
  private marketSubscriptions: Map<string, Set<string>> = new Map(); // marketId -> Set of socketIds
  private outcomeSubscriptions: Map<string, Set<string>> = new Map(); // outcomeId -> Set of socketIds

  constructor(io: Server) {
    this.io = io;
    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware(): void {
    // Authentication middleware for WebSocket connections
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          // Allow anonymous connections but mark them as such
          socket.data.isAuthenticated = false;
          return next();
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        socket.data.userId = decoded.userId;
        socket.data.isAuthenticated = true;
        
        logger.info('WebSocket client authenticated', {
          socketId: socket.id,
          userId: decoded.userId,
          service: 'prediction-market-api',
          timestamp: new Date().toISOString()
        });

        next();
      } catch (error) {
        logger.warn('WebSocket authentication failed', {
          socketId: socket.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          service: 'prediction-market-api',
          timestamp: new Date().toISOString()
        });
        
        // Allow connection but mark as unauthenticated
        socket.data.isAuthenticated = false;
        next();
      }
    });
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      this.handleConnection(socket);
    });
  }

  private handleConnection(socket: Socket): void {
    const clientSubscription: ClientSubscription = {
      socketId: socket.id,
      userId: socket.data.userId,
      marketIds: new Set(),
      outcomeIds: new Set(),
      subscriptionTypes: new Set()
    };

    this.clients.set(socket.id, clientSubscription);

    logger.info('WebSocket client connected', {
      socketId: socket.id,
      userId: socket.data.userId || 'anonymous',
      isAuthenticated: socket.data.isAuthenticated,
      service: 'prediction-market-api',
      timestamp: new Date().toISOString()
    });

    // Send connection acknowledgment
    socket.emit('connection_ack', {
      socketId: socket.id,
      isAuthenticated: socket.data.isAuthenticated,
      timestamp: new Date().toISOString()
    });

    // Handle market subscription
    socket.on('subscribe_market', (data: { marketId: string; subscriptionTypes?: string[] }) => {
      this.handleMarketSubscription(socket, data);
    });

    // Handle outcome subscription
    socket.on('subscribe_outcome', (data: { outcomeId: string; subscriptionTypes?: string[] }) => {
      this.handleOutcomeSubscription(socket, data);
    });

    // Handle unsubscription
    socket.on('unsubscribe_market', (data: { marketId: string }) => {
      this.handleMarketUnsubscription(socket, data.marketId);
    });

    socket.on('unsubscribe_outcome', (data: { outcomeId: string }) => {
      this.handleOutcomeUnsubscription(socket, data.outcomeId);
    });

    // Handle ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      this.handleDisconnection(socket, reason);
    });

    // Handle reconnection
    socket.on('reconnect', () => {
      logger.info('WebSocket client reconnected', {
        socketId: socket.id,
        userId: socket.data.userId || 'anonymous',
        service: 'prediction-market-api',
        timestamp: new Date().toISOString()
      });
    });
  }

  private handleMarketSubscription(socket: Socket, data: { marketId: string; subscriptionTypes?: string[] }): void {
    const { marketId, subscriptionTypes = ['all'] } = data;
    const clientSubscription = this.clients.get(socket.id);

    if (!clientSubscription) return;

    // Add to client's subscriptions
    clientSubscription.marketIds.add(marketId);
    subscriptionTypes.forEach(type => clientSubscription.subscriptionTypes.add(type));

    // Add to market subscriptions map
    if (!this.marketSubscriptions.has(marketId)) {
      this.marketSubscriptions.set(marketId, new Set());
    }
    this.marketSubscriptions.get(marketId)!.add(socket.id);

    // Join socket room for efficient broadcasting
    socket.join(`market:${marketId}`);

    logger.info('Client subscribed to market', {
      socketId: socket.id,
      userId: socket.data.userId || 'anonymous',
      marketId,
      subscriptionTypes,
      service: 'prediction-market-api',
      timestamp: new Date().toISOString()
    });

    socket.emit('subscription_confirmed', {
      type: 'market',
      marketId,
      subscriptionTypes,
      timestamp: new Date().toISOString()
    });
  }

  private handleOutcomeSubscription(socket: Socket, data: { outcomeId: string; subscriptionTypes?: string[] }): void {
    const { outcomeId, subscriptionTypes = ['all'] } = data;
    const clientSubscription = this.clients.get(socket.id);

    if (!clientSubscription) return;

    // Add to client's subscriptions
    clientSubscription.outcomeIds.add(outcomeId);
    subscriptionTypes.forEach(type => clientSubscription.subscriptionTypes.add(type));

    // Add to outcome subscriptions map
    if (!this.outcomeSubscriptions.has(outcomeId)) {
      this.outcomeSubscriptions.set(outcomeId, new Set());
    }
    this.outcomeSubscriptions.get(outcomeId)!.add(socket.id);

    // Join socket room for efficient broadcasting
    socket.join(`outcome:${outcomeId}`);

    logger.info('Client subscribed to outcome', {
      socketId: socket.id,
      userId: socket.data.userId || 'anonymous',
      outcomeId,
      subscriptionTypes,
      service: 'prediction-market-api',
      timestamp: new Date().toISOString()
    });

    socket.emit('subscription_confirmed', {
      type: 'outcome',
      outcomeId,
      subscriptionTypes,
      timestamp: new Date().toISOString()
    });
  }

  private handleMarketUnsubscription(socket: Socket, marketId: string): void {
    const clientSubscription = this.clients.get(socket.id);

    if (!clientSubscription) return;

    // Remove from client's subscriptions
    clientSubscription.marketIds.delete(marketId);

    // Remove from market subscriptions map
    const marketSubs = this.marketSubscriptions.get(marketId);
    if (marketSubs) {
      marketSubs.delete(socket.id);
      if (marketSubs.size === 0) {
        this.marketSubscriptions.delete(marketId);
      }
    }

    // Leave socket room
    socket.leave(`market:${marketId}`);

    logger.info('Client unsubscribed from market', {
      socketId: socket.id,
      userId: socket.data.userId || 'anonymous',
      marketId,
      service: 'prediction-market-api',
      timestamp: new Date().toISOString()
    });

    socket.emit('unsubscription_confirmed', {
      type: 'market',
      marketId,
      timestamp: new Date().toISOString()
    });
  }

  private handleOutcomeUnsubscription(socket: Socket, outcomeId: string): void {
    const clientSubscription = this.clients.get(socket.id);

    if (!clientSubscription) return;

    // Remove from client's subscriptions
    clientSubscription.outcomeIds.delete(outcomeId);

    // Remove from outcome subscriptions map
    const outcomeSubs = this.outcomeSubscriptions.get(outcomeId);
    if (outcomeSubs) {
      outcomeSubs.delete(socket.id);
      if (outcomeSubs.size === 0) {
        this.outcomeSubscriptions.delete(outcomeId);
      }
    }

    // Leave socket room
    socket.leave(`outcome:${outcomeId}`);

    logger.info('Client unsubscribed from outcome', {
      socketId: socket.id,
      userId: socket.data.userId || 'anonymous',
      outcomeId,
      service: 'prediction-market-api',
      timestamp: new Date().toISOString()
    });

    socket.emit('unsubscription_confirmed', {
      type: 'outcome',
      outcomeId,
      timestamp: new Date().toISOString()
    });
  }

  private handleDisconnection(socket: Socket, reason: string): void {
    const clientSubscription = this.clients.get(socket.id);

    if (clientSubscription) {
      // Clean up market subscriptions
      clientSubscription.marketIds.forEach(marketId => {
        const marketSubs = this.marketSubscriptions.get(marketId);
        if (marketSubs) {
          marketSubs.delete(socket.id);
          if (marketSubs.size === 0) {
            this.marketSubscriptions.delete(marketId);
          }
        }
      });

      // Clean up outcome subscriptions
      clientSubscription.outcomeIds.forEach(outcomeId => {
        const outcomeSubs = this.outcomeSubscriptions.get(outcomeId);
        if (outcomeSubs) {
          outcomeSubs.delete(socket.id);
          if (outcomeSubs.size === 0) {
            this.outcomeSubscriptions.delete(outcomeId);
          }
        }
      });

      // Remove client subscription
      this.clients.delete(socket.id);
    }

    logger.info('WebSocket client disconnected', {
      socketId: socket.id,
      userId: socket.data.userId || 'anonymous',
      reason,
      service: 'prediction-market-api',
      timestamp: new Date().toISOString()
    });
  }

  // Public methods for broadcasting updates

  public broadcastMarketUpdate(update: MarketDataUpdate): void {
    const room = `market:${update.marketId}`;
    
    this.io.to(room).emit('market_update', {
      ...update,
      timestamp: new Date().toISOString()
    });

    logger.info('Market update broadcasted', {
      marketId: update.marketId,
      type: update.type,
      subscribersCount: this.marketSubscriptions.get(update.marketId)?.size || 0,
      service: 'prediction-market-api',
      timestamp: new Date().toISOString()
    });
  }

  public broadcastOutcomeUpdate(update: MarketDataUpdate): void {
    if (!update.outcomeId) return;

    const room = `outcome:${update.outcomeId}`;
    
    this.io.to(room).emit('outcome_update', {
      ...update,
      timestamp: new Date().toISOString()
    });

    logger.info('Outcome update broadcasted', {
      outcomeId: update.outcomeId,
      type: update.type,
      subscribersCount: this.outcomeSubscriptions.get(update.outcomeId)?.size || 0,
      service: 'prediction-market-api',
      timestamp: new Date().toISOString()
    });
  }

  public broadcastPriceUpdate(marketId: string, outcomeId: string, priceData: any): void {
    const update: MarketDataUpdate = {
      marketId,
      outcomeId,
      type: 'price_update',
      data: priceData,
      timestamp: new Date()
    };

    this.broadcastMarketUpdate(update);
    this.broadcastOutcomeUpdate(update);
  }

  public broadcastOrderBookUpdate(marketId: string, outcomeId: string, orderBookData: any): void {
    const update: MarketDataUpdate = {
      marketId,
      outcomeId,
      type: 'order_book_update',
      data: orderBookData,
      timestamp: new Date()
    };

    this.broadcastMarketUpdate(update);
    this.broadcastOutcomeUpdate(update);
  }

  public broadcastTradeExecution(marketId: string, outcomeId: string, tradeData: any): void {
    const update: MarketDataUpdate = {
      marketId,
      outcomeId,
      type: 'trade_executed',
      data: tradeData,
      timestamp: new Date()
    };

    this.broadcastMarketUpdate(update);
    this.broadcastOutcomeUpdate(update);
  }

  public broadcastMarketStatusChange(marketId: string, statusData: any): void {
    const update: MarketDataUpdate = {
      marketId,
      type: 'market_status_change',
      data: statusData,
      timestamp: new Date()
    };

    this.broadcastMarketUpdate(update);
  }

  // Connection management methods

  public getConnectedClientsCount(): number {
    return this.clients.size;
  }

  public getMarketSubscribersCount(marketId: string): number {
    return this.marketSubscriptions.get(marketId)?.size || 0;
  }

  public getOutcomeSubscribersCount(outcomeId: string): number {
    return this.outcomeSubscriptions.get(outcomeId)?.size || 0;
  }

  public getConnectionStats(): {
    totalConnections: number;
    authenticatedConnections: number;
    totalMarketSubscriptions: number;
    totalOutcomeSubscriptions: number;
  } {
    let authenticatedCount = 0;
    
    this.clients.forEach(client => {
      if (client.userId) authenticatedCount++;
    });

    return {
      totalConnections: this.clients.size,
      authenticatedConnections: authenticatedCount,
      totalMarketSubscriptions: this.marketSubscriptions.size,
      totalOutcomeSubscriptions: this.outcomeSubscriptions.size
    };
  }

  // Reconnection logic
  public handleReconnection(socket: Socket, previousSubscriptions?: {
    marketIds: string[];
    outcomeIds: string[];
    subscriptionTypes: string[];
  }): void {
    if (previousSubscriptions) {
      // Restore previous subscriptions
      previousSubscriptions.marketIds.forEach(marketId => {
        this.handleMarketSubscription(socket, { 
          marketId, 
          subscriptionTypes: previousSubscriptions.subscriptionTypes 
        });
      });

      previousSubscriptions.outcomeIds.forEach(outcomeId => {
        this.handleOutcomeSubscription(socket, { 
          outcomeId, 
          subscriptionTypes: previousSubscriptions.subscriptionTypes 
        });
      });

      logger.info('WebSocket subscriptions restored after reconnection', {
        socketId: socket.id,
        userId: socket.data.userId || 'anonymous',
        marketIds: previousSubscriptions.marketIds,
        outcomeIds: previousSubscriptions.outcomeIds,
        service: 'prediction-market-api',
        timestamp: new Date().toISOString()
      });
    }
  }
}