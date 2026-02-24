import { PrismaClient } from '@prisma/client';
import { ResolutionService } from '../services/resolution.service';
import { WebSocketService } from '../services/websocket.service';

// Mock dependencies
jest.mock('../config/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('ResolutionService', () => {
  let resolutionService: ResolutionService;
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockWebSocketService: jest.Mocked<WebSocketService>;

  beforeEach(() => {
    // Create mock Prisma client
    mockPrisma = {
      market: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn()
      },
      resolution: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn()
      },
      position: {
        findMany: jest.fn(),
        update: jest.fn()
      },
      user: {
        update: jest.fn()
      }
    } as any;

    // Create mock WebSocket service
    mockWebSocketService = {
      broadcastMarketStatusChange: jest.fn()
    } as any;

    resolutionService = new ResolutionService(mockPrisma, mockWebSocketService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('markMarketsReadyForResolution', () => {
    it('should mark expired active markets as closed', async () => {
      const now = new Date();
      const expiredMarket = {
        id: 'market-1',
        status: 'ACTIVE',
        endDate: new Date(now.getTime() - 1000)
      };

      (mockPrisma.market.findMany as jest.Mock).mockResolvedValue([expiredMarket]);
      (mockPrisma.market.update as jest.Mock).mockResolvedValue({ ...expiredMarket, status: 'CLOSED' });

      const result = await resolutionService.markMarketsReadyForResolution();

      expect(result).toEqual(['market-1']);
      expect(mockPrisma.market.update).toHaveBeenCalledWith({
        where: { id: 'market-1' },
        data: { status: 'CLOSED' }
      });
      expect(mockWebSocketService.broadcastMarketStatusChange).toHaveBeenCalled();
    });

    it('should not mark markets that have not expired', async () => {
      (mockPrisma.market.findMany as jest.Mock).mockResolvedValue([]);

      const result = await resolutionService.markMarketsReadyForResolution();

      expect(result).toEqual([]);
      expect(mockPrisma.market.update).not.toHaveBeenCalled();
    });
  });

  describe('resolveMarket', () => {
    const validRequest = {
      marketId: 'market-1',
      winningOutcomeId: 'outcome-1',
      evidence: 'Official results',
      resolutionSource: 'Official source',
      resolvedBy: 'admin-1'
    };

    it('should resolve a market successfully', async () => {
      const market = {
        id: 'market-1',
        status: 'CLOSED',
        outcomes: [
          { id: 'outcome-1', name: 'Yes' },
          { id: 'outcome-2', name: 'No' }
        ]
      };

      const resolution = {
        id: 'resolution-1',
        marketId: 'market-1',
        outcome: 'outcome-1',
        status: 'PENDING'
      };

      const positions = [
        {
          id: 'position-1',
          userId: 'user-1',
          quantity: 100,
          averagePrice: 0.6,
          totalCost: 60
        }
      ];

      (mockPrisma.market.findUnique as jest.Mock).mockResolvedValue(market);
      (mockPrisma.resolution.create as jest.Mock).mockResolvedValue(resolution);
      (mockPrisma.market.update as jest.Mock).mockResolvedValue({ ...market, status: 'RESOLVED' });
      (mockPrisma.position.findMany as jest.Mock).mockResolvedValue(positions);
      (mockPrisma.user.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.position.update as jest.Mock).mockResolvedValue({});

      const result = await resolutionService.resolveMarket(validRequest);

      expect(result).toHaveProperty('resolution');
      expect(result).toHaveProperty('payouts');
      expect(result).toHaveProperty('totalPayout');
      expect(result).toHaveProperty('affectedUsers');
      expect(result.payouts.length).toBe(1);
      expect(result.payouts[0].payout).toBe(100); // 100 shares * $1
      expect(result.payouts[0].profit).toBe(40); // 100 - 60
      expect(mockWebSocketService.broadcastMarketStatusChange).toHaveBeenCalled();
    });

    it('should throw error if market not found', async () => {
      (mockPrisma.market.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(resolutionService.resolveMarket(validRequest)).rejects.toThrow('Market not found');
    });

    it('should throw error if market already resolved', async () => {
      const market = {
        id: 'market-1',
        status: 'RESOLVED',
        outcomes: []
      };

      (mockPrisma.market.findUnique as jest.Mock).mockResolvedValue(market);

      await expect(resolutionService.resolveMarket(validRequest)).rejects.toThrow('Market is already resolved');
    });

    it('should throw error if market is still active', async () => {
      const market = {
        id: 'market-1',
        status: 'ACTIVE',
        outcomes: []
      };

      (mockPrisma.market.findUnique as jest.Mock).mockResolvedValue(market);

      await expect(resolutionService.resolveMarket(validRequest)).rejects.toThrow('Market must be closed before resolution');
    });

    it('should throw error if winning outcome is invalid', async () => {
      const market = {
        id: 'market-1',
        status: 'CLOSED',
        outcomes: [
          { id: 'outcome-2', name: 'No' }
        ]
      };

      (mockPrisma.market.findUnique as jest.Mock).mockResolvedValue(market);

      await expect(resolutionService.resolveMarket(validRequest)).rejects.toThrow('Invalid winning outcome');
    });

    it('should calculate payouts correctly for multiple positions', async () => {
      const market = {
        id: 'market-1',
        status: 'CLOSED',
        outcomes: [{ id: 'outcome-1', name: 'Yes' }]
      };

      const positions = [
        { id: 'position-1', userId: 'user-1', quantity: 100, averagePrice: 0.6, totalCost: 60 },
        { id: 'position-2', userId: 'user-2', quantity: 50, averagePrice: 0.7, totalCost: 35 }
      ];

      (mockPrisma.market.findUnique as jest.Mock).mockResolvedValue(market);
      (mockPrisma.resolution.create as jest.Mock).mockResolvedValue({});
      (mockPrisma.market.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.position.findMany as jest.Mock).mockResolvedValue(positions);
      (mockPrisma.user.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.position.update as jest.Mock).mockResolvedValue({});

      const result = await resolutionService.resolveMarket(validRequest);

      expect(result.payouts.length).toBe(2);
      expect(result.totalPayout).toBe(150); // 100 + 50
      expect(result.affectedUsers).toBe(2);
      expect(result.payouts[0].profit).toBe(40); // 100 - 60
      expect(result.payouts[1].profit).toBe(15); // 50 - 35
    });
  });

  describe('disputeResolution', () => {
    it('should dispute a pending resolution', async () => {
      const resolution = {
        id: 'resolution-1',
        marketId: 'market-1',
        status: 'PENDING',
        disputeDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
        market: { id: 'market-1' }
      };

      (mockPrisma.resolution.findUnique as jest.Mock).mockResolvedValue(resolution);
      (mockPrisma.resolution.update as jest.Mock).mockResolvedValue({ ...resolution, status: 'DISPUTED' });
      (mockPrisma.market.update as jest.Mock).mockResolvedValue({});

      const result = await resolutionService.disputeResolution({
        resolutionId: 'resolution-1',
        disputedBy: 'user-1',
        reason: 'Incorrect outcome',
        evidence: 'Counter evidence'
      });

      expect(result.status).toBe('DISPUTED');
      expect(mockPrisma.market.update).toHaveBeenCalledWith({
        where: { id: 'market-1' },
        data: { status: 'CLOSED' }
      });
      expect(mockWebSocketService.broadcastMarketStatusChange).toHaveBeenCalled();
    });

    it('should throw error if resolution not found', async () => {
      (mockPrisma.resolution.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(resolutionService.disputeResolution({
        resolutionId: 'invalid',
        disputedBy: 'user-1',
        reason: 'Test'
      })).rejects.toThrow('Resolution not found');
    });

    it('should throw error if resolution already finalized', async () => {
      const resolution = {
        id: 'resolution-1',
        status: 'RESOLVED',
        market: { id: 'market-1' }
      };

      (mockPrisma.resolution.findUnique as jest.Mock).mockResolvedValue(resolution);

      await expect(resolutionService.disputeResolution({
        resolutionId: 'resolution-1',
        disputedBy: 'user-1',
        reason: 'Test'
      })).rejects.toThrow('Resolution is already finalized and cannot be disputed');
    });

    it('should throw error if dispute period expired', async () => {
      const resolution = {
        id: 'resolution-1',
        status: 'PENDING',
        disputeDeadline: new Date(Date.now() - 1000),
        market: { id: 'market-1' }
      };

      (mockPrisma.resolution.findUnique as jest.Mock).mockResolvedValue(resolution);

      await expect(resolutionService.disputeResolution({
        resolutionId: 'resolution-1',
        disputedBy: 'user-1',
        reason: 'Test'
      })).rejects.toThrow('Dispute period has expired');
    });
  });

  describe('finalizeResolution', () => {
    it('should finalize a pending resolution after dispute period', async () => {
      const resolution = {
        id: 'resolution-1',
        marketId: 'market-1',
        status: 'PENDING',
        disputeDeadline: new Date(Date.now() - 1000)
      };

      (mockPrisma.resolution.findUnique as jest.Mock).mockResolvedValue(resolution);
      (mockPrisma.resolution.update as jest.Mock).mockResolvedValue({ ...resolution, status: 'RESOLVED' });

      const result = await resolutionService.finalizeResolution('resolution-1');

      expect(result.status).toBe('RESOLVED');
    });

    it('should throw error if resolution not found', async () => {
      (mockPrisma.resolution.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(resolutionService.finalizeResolution('invalid')).rejects.toThrow('Resolution not found');
    });

    it('should throw error if already finalized', async () => {
      const resolution = {
        id: 'resolution-1',
        status: 'RESOLVED'
      };

      (mockPrisma.resolution.findUnique as jest.Mock).mockResolvedValue(resolution);

      await expect(resolutionService.finalizeResolution('resolution-1')).rejects.toThrow('Resolution is already finalized');
    });

    it('should throw error if disputed', async () => {
      const resolution = {
        id: 'resolution-1',
        status: 'DISPUTED'
      };

      (mockPrisma.resolution.findUnique as jest.Mock).mockResolvedValue(resolution);

      await expect(resolutionService.finalizeResolution('resolution-1')).rejects.toThrow('Resolution is disputed and cannot be finalized');
    });

    it('should throw error if dispute period not expired', async () => {
      const resolution = {
        id: 'resolution-1',
        status: 'PENDING',
        disputeDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      (mockPrisma.resolution.findUnique as jest.Mock).mockResolvedValue(resolution);

      await expect(resolutionService.finalizeResolution('resolution-1')).rejects.toThrow('Dispute period has not yet expired');
    });
  });

  describe('getResolutionStatus', () => {
    it('should return resolution status for a market', async () => {
      const resolution = {
        id: 'resolution-1',
        marketId: 'market-1',
        status: 'PENDING',
        resolver: { id: 'admin-1', username: 'admin', walletAddress: '0x123' },
        market: { id: 'market-1', title: 'Test Market', status: 'RESOLVED', winningOutcome: 'outcome-1' }
      };

      (mockPrisma.resolution.findFirst as jest.Mock).mockResolvedValue(resolution);

      const result = await resolutionService.getResolutionStatus('market-1');

      expect(result).toEqual(resolution);
    });
  });

  describe('getPendingResolutions', () => {
    it('should return all pending resolutions', async () => {
      const resolutions = [
        {
          id: 'resolution-1',
          status: 'PENDING',
          market: { id: 'market-1', title: 'Market 1', endDate: new Date() },
          resolver: { id: 'admin-1', username: 'admin' }
        }
      ];

      (mockPrisma.resolution.findMany as jest.Mock).mockResolvedValue(resolutions);

      const result = await resolutionService.getPendingResolutions();

      expect(result).toEqual(resolutions);
      expect(mockPrisma.resolution.findMany).toHaveBeenCalledWith({
        where: { status: 'PENDING' },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' }
      });
    });
  });

  describe('getDisputedResolutions', () => {
    it('should return all disputed resolutions', async () => {
      const resolutions = [
        {
          id: 'resolution-1',
          status: 'DISPUTED',
          market: { id: 'market-1', title: 'Market 1' },
          resolver: { id: 'admin-1', username: 'admin' }
        }
      ];

      (mockPrisma.resolution.findMany as jest.Mock).mockResolvedValue(resolutions);

      const result = await resolutionService.getDisputedResolutions();

      expect(result).toEqual(resolutions);
      expect(mockPrisma.resolution.findMany).toHaveBeenCalledWith({
        where: { status: 'DISPUTED' },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' }
      });
    });
  });

  describe('autoFinalizeResolutions', () => {
    it('should auto-finalize expired pending resolutions', async () => {
      const expiredResolutions = [
        {
          id: 'resolution-1',
          marketId: 'market-1',
          status: 'PENDING',
          disputeDeadline: new Date(Date.now() - 1000)
        }
      ];

      (mockPrisma.resolution.findMany as jest.Mock).mockResolvedValue(expiredResolutions);
      (mockPrisma.resolution.findUnique as jest.Mock).mockResolvedValue(expiredResolutions[0]);
      (mockPrisma.resolution.update as jest.Mock).mockResolvedValue({ ...expiredResolutions[0], status: 'RESOLVED' });

      const count = await resolutionService.autoFinalizeResolutions();

      expect(count).toBe(1);
    });

    it('should handle errors gracefully when auto-finalizing', async () => {
      const expiredResolutions = [
        {
          id: 'resolution-1',
          marketId: 'market-1',
          status: 'PENDING',
          disputeDeadline: new Date(Date.now() - 1000)
        }
      ];

      (mockPrisma.resolution.findMany as jest.Mock).mockResolvedValue(expiredResolutions);
      (mockPrisma.resolution.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      const count = await resolutionService.autoFinalizeResolutions();

      expect(count).toBe(0);
    });
  });

  describe('Validation', () => {
    it('should throw error if marketId is missing', async () => {
      await expect(resolutionService.resolveMarket({
        marketId: '',
        winningOutcomeId: 'outcome-1',
        resolvedBy: 'admin-1'
      })).rejects.toThrow('Market ID is required');
    });

    it('should throw error if winningOutcomeId is missing', async () => {
      await expect(resolutionService.resolveMarket({
        marketId: 'market-1',
        winningOutcomeId: '',
        resolvedBy: 'admin-1'
      })).rejects.toThrow('Winning outcome ID is required');
    });

    it('should throw error if resolvedBy is missing', async () => {
      await expect(resolutionService.resolveMarket({
        marketId: 'market-1',
        winningOutcomeId: 'outcome-1',
        resolvedBy: ''
      })).rejects.toThrow('Resolver ID is required');
    });
  });
});
