import { PrismaClient } from '@prisma/client';
import { TradeService, ExecuteTradeRequest } from '../services/trade.service';
import { OrderBookService } from '../services/orderbook.service';

// Mock Prisma Client
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  outcome: {
    findUnique: jest.fn(),
  },
  order: {
    findUnique: jest.fn(),
  },
  trade: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  position: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  market: {
    update: jest.fn(),
  },
  $transaction: jest.fn(),
} as unknown as PrismaClient;

// Mock OrderBookService
const mockOrderBookService = {} as OrderBookService;

describe('TradeService', () => {
  let tradeService: TradeService;
  const mockMarketId = 'market-1';
  const mockOutcomeId = 'outcome-1';
  const mockBuyerId = 'buyer-1';
  const mockSellerId = 'seller-1';
  const mockBuyOrderId = 'buy-order-1';
  const mockSellOrderId = 'sell-order-1';

  beforeEach(() => {
    tradeService = new TradeService(mockPrisma, mockOrderBookService);
    jest.clearAllMocks();
  });

  describe('executeTrade', () => {
    const validTradeRequest: ExecuteTradeRequest = {
      marketId: mockMarketId,
      outcomeId: mockOutcomeId,
      buyerId: mockBuyerId,
      sellerId: mockSellerId,
      buyOrderId: mockBuyOrderId,
      sellOrderId: mockSellOrderId,
      quantity: 100,
      price: 0.6,
      totalValue: 60,
      buyerFee: 0.12,
      sellerFee: 0.12
    };

    const setupValidationMocks = () => {
      // Mock validation dependencies
      (mockPrisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce({ id: mockBuyerId }) // buyer
        .mockResolvedValueOnce({ id: mockSellerId }); // seller

      (mockPrisma.outcome.findUnique as jest.Mock).mockResolvedValue({
        id: mockOutcomeId,
        currentPrice: 0.65,
        market: {
          id: mockMarketId,
          status: 'ACTIVE'
        }
      });

      (mockPrisma.order.findUnique as jest.Mock)
        .mockResolvedValueOnce({
          id: mockBuyOrderId,
          userId: mockBuyerId
        })
        .mockResolvedValueOnce({
          id: mockSellOrderId,
          userId: mockSellerId
        });
    };

    it('should execute trade successfully with new positions', async () => {
      setupValidationMocks();
      
      const mockTrade = {
        id: 'trade-1',
        ...validTradeRequest,
        createdAt: new Date()
      };

      // Mock transaction
      (mockPrisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          trade: {
            create: jest.fn().mockResolvedValue(mockTrade)
          },
          position: {
            findUnique: jest.fn()
              .mockResolvedValueOnce(null) // Buyer has no existing position
              .mockResolvedValueOnce(null), // Seller has no existing position
            create: jest.fn()
              .mockResolvedValueOnce({
                id: 'position-1',
                userId: mockBuyerId,
                marketId: mockMarketId,
                outcomeId: mockOutcomeId,
                quantity: 100,
                averagePrice: 0.6,
                totalCost: 60,
                currentValue: 65,
                unrealizedPnL: 5
              })
              .mockResolvedValueOnce({
                id: 'position-2',
                userId: mockSellerId,
                marketId: mockMarketId,
                outcomeId: mockOutcomeId,
                quantity: -100,
                averagePrice: 0.6,
                totalCost: -60,
                currentValue: -65,
                unrealizedPnL: -5
              })
          },
          outcome: {
            findUnique: jest.fn().mockResolvedValue({
              currentPrice: 0.65
            })
          },
          market: {
            update: jest.fn()
          },
          user: {
            update: jest.fn()
          }
        };

        return await callback(mockTx);
      });

      const result = await tradeService.executeTrade(validTradeRequest);

      expect(result.trade).toBeDefined();
      expect(result.trade.id).toBe('trade-1');
      expect(result.balanceUpdates).toHaveLength(2);
      expect(result.positionUpdates).toHaveLength(2);
      expect(result.auditLog).toHaveLength(2);

      // Verify balance updates
      expect(result.balanceUpdates[0].userId).toBe(mockBuyerId);
      expect(result.balanceUpdates[0].balanceChange).toBe(-60.12); // -(totalValue + buyerFee)
      expect(result.balanceUpdates[1].userId).toBe(mockSellerId);
      expect(result.balanceUpdates[1].balanceChange).toBe(59.88); // totalValue - sellerFee

      // Verify position updates
      expect(result.positionUpdates[0].userId).toBe(mockBuyerId);
      expect(result.positionUpdates[0].quantityChange).toBe(100);
      expect(result.positionUpdates[1].userId).toBe(mockSellerId);
      expect(result.positionUpdates[1].quantityChange).toBe(-100);

      // Verify audit log
      expect(result.auditLog[0].action).toBe('TRADE_EXECUTED');
      expect(result.auditLog[0].userId).toBe(mockBuyerId);
      expect(result.auditLog[1].userId).toBe(mockSellerId);
    });

    it('should execute trade successfully with existing positions', async () => {
      setupValidationMocks();
      
      const mockTrade = {
        id: 'trade-1',
        ...validTradeRequest,
        createdAt: new Date()
      };

      const existingBuyerPosition = {
        id: 'position-1',
        userId: mockBuyerId,
        marketId: mockMarketId,
        outcomeId: mockOutcomeId,
        quantity: 50,
        averagePrice: 0.55,
        totalCost: 27.5,
        currentValue: 32.5,
        unrealizedPnL: 5
      };

      const existingSellerPosition = {
        id: 'position-2',
        userId: mockSellerId,
        marketId: mockMarketId,
        outcomeId: mockOutcomeId,
        quantity: 200,
        averagePrice: 0.5,
        totalCost: 100,
        currentValue: 130,
        unrealizedPnL: 30
      };

      // Mock transaction with existing positions
      (mockPrisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          trade: {
            create: jest.fn().mockResolvedValue(mockTrade)
          },
          position: {
            findUnique: jest.fn()
              .mockResolvedValueOnce(existingBuyerPosition) // Buyer has existing position
              .mockResolvedValueOnce(existingSellerPosition), // Seller has existing position
            update: jest.fn()
              .mockResolvedValueOnce({
                ...existingBuyerPosition,
                quantity: 150, // 50 + 100
                averagePrice: 0.583, // Weighted average
                totalCost: 87.5, // 27.5 + 60
                currentValue: 97.5, // 150 * 0.65
                unrealizedPnL: 10 // 97.5 - 87.5
              })
              .mockResolvedValueOnce({
                ...existingSellerPosition,
                quantity: 100, // 200 - 100
                averagePrice: 0.5,
                totalCost: 50, // Reduced proportionally
                currentValue: 65, // 100 * 0.65
                unrealizedPnL: 15 // 65 - 50
              })
          },
          outcome: {
            findUnique: jest.fn().mockResolvedValue({
              currentPrice: 0.65
            })
          },
          market: {
            update: jest.fn()
          },
          user: {
            update: jest.fn()
          }
        };

        return await callback(mockTx);
      });

      const result = await tradeService.executeTrade(validTradeRequest);

      expect(result.trade).toBeDefined();
      expect(result.positionUpdates).toHaveLength(2);
      
      // Buyer position should be updated (not created)
      expect(result.positionUpdates[0].newQuantity).toBe(150);
      expect(result.positionUpdates[0].newAveragePrice).toBeCloseTo(0.583, 2);
      
      // Seller position should be updated (reduced)
      expect(result.positionUpdates[1].newQuantity).toBe(100);
    });

    it('should validate trade request parameters', async () => {
      const invalidRequests = [
        {
          ...validTradeRequest,
          marketId: '', // Invalid market ID
        },
        {
          ...validTradeRequest,
          buyerId: '', // Invalid buyer ID
        },
        {
          ...validTradeRequest,
          quantity: 0, // Invalid quantity
        },
        {
          ...validTradeRequest,
          price: 1.5, // Invalid price
        },
        {
          ...validTradeRequest,
          totalValue: -10, // Invalid total value
        }
      ];

      for (const request of invalidRequests) {
        await expect(tradeService.executeTrade(request)).rejects.toThrow();
      }
    });

    it('should reject trade when buyer not found', async () => {
      // Reset mocks for this specific test
      jest.clearAllMocks();
      
      (mockPrisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(null) // buyer not found
        .mockResolvedValueOnce({ id: mockSellerId });

      (mockPrisma.outcome.findUnique as jest.Mock).mockResolvedValue({
        id: mockOutcomeId,
        currentPrice: 0.65,
        market: {
          id: mockMarketId,
          status: 'ACTIVE'
        }
      });

      (mockPrisma.order.findUnique as jest.Mock)
        .mockResolvedValueOnce({
          id: mockBuyOrderId,
          userId: mockBuyerId
        })
        .mockResolvedValueOnce({
          id: mockSellOrderId,
          userId: mockSellerId
        });

      await expect(tradeService.executeTrade(validTradeRequest)).rejects.toThrow('Buyer not found');
    });

    it('should reject trade when market is not active', async () => {
      (mockPrisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce({ id: mockBuyerId })
        .mockResolvedValueOnce({ id: mockSellerId });

      (mockPrisma.outcome.findUnique as jest.Mock).mockResolvedValue({
        id: mockOutcomeId,
        market: {
          id: mockMarketId,
          status: 'CLOSED' // Market not active
        }
      });

      (mockPrisma.order.findUnique as jest.Mock)
        .mockResolvedValueOnce({
          id: mockBuyOrderId,
          userId: mockBuyerId
        })
        .mockResolvedValueOnce({
          id: mockSellOrderId,
          userId: mockSellerId
        });

      await expect(tradeService.executeTrade(validTradeRequest)).rejects.toThrow('Market is not active');
    });

    it('should reject trade when order ownership mismatch', async () => {
      // Reset mocks for this specific test
      jest.clearAllMocks();
      
      (mockPrisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce({ id: mockBuyerId }) // buyer found
        .mockResolvedValueOnce({ id: mockSellerId }); // seller found

      (mockPrisma.outcome.findUnique as jest.Mock).mockResolvedValue({
        id: mockOutcomeId,
        currentPrice: 0.65,
        market: {
          id: mockMarketId,
          status: 'ACTIVE'
        }
      });

      (mockPrisma.order.findUnique as jest.Mock)
        .mockResolvedValueOnce({
          id: mockBuyOrderId,
          userId: 'different-user' // Wrong owner - this should cause validation to fail
        })
        .mockResolvedValueOnce({
          id: mockSellOrderId,
          userId: mockSellerId
        });

      // Clear the transaction mock to ensure it's not called
      (mockPrisma.$transaction as jest.Mock).mockClear();

      await expect(tradeService.executeTrade(validTradeRequest)).rejects.toThrow('Order ownership mismatch');
    });
  });

  describe('getUserBalance', () => {
    it('should return user balance', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: mockBuyerId
      });

      const balance = await tradeService.getUserBalance(mockBuyerId);

      expect(balance.userId).toBe(mockBuyerId);
      expect(balance.balance).toBe(1000); // Default balance from simplified implementation
      expect(balance.availableBalance).toBe(1000);
      expect(balance.lockedBalance).toBe(0);
    });

    it('should throw error when user not found', async () => {
      // Reset mocks for this specific test
      jest.clearAllMocks();
      
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(tradeService.getUserBalance('non-existent')).rejects.toThrow('User not found');
    });
  });

  describe('getUserPositions', () => {
    it('should return user positions', async () => {
      const mockPositions = [
        {
          id: 'position-1',
          userId: mockBuyerId,
          marketId: mockMarketId,
          outcomeId: mockOutcomeId,
          quantity: 100,
          averagePrice: 0.6,
          totalCost: 60,
          currentValue: 65,
          unrealizedPnL: 5,
          market: {
            id: mockMarketId,
            title: 'Test Market',
            status: 'ACTIVE'
          },
          outcome: {
            id: mockOutcomeId,
            name: 'Yes',
            currentPrice: 0.65
          }
        }
      ];

      (mockPrisma.position.findMany as jest.Mock).mockResolvedValue(mockPositions);

      const positions = await tradeService.getUserPositions(mockBuyerId);

      expect(positions).toHaveLength(1);
      expect(positions[0].userId).toBe(mockBuyerId);
      expect(positions[0].quantity).toBe(100);
    });

    it('should filter positions by market ID when provided', async () => {
      (mockPrisma.position.findMany as jest.Mock).mockResolvedValue([]);

      await tradeService.getUserPositions(mockBuyerId, mockMarketId);

      expect(mockPrisma.position.findMany).toHaveBeenCalledWith({
        where: {
          userId: mockBuyerId,
          marketId: mockMarketId
        },
        include: expect.any(Object),
        orderBy: {
          updatedAt: 'desc'
        }
      });
    });
  });

  describe('getUserTradeHistory', () => {
    it('should return paginated trade history', async () => {
      const mockTrades = [
        {
          id: 'trade-1',
          marketId: mockMarketId,
          outcomeId: mockOutcomeId,
          buyerId: mockBuyerId,
          sellerId: mockSellerId,
          quantity: 100,
          price: 0.6,
          totalValue: 60,
          createdAt: new Date(),
          market: {
            id: mockMarketId,
            title: 'Test Market'
          },
          outcome: {
            id: mockOutcomeId,
            name: 'Yes'
          },
          buyer: {
            id: mockBuyerId,
            walletAddress: '0x123',
            username: 'buyer'
          },
          seller: {
            id: mockSellerId,
            walletAddress: '0x456',
            username: 'seller'
          }
        }
      ];

      (mockPrisma.trade.findMany as jest.Mock).mockResolvedValue(mockTrades);
      (mockPrisma.trade.count as jest.Mock).mockResolvedValue(1);

      const result = await tradeService.getUserTradeHistory(mockBuyerId);

      expect(result.trades).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
      expect(result.totalPages).toBe(1);
    });

    it('should handle pagination correctly', async () => {
      (mockPrisma.trade.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.trade.count as jest.Mock).mockResolvedValue(100);

      const result = await tradeService.getUserTradeHistory(mockBuyerId, undefined, 3, 20);

      expect(result.page).toBe(3);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(5); // 100 / 20

      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { buyerId: mockBuyerId },
            { sellerId: mockBuyerId }
          ]
        },
        include: expect.any(Object),
        orderBy: {
          createdAt: 'desc'
        },
        skip: 40, // (3 - 1) * 20
        take: 20
      });
    });
  });

  describe('getMarketTradeHistory', () => {
    it('should return market trade history', async () => {
      const mockTrades = [
        {
          id: 'trade-1',
          marketId: mockMarketId,
          outcomeId: mockOutcomeId,
          quantity: 100,
          price: 0.6,
          totalValue: 60,
          createdAt: new Date()
        }
      ];

      (mockPrisma.trade.findMany as jest.Mock).mockResolvedValue(mockTrades);
      (mockPrisma.trade.count as jest.Mock).mockResolvedValue(1);

      const result = await tradeService.getMarketTradeHistory(mockMarketId);

      expect(result.trades).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by outcome ID when provided', async () => {
      (mockPrisma.trade.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.trade.count as jest.Mock).mockResolvedValue(0);

      await tradeService.getMarketTradeHistory(mockMarketId, mockOutcomeId);

      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith({
        where: {
          marketId: mockMarketId,
          outcomeId: mockOutcomeId
        },
        include: expect.any(Object),
        orderBy: {
          createdAt: 'desc'
        },
        skip: 0,
        take: 50
      });
    });
  });

  describe('calculatePositionPnL', () => {
    it('should calculate P&L for existing position', async () => {
      const mockPosition = {
        id: 'position-1',
        userId: mockBuyerId,
        marketId: mockMarketId,
        outcomeId: mockOutcomeId,
        quantity: 100,
        averagePrice: 0.6,
        totalCost: 60,
        outcome: {
          currentPrice: 0.65
        }
      };

      (mockPrisma.position.findUnique as jest.Mock).mockResolvedValue(mockPosition);

      const pnl = await tradeService.calculatePositionPnL(mockBuyerId, mockMarketId, mockOutcomeId);

      expect(pnl.realizedPnL).toBe(0);
      expect(pnl.unrealizedPnL).toBe(5); // (100 * 0.65) - 60 = 65 - 60 = 5
      expect(pnl.totalPnL).toBe(5);
    });

    it('should return zero P&L when position not found', async () => {
      (mockPrisma.position.findUnique as jest.Mock).mockResolvedValue(null);

      const pnl = await tradeService.calculatePositionPnL(mockBuyerId, mockMarketId, mockOutcomeId);

      expect(pnl.realizedPnL).toBe(0);
      expect(pnl.unrealizedPnL).toBe(0);
      expect(pnl.totalPnL).toBe(0);
    });
  });

  describe('executeTradesFromMatching', () => {
    it('should execute multiple trades from order book matching', async () => {
      const mockTrades = [
        {
          buyOrderId: 'buy-1',
          sellOrderId: 'sell-1',
          buyerId: mockBuyerId,
          sellerId: mockSellerId,
          quantity: 50,
          price: 0.6,
          totalValue: 30,
          buyerFee: 0.06,
          sellerFee: 0.06
        },
        {
          buyOrderId: 'buy-2',
          sellOrderId: 'sell-2',
          buyerId: 'buyer-2',
          sellerId: mockSellerId,
          quantity: 25,
          price: 0.65,
          totalValue: 16.25,
          buyerFee: 0.0325,
          sellerFee: 0.0325
        }
      ];

      // Mock successful trade execution for each trade
      jest.spyOn(tradeService, 'executeTrade').mockResolvedValue({
        trade: {
          id: 'trade-1',
          marketId: mockMarketId,
          outcomeId: mockOutcomeId,
          buyerId: mockBuyerId,
          sellerId: mockSellerId,
          buyOrderId: 'buy-1',
          sellOrderId: 'sell-1',
          quantity: 50,
          price: 0.6,
          totalValue: 30,
          buyerFee: 0.06,
          sellerFee: 0.06,
          createdAt: new Date()
        },
        balanceUpdates: [],
        positionUpdates: [],
        auditLog: []
      });

      const results = await tradeService.executeTradesFromMatching(mockTrades, mockMarketId, mockOutcomeId);

      expect(results).toHaveLength(2);
      expect(tradeService.executeTrade).toHaveBeenCalledTimes(2);
    });
  });
});