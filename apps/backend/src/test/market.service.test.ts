import { MarketService, CreateMarketRequest } from '../services/market.service';
import { PrismaClient } from '@prisma/client';

// Mock Prisma Client
const mockPrisma = {
  $transaction: jest.fn(),
  market: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    aggregate: jest.fn()
  },
  outcome: {
    create: jest.fn()
  }
};

describe('MarketService', () => {
  let marketService: MarketService;

  beforeEach(() => {
    jest.clearAllMocks();
    marketService = new MarketService(mockPrisma as unknown as PrismaClient);
  });

  describe('createMarket', () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);

    const validBinaryMarketRequest: CreateMarketRequest = {
      title: 'Will Bitcoin reach $100k by 2024?',
      description: 'A prediction market about Bitcoin price',
      category: 'Cryptocurrency',
      tags: ['bitcoin', 'crypto'],
      type: 'binary',
      outcomes: [
        { name: 'Yes', description: 'Bitcoin reaches $100k' },
        { name: 'No', description: 'Bitcoin does not reach $100k' }
      ],
      endDate: futureDate,
      creatorId: 'user123'
    };

    const validMultiOutcomeMarketRequest: CreateMarketRequest = {
      title: 'Who will win the 2024 election?',
      description: 'Presidential election prediction',
      category: 'Politics',
      tags: ['election', 'politics'],
      type: 'multi-outcome',
      outcomes: [
        { name: 'Candidate A' },
        { name: 'Candidate B' },
        { name: 'Candidate C' }
      ],
      endDate: futureDate,
      creatorId: 'user123'
    };

    it('should create a binary market successfully', async () => {
      const mockMarket = {
        id: 'market123',
        title: validBinaryMarketRequest.title,
        type: 'BINARY',
        status: 'ACTIVE',
        creatorId: 'user123'
      };

      const mockOutcomes = [
        { id: 'outcome1', name: 'Yes', marketId: 'market123', currentPrice: 0.5 },
        { id: 'outcome2', name: 'No', marketId: 'market123', currentPrice: 0.5 }
      ];

      const mockMarketWithOutcomes = {
        ...mockMarket,
        outcomes: mockOutcomes,
        creator: { id: 'user123', walletAddress: '0x123', username: 'testuser' }
      };

      mockPrisma.$transaction.mockResolvedValue({
        market: mockMarket,
        outcomes: mockOutcomes
      });

      mockPrisma.market.findUnique.mockResolvedValue(mockMarketWithOutcomes);

      const result = await marketService.createMarket(validBinaryMarketRequest);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(result).toEqual(mockMarketWithOutcomes);
      expect(result.outcomes).toHaveLength(2);
      expect(result.type).toBe('BINARY');
    });

    it('should create a multi-outcome market successfully', async () => {
      const mockMarket = {
        id: 'market456',
        title: validMultiOutcomeMarketRequest.title,
        type: 'MULTI_OUTCOME',
        status: 'ACTIVE',
        creatorId: 'user123'
      };

      const mockOutcomes = [
        { id: 'outcome1', name: 'Candidate A', marketId: 'market456', currentPrice: 0.33 },
        { id: 'outcome2', name: 'Candidate B', marketId: 'market456', currentPrice: 0.33 },
        { id: 'outcome3', name: 'Candidate C', marketId: 'market456', currentPrice: 0.33 }
      ];

      const mockMarketWithOutcomes = {
        ...mockMarket,
        outcomes: mockOutcomes,
        creator: { id: 'user123', walletAddress: '0x123', username: 'testuser' }
      };

      mockPrisma.$transaction.mockResolvedValue({
        market: mockMarket,
        outcomes: mockOutcomes
      });

      mockPrisma.market.findUnique.mockResolvedValue(mockMarketWithOutcomes);

      const result = await marketService.createMarket(validMultiOutcomeMarketRequest);

      expect(result.outcomes).toHaveLength(3);
      expect(result.type).toBe('MULTI_OUTCOME');
    });

    it('should reject market with empty title', async () => {
      const invalidRequest = {
        ...validBinaryMarketRequest,
        title: ''
      };

      await expect(marketService.createMarket(invalidRequest))
        .rejects.toThrow('Market title is required');
    });

    it('should reject market with empty description', async () => {
      const invalidRequest = {
        ...validBinaryMarketRequest,
        description: ''
      };

      await expect(marketService.createMarket(invalidRequest))
        .rejects.toThrow('Market description is required');
    });

    it('should reject market with past end date', async () => {
      const invalidRequest = {
        ...validBinaryMarketRequest,
        endDate: new Date('2020-01-01')
      };

      await expect(marketService.createMarket(invalidRequest))
        .rejects.toThrow('End date must be in the future');
    });

    it('should reject binary market with wrong number of outcomes', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      
      const invalidRequest = {
        ...validBinaryMarketRequest,
        endDate: futureDate,
        outcomes: [{ name: 'Only one outcome' }]
      };

      await expect(marketService.createMarket(invalidRequest))
        .rejects.toThrow('Binary markets must have exactly 2 outcomes');
    });

    it('should reject multi-outcome market with too few outcomes', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      
      const invalidRequest = {
        ...validMultiOutcomeMarketRequest,
        endDate: futureDate,
        outcomes: [
          { name: 'Outcome 1' },
          { name: 'Outcome 2' }
        ]
      };

      await expect(marketService.createMarket(invalidRequest))
        .rejects.toThrow('Multi-outcome markets must have between 3 and 10 outcomes');
    });

    it('should reject multi-outcome market with too many outcomes', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      
      const invalidRequest = {
        ...validMultiOutcomeMarketRequest,
        endDate: futureDate,
        outcomes: Array.from({ length: 11 }, (_, i) => ({ name: `Outcome ${i + 1}` }))
      };

      await expect(marketService.createMarket(invalidRequest))
        .rejects.toThrow('Multi-outcome markets must have between 3 and 10 outcomes');
    });

    it('should reject market with duplicate outcome names', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      
      const invalidRequest = {
        ...validBinaryMarketRequest,
        endDate: futureDate,
        outcomes: [
          { name: 'Yes' },
          { name: 'Yes' }
        ]
      };

      await expect(marketService.createMarket(invalidRequest))
        .rejects.toThrow('Outcome names must be unique');
    });

    it('should reject market with title too long', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      
      const invalidRequest = {
        ...validBinaryMarketRequest,
        endDate: futureDate,
        title: 'A'.repeat(201)
      };

      await expect(marketService.createMarket(invalidRequest))
        .rejects.toThrow('Market title must be 200 characters or less');
    });

    it('should reject market with too many tags', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      
      const invalidRequest = {
        ...validBinaryMarketRequest,
        endDate: futureDate,
        tags: Array.from({ length: 11 }, (_, i) => `tag${i}`)
      };

      await expect(marketService.createMarket(invalidRequest))
        .rejects.toThrow('Maximum 10 tags allowed');
    });
  });

  describe('getMarketById', () => {
    it('should return market with outcomes and creator', async () => {
      const mockMarket = {
        id: 'market123',
        title: 'Test Market',
        outcomes: [
          { id: 'outcome1', name: 'Yes' },
          { id: 'outcome2', name: 'No' }
        ],
        creator: {
          id: 'user123',
          walletAddress: '0x123',
          username: 'testuser'
        }
      };

      mockPrisma.market.findUnique.mockResolvedValue(mockMarket);

      const result = await marketService.getMarketById('market123');

      expect(mockPrisma.market.findUnique).toHaveBeenCalledWith({
        where: { id: 'market123' },
        include: {
          outcomes: { orderBy: { createdAt: 'asc' } },
          creator: {
            select: {
              id: true,
              walletAddress: true,
              username: true
            }
          }
        }
      });

      expect(result).toEqual(mockMarket);
    });

    it('should return null for non-existent market', async () => {
      mockPrisma.market.findUnique.mockResolvedValue(null);

      const result = await marketService.getMarketById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getMarkets', () => {
    it('should return markets with pagination', async () => {
      const mockMarkets = [
        {
          id: 'market1',
          title: 'Market 1',
          outcomes: [],
          creator: { id: 'user1', walletAddress: '0x1' }
        },
        {
          id: 'market2',
          title: 'Market 2',
          outcomes: [],
          creator: { id: 'user2', walletAddress: '0x2' }
        }
      ];

      mockPrisma.market.count.mockResolvedValue(2);
      mockPrisma.market.findMany.mockResolvedValue(mockMarkets);

      const result = await marketService.getMarkets({
        page: 1,
        limit: 10
      });

      expect(result.markets).toEqual(mockMarkets);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(1);
    });

    it('should filter markets by status', async () => {
      mockPrisma.market.count.mockResolvedValue(1);
      mockPrisma.market.findMany.mockResolvedValue([]);

      await marketService.getMarkets({
        status: 'ACTIVE' as any
      });

      expect(mockPrisma.market.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'ACTIVE' }
        })
      );
    });

    it('should search markets by title and description', async () => {
      mockPrisma.market.count.mockResolvedValue(1);
      mockPrisma.market.findMany.mockResolvedValue([]);

      await marketService.getMarkets({
        search: 'bitcoin'
      });

      expect(mockPrisma.market.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { title: { search: 'bitcoin' } },
              { description: { search: 'bitcoin' } },
              { title: { contains: 'bitcoin', mode: 'insensitive' } },
              { description: { contains: 'bitcoin', mode: 'insensitive' } },
              { category: { contains: 'bitcoin', mode: 'insensitive' } }
            ]
          }
        })
      );
    });
  });

  describe('updateMarket', () => {
    it('should update market successfully', async () => {
      const existingMarket = {
        id: 'market123',
        title: 'Old Title',
        status: 'ACTIVE',
        creatorId: 'user123',
        creator: { id: 'user123' }
      };

      const updatedMarket = {
        ...existingMarket,
        title: 'New Title'
      };

      mockPrisma.market.findUnique.mockResolvedValue(existingMarket);
      mockPrisma.market.update.mockResolvedValue(updatedMarket);
      mockPrisma.market.findUnique.mockResolvedValueOnce(existingMarket)
        .mockResolvedValueOnce(updatedMarket);

      await marketService.updateMarket(
        'market123',
        { title: 'New Title' },
        'user123'
      );

      expect(mockPrisma.market.update).toHaveBeenCalledWith({
        where: { id: 'market123' },
        data: {
          title: 'New Title',
          updatedAt: expect.any(Date)
        }
      });
    });

    it('should reject update for non-existent market', async () => {
      mockPrisma.market.findUnique.mockResolvedValue(null);

      await expect(marketService.updateMarket('nonexistent', {}, 'user123'))
        .rejects.toThrow('Market not found');
    });

    it('should reject update for resolved market', async () => {
      const resolvedMarket = {
        id: 'market123',
        status: 'RESOLVED',
        creator: { id: 'user123' }
      };

      mockPrisma.market.findUnique.mockResolvedValue(resolvedMarket);

      await expect(marketService.updateMarket('market123', {}, 'user123'))
        .rejects.toThrow('Cannot update resolved market');
    });
  });

  describe('closeMarket', () => {
    it('should close active market successfully', async () => {
      const activeMarket = {
        id: 'market123',
        status: 'ACTIVE',
        creator: { id: 'user123' }
      };

      const closedMarket = {
        ...activeMarket,
        status: 'CLOSED'
      };

      mockPrisma.market.findUnique.mockResolvedValueOnce(activeMarket)
        .mockResolvedValueOnce(closedMarket);
      mockPrisma.market.update.mockResolvedValue(closedMarket);

      await marketService.closeMarket('market123', 'user123');

      expect(mockPrisma.market.update).toHaveBeenCalledWith({
        where: { id: 'market123' },
        data: {
          status: 'CLOSED',
          updatedAt: expect.any(Date)
        }
      });
    });

    it('should reject closing non-active market', async () => {
      const closedMarket = {
        id: 'market123',
        status: 'CLOSED',
        creator: { id: 'user123' }
      };

      mockPrisma.market.findUnique.mockResolvedValue(closedMarket);

      await expect(marketService.closeMarket('market123', 'user123'))
        .rejects.toThrow('Market is not active and cannot be closed');
    });
  });

  describe('getMarketStats', () => {
    it('should return market statistics', async () => {
      mockPrisma.market.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0);

      mockPrisma.market.aggregate.mockResolvedValue({
        _sum: { totalVolume: 1000 },
        _avg: { totalVolume: 200 }
      });

      const result = await marketService.getMarketStats();

      expect(result).toEqual({
        totalMarkets: 5,
        activeMarkets: 3,
        closedMarkets: 1,
        resolvedMarkets: 1,
        disputedMarkets: 0,
        totalVolume: 1000,
        averageVolume: 200
      });
    });
  });
});