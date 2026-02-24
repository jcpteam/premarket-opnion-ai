import { PrismaClient } from '@prisma/client';
import { UserRepository } from '../repositories/user.repository';
import { MarketRepository } from '../repositories/market.repository';
import { OrderRepository } from '../repositories/order.repository';
import { TradeRepository } from '../repositories/trade.repository';
import { PositionRepository } from '../repositories/position.repository';
import { RepositoryFactory } from '../repositories';

// Mock Prisma Client
jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn()
      },
      market: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn()
      },
      order: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn()
      },
      trade: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn()
      },
      position: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        upsert: jest.fn()
      },
      $connect: jest.fn(),
      $disconnect: jest.fn(),
      $transaction: jest.fn()
    }))
  };
});

describe('Repository Layer', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('UserRepository', () => {
    let userRepository: UserRepository;

    beforeEach(() => {
      userRepository = new UserRepository(mockPrisma);
    });

    it('should find user by wallet address', async () => {
      const mockUser = {
        id: 'user-1',
        walletAddress: '0x123',
        username: 'testuser',
        email: null,
        profileImage: null,
        isVerified: false,
        isAdmin: false,
        totalVolume: 0,
        totalTrades: 0,
        winRate: 0,
        profitLoss: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await userRepository.findByWalletAddress('0x123');

      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { walletAddress: '0x123' }
      });
    });

    it('should update trading stats', async () => {
      const mockUser = {
        id: 'user-1',
        totalVolume: 1000,
        totalTrades: 10,
        winRate: 0.6,
        profitLoss: 100
      };

      (mockPrisma.user.update as jest.Mock).mockResolvedValue(mockUser);

      const result = await userRepository.updateTradingStats('user-1', {
        totalVolume: 100,
        totalTrades: 1,
        winRate: 0.6,
        profitLoss: 10
      });

      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.update).toHaveBeenCalled();
    });

    it('should get top traders', async () => {
      const mockTraders = [
        { id: 'user-1', totalVolume: 10000, winRate: 0.8 },
        { id: 'user-2', totalVolume: 8000, winRate: 0.7 }
      ];

      (mockPrisma.user.findMany as jest.Mock).mockResolvedValue(mockTraders);

      const result = await userRepository.getTopTraders(10);

      expect(result).toEqual(mockTraders);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        orderBy: [
          { totalVolume: 'desc' },
          { winRate: 'desc' }
        ],
        take: 10
      });
    });
  });

  describe('MarketRepository', () => {
    let marketRepository: MarketRepository;

    beforeEach(() => {
      marketRepository = new MarketRepository(mockPrisma);
    });

    it('should find market with outcomes', async () => {
      const mockMarket = {
        id: 'market-1',
        title: 'Test Market',
        outcomes: [
          { id: 'outcome-1', name: 'Yes' },
          { id: 'outcome-2', name: 'No' }
        ]
      };

      (mockPrisma.market.findUnique as jest.Mock).mockResolvedValue(mockMarket);

      const result = await marketRepository.findWithOutcomes('market-1');

      expect(result).toEqual(mockMarket);
      expect(mockPrisma.market.findUnique).toHaveBeenCalledWith({
        where: { id: 'market-1' },
        include: {
          outcomes: true,
          creator: {
            select: {
              id: true,
              username: true,
              walletAddress: true
            }
          }
        }
      });
    });

    it('should search markets', async () => {
      const mockMarkets = [
        { id: 'market-1', title: 'Bitcoin Price' },
        { id: 'market-2', title: 'Bitcoin Prediction' }
      ];

      (mockPrisma.market.findMany as jest.Mock).mockResolvedValue(mockMarkets);

      const result = await marketRepository.search('Bitcoin');

      expect(result).toEqual(mockMarkets);
      expect(mockPrisma.market.findMany).toHaveBeenCalled();
    });

    it('should get active markets', async () => {
      const mockMarkets = [
        { id: 'market-1', status: 'ACTIVE' },
        { id: 'market-2', status: 'ACTIVE' }
      ];

      (mockPrisma.market.findMany as jest.Mock).mockResolvedValue(mockMarkets);

      const result = await marketRepository.getActiveMarkets();

      expect(result).toEqual(mockMarkets);
    });

    it('should get markets ready for resolution', async () => {
      const mockMarkets = [
        { id: 'market-1', status: 'ACTIVE', endDate: new Date('2020-01-01') }
      ];

      (mockPrisma.market.findMany as jest.Mock).mockResolvedValue(mockMarkets);

      const result = await marketRepository.getMarketsReadyForResolution();

      expect(result).toEqual(mockMarkets);
    });
  });

  describe('OrderRepository', () => {
    let orderRepository: OrderRepository;

    beforeEach(() => {
      orderRepository = new OrderRepository(mockPrisma);
    });

    it('should find orders by user', async () => {
      const mockOrders = [
        { id: 'order-1', userId: 'user-1', status: 'PENDING' },
        { id: 'order-2', userId: 'user-1', status: 'FILLED' }
      ];

      (mockPrisma.order.findMany as jest.Mock).mockResolvedValue(mockOrders);

      const result = await orderRepository.findByUser('user-1');

      expect(result).toEqual(mockOrders);
    });

    it('should find active orders', async () => {
      const mockOrders = [
        { id: 'order-1', status: 'PENDING' },
        { id: 'order-2', status: 'PARTIAL' }
      ];

      (mockPrisma.order.findMany as jest.Mock).mockResolvedValue(mockOrders);

      const result = await orderRepository.findActiveOrders('market-1', 'outcome-1');

      expect(result).toEqual(mockOrders);
      expect(mockPrisma.order.findMany).toHaveBeenCalledWith({
        where: {
          marketId: 'market-1',
          outcomeId: 'outcome-1',
          status: {
            in: ['PENDING', 'PARTIAL']
          }
        },
        orderBy: [
          { price: 'desc' },
          { createdAt: 'asc' }
        ]
      });
    });

    it('should cancel order', async () => {
      const mockOrder = { id: 'order-1', status: 'CANCELLED' };

      (mockPrisma.order.update as jest.Mock).mockResolvedValue(mockOrder);

      const result = await orderRepository.cancelOrder('order-1');

      expect(result.status).toBe('CANCELLED');
    });
  });

  describe('TradeRepository', () => {
    let tradeRepository: TradeRepository;

    beforeEach(() => {
      tradeRepository = new TradeRepository(mockPrisma);
    });

    it('should find trades by user', async () => {
      const mockTrades = [
        { id: 'trade-1', buyerId: 'user-1' },
        { id: 'trade-2', sellerId: 'user-1' }
      ];

      (mockPrisma.trade.findMany as jest.Mock).mockResolvedValue(mockTrades);

      const result = await tradeRepository.findByUser('user-1');

      expect(result).toEqual(mockTrades);
    });

    it('should get trade volume', async () => {
      (mockPrisma.trade.aggregate as jest.Mock).mockResolvedValue({
        _sum: { totalValue: 10000 }
      });

      const result = await tradeRepository.getTradeVolume('market-1');

      expect(result).toBe(10000);
    });

    it('should find recent trades', async () => {
      const mockTrades = [
        { id: 'trade-1', createdAt: new Date() },
        { id: 'trade-2', createdAt: new Date() }
      ];

      (mockPrisma.trade.findMany as jest.Mock).mockResolvedValue(mockTrades);

      const result = await tradeRepository.findRecent(50);

      expect(result).toEqual(mockTrades);
      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith({
        take: 50,
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' }
      });
    });
  });

  describe('PositionRepository', () => {
    let positionRepository: PositionRepository;

    beforeEach(() => {
      positionRepository = new PositionRepository(mockPrisma);
    });

    it('should find positions by user', async () => {
      const mockPositions = [
        { id: 'pos-1', userId: 'user-1', marketId: 'market-1' },
        { id: 'pos-2', userId: 'user-1', marketId: 'market-2' }
      ];

      (mockPrisma.position.findMany as jest.Mock).mockResolvedValue(mockPositions);

      const result = await positionRepository.findByUser('user-1');

      expect(result).toEqual(mockPositions);
    });

    it('should upsert position', async () => {
      const mockPosition = {
        id: 'pos-1',
        userId: 'user-1',
        marketId: 'market-1',
        outcomeId: 'outcome-1',
        quantity: 100,
        averagePrice: 0.5,
        totalCost: 50
      };

      (mockPrisma.position.upsert as jest.Mock).mockResolvedValue(mockPosition);

      const result = await positionRepository.upsertPosition({
        userId: 'user-1',
        marketId: 'market-1',
        outcomeId: 'outcome-1',
        quantity: 100,
        averagePrice: 0.5,
        totalCost: 50
      });

      expect(result).toEqual(mockPosition);
    });

    it('should update position value', async () => {
      const mockPosition = {
        id: 'pos-1',
        currentValue: 60,
        unrealizedPnL: 10
      };

      (mockPrisma.position.update as jest.Mock).mockResolvedValue(mockPosition);

      const result = await positionRepository.updatePositionValue('pos-1', 60, 10);

      expect(result.currentValue).toBe(60);
      expect(result.unrealizedPnL).toBe(10);
    });
  });

  describe('RepositoryFactory', () => {
    it('should create singleton instance', () => {
      const factory1 = RepositoryFactory.getInstance();
      const factory2 = RepositoryFactory.getInstance();

      expect(factory1).toBe(factory2);
    });

    it('should create repository instances', () => {
      const factory = RepositoryFactory.getInstance();

      const userRepo = factory.getUserRepository();
      const marketRepo = factory.getMarketRepository();
      const orderRepo = factory.getOrderRepository();
      const tradeRepo = factory.getTradeRepository();
      const positionRepo = factory.getPositionRepository();

      expect(userRepo).toBeInstanceOf(UserRepository);
      expect(marketRepo).toBeInstanceOf(MarketRepository);
      expect(orderRepo).toBeInstanceOf(OrderRepository);
      expect(tradeRepo).toBeInstanceOf(TradeRepository);
      expect(positionRepo).toBeInstanceOf(PositionRepository);
    });

    it('should reuse repository instances', () => {
      const factory = RepositoryFactory.getInstance();

      const userRepo1 = factory.getUserRepository();
      const userRepo2 = factory.getUserRepository();

      expect(userRepo1).toBe(userRepo2);
    });
  });
});
