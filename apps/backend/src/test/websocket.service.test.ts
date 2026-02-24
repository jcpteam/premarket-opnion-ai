import { Server } from 'socket.io';
import { createServer } from 'http';
import Client from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { WebSocketService, MarketDataUpdate } from '../services/websocket.service';

describe('WebSocketService', () => {
  let httpServer: any;
  let io: Server;
  let webSocketService: WebSocketService;
  let clientSocket: any;
  let serverSocket: any;

  beforeAll((done) => {
    httpServer = createServer();
    io = new Server(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    webSocketService = new WebSocketService(io);

    httpServer.listen(() => {
      const port = (httpServer.address() as any).port;
      clientSocket = Client(`http://localhost:${port}`);
      
      io.on('connection', (socket) => {
        serverSocket = socket;
      });
      
      clientSocket.on('connect', done);
    });
  });

  afterAll((done) => {
    clientSocket.disconnect();
    io.close(() => {
      httpServer.close(() => {
        done();
      });
    });
  });

  beforeEach(() => {
    // Reset any state between tests
    jest.clearAllMocks();
  });

  describe('Connection Management', () => {
    it('should handle client connection', (done) => {
      clientSocket.on('connection_ack', (data: any) => {
        expect(data).toHaveProperty('socketId');
        expect(data).toHaveProperty('isAuthenticated', false);
        expect(data).toHaveProperty('timestamp');
        done();
      });
    });

    it('should handle authenticated connection', (done) => {
      const token = jwt.sign({ userId: 'test-user' }, process.env.JWT_SECRET || 'test-secret');
      
      const authenticatedClient = Client(`http://localhost:${(httpServer.address() as any).port}`, {
        auth: { token }
      });

      authenticatedClient.on('connection_ack', (data: any) => {
        expect(data.isAuthenticated).toBe(true);
        authenticatedClient.disconnect();
        done();
      });
    });

    it('should handle ping/pong', (done) => {
      clientSocket.emit('ping');
      clientSocket.on('pong', (data: any) => {
        expect(data).toHaveProperty('timestamp');
        done();
      });
    });

    it('should track connection statistics', () => {
      const stats = webSocketService.getConnectionStats();
      expect(stats).toHaveProperty('totalConnections');
      expect(stats).toHaveProperty('authenticatedConnections');
      expect(stats).toHaveProperty('totalMarketSubscriptions');
      expect(stats).toHaveProperty('totalOutcomeSubscriptions');
      expect(typeof stats.totalConnections).toBe('number');
    });
  });

  describe('Market Subscriptions', () => {
    it('should handle market subscription', (done) => {
      const marketId = 'test-market-1';
      
      clientSocket.emit('subscribe_market', { marketId });
      
      clientSocket.on('subscription_confirmed', (data: any) => {
        expect(data.type).toBe('market');
        expect(data.marketId).toBe(marketId);
        expect(data).toHaveProperty('timestamp');
        
        const subscribersCount = webSocketService.getMarketSubscribersCount(marketId);
        expect(subscribersCount).toBe(1);
        done();
      });
    });

    it('should handle market subscription with specific types', (done) => {
      const marketId = 'test-market-2';
      const subscriptionTypes = ['price_update', 'trade_executed'];
      
      clientSocket.emit('subscribe_market', { marketId, subscriptionTypes });
      
      clientSocket.on('subscription_confirmed', (data: any) => {
        expect(data.type).toBe('market');
        expect(data.marketId).toBe(marketId);
        expect(data.subscriptionTypes).toEqual(subscriptionTypes);
        done();
      });
    });

    it('should handle market unsubscription', (done) => {
      const marketId = 'test-market-3';
      
      // First subscribe
      clientSocket.emit('subscribe_market', { marketId });
      
      clientSocket.on('subscription_confirmed', () => {
        // Then unsubscribe
        clientSocket.emit('unsubscribe_market', { marketId });
      });
      
      clientSocket.on('unsubscription_confirmed', (data: any) => {
        expect(data.type).toBe('market');
        expect(data.marketId).toBe(marketId);
        
        const subscribersCount = webSocketService.getMarketSubscribersCount(marketId);
        expect(subscribersCount).toBe(0);
        done();
      });
    });
  });

  describe('Outcome Subscriptions', () => {
    it('should handle outcome subscription', (done) => {
      const outcomeId = 'test-outcome-1';
      
      clientSocket.emit('subscribe_outcome', { outcomeId });
      
      clientSocket.on('subscription_confirmed', (data: any) => {
        expect(data.type).toBe('outcome');
        expect(data.outcomeId).toBe(outcomeId);
        expect(data).toHaveProperty('timestamp');
        
        const subscribersCount = webSocketService.getOutcomeSubscribersCount(outcomeId);
        expect(subscribersCount).toBe(1);
        done();
      });
    });

    it('should handle outcome unsubscription', (done) => {
      const outcomeId = 'test-outcome-2';
      
      // First subscribe
      clientSocket.emit('subscribe_outcome', { outcomeId });
      
      clientSocket.on('subscription_confirmed', () => {
        // Then unsubscribe
        clientSocket.emit('unsubscribe_outcome', { outcomeId });
      });
      
      clientSocket.on('unsubscription_confirmed', (data: any) => {
        expect(data.type).toBe('outcome');
        expect(data.outcomeId).toBe(outcomeId);
        
        const subscribersCount = webSocketService.getOutcomeSubscribersCount(outcomeId);
        expect(subscribersCount).toBe(0);
        done();
      });
    });
  });

  describe('Broadcasting Updates', () => {
    it('should broadcast market updates to subscribed clients', (done) => {
      const marketId = 'test-market-broadcast';
      
      // Subscribe to market
      clientSocket.emit('subscribe_market', { marketId });
      
      clientSocket.on('subscription_confirmed', () => {
        // Broadcast update
        const update: MarketDataUpdate = {
          marketId,
          type: 'price_update',
          data: { price: 0.75, volume: 1000 },
          timestamp: new Date()
        };
        
        webSocketService.broadcastMarketUpdate(update);
      });
      
      clientSocket.on('market_update', (data: any) => {
        expect(data.marketId).toBe(marketId);
        expect(data.type).toBe('price_update');
        expect(data.data).toEqual({ price: 0.75, volume: 1000 });
        expect(data).toHaveProperty('timestamp');
        done();
      });
    });

    it('should broadcast outcome updates to subscribed clients', (done) => {
      const outcomeId = 'test-outcome-broadcast';
      const marketId = 'test-market-broadcast-2';
      
      // Subscribe to outcome
      clientSocket.emit('subscribe_outcome', { outcomeId });
      
      clientSocket.on('subscription_confirmed', () => {
        // Broadcast update
        const update: MarketDataUpdate = {
          marketId,
          outcomeId,
          type: 'order_book_update',
          data: { bids: [{ price: 0.6, quantity: 100 }], asks: [{ price: 0.7, quantity: 50 }] },
          timestamp: new Date()
        };
        
        webSocketService.broadcastOutcomeUpdate(update);
      });
      
      clientSocket.on('outcome_update', (data: any) => {
        expect(data.outcomeId).toBe(outcomeId);
        expect(data.type).toBe('order_book_update');
        expect(data.data).toHaveProperty('bids');
        expect(data.data).toHaveProperty('asks');
        done();
      });
    });

    it('should broadcast price updates', (done) => {
      const marketId = 'test-market-price';
      const outcomeId = 'test-outcome-price';
      
      // Subscribe to market
      clientSocket.emit('subscribe_market', { marketId });
      
      clientSocket.on('subscription_confirmed', () => {
        webSocketService.broadcastPriceUpdate(marketId, outcomeId, {
          currentPrice: 0.65,
          priceChange: 0.05,
          volume24h: 5000
        });
      });
      
      clientSocket.on('market_update', (data: any) => {
        expect(data.type).toBe('price_update');
        expect(data.data.currentPrice).toBe(0.65);
        expect(data.data.priceChange).toBe(0.05);
        expect(data.data.volume24h).toBe(5000);
        done();
      });
    });

    it('should broadcast trade execution updates', (done) => {
      const marketId = 'test-market-trade';
      const outcomeId = 'test-outcome-trade';
      
      // Subscribe to market
      clientSocket.emit('subscribe_market', { marketId });
      
      clientSocket.on('subscription_confirmed', () => {
        webSocketService.broadcastTradeExecution(marketId, outcomeId, {
          tradeId: 'trade-123',
          price: 0.7,
          quantity: 200,
          buyerId: 'buyer-1',
          sellerId: 'seller-1'
        });
      });
      
      clientSocket.on('market_update', (data: any) => {
        expect(data.type).toBe('trade_executed');
        expect(data.data.tradeId).toBe('trade-123');
        expect(data.data.price).toBe(0.7);
        expect(data.data.quantity).toBe(200);
        done();
      });
    });

    it('should broadcast market status changes', (done) => {
      const marketId = 'test-market-status';
      
      // Subscribe to market
      clientSocket.emit('subscribe_market', { marketId });
      
      clientSocket.on('subscription_confirmed', () => {
        webSocketService.broadcastMarketStatusChange(marketId, {
          previousStatus: 'ACTIVE',
          newStatus: 'CLOSED',
          reason: 'Market ended'
        });
      });
      
      clientSocket.on('market_update', (data: any) => {
        expect(data.type).toBe('market_status_change');
        expect(data.data.previousStatus).toBe('ACTIVE');
        expect(data.data.newStatus).toBe('CLOSED');
        expect(data.data.reason).toBe('Market ended');
        done();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid authentication gracefully', (done) => {
      const invalidClient = Client(`http://localhost:${(httpServer.address() as any).port}`, {
        auth: { token: 'invalid-token' }
      });

      invalidClient.on('connection_ack', (data: any) => {
        expect(data.isAuthenticated).toBe(false);
        invalidClient.disconnect();
        done();
      });
    });

    it('should not broadcast to unsubscribed clients', () => {
      const marketId = 'test-market-no-broadcast';
      
      // Don't subscribe, just try to broadcast
      webSocketService.broadcastMarketUpdate({
        marketId,
        type: 'price_update',
        data: { price: 0.5 },
        timestamp: new Date()
      });
      
      // Should not receive any update
      let updateReceived = false;
      clientSocket.on('market_update', () => {
        updateReceived = true;
      });
      
      setTimeout(() => {
        expect(updateReceived).toBe(false);
      }, 100);
    });
  });

  describe('Reconnection Handling', () => {
    it('should handle reconnection with subscription restoration', (done) => {
      const marketIds = ['market-1', 'market-2'];
      const outcomeIds = ['outcome-1'];
      const subscriptionTypes = ['price_update', 'trade_executed'];
      
      // Simulate reconnection
      webSocketService.handleReconnection(serverSocket, {
        marketIds,
        outcomeIds,
        subscriptionTypes
      });
      
      // Check that subscriptions were restored
      setTimeout(() => {
        expect(webSocketService.getMarketSubscribersCount('market-1')).toBeGreaterThan(0);
        expect(webSocketService.getMarketSubscribersCount('market-2')).toBeGreaterThan(0);
        expect(webSocketService.getOutcomeSubscribersCount('outcome-1')).toBeGreaterThan(0);
        done();
      }, 100);
    });
  });
});