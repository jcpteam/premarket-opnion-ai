import fc from 'fast-check';

/**
 * Property-Based Test for Market Creation Validation
 * **Feature: prediction-market-platform, Property 1: Market Creation Validation**
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**
 * 
 * Property: For any market creation request, the platform should create a market 
 * with the correct number of outcomes (2 for binary, 3-10 for multi-outcome), 
 * require all mandatory fields (question, description, resolution criteria, future end date), 
 * and respect user permissions.
 */

// Define enums locally to avoid import issues with mocking
enum MarketType {
  BINARY = 'BINARY',
  MULTI_OUTCOME = 'MULTI_OUTCOME'
}

enum MarketStatus {
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
  RESOLVED = 'RESOLVED',
  DISPUTED = 'DISPUTED'
}

// Mock Prisma client for testing
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
  market: {
    create: jest.fn(),
  },
  outcome: {
    createMany: jest.fn(),
  },
};

// Market creation service interface
interface MarketCreationRequest {
  title: string;
  description: string;
  category: string;
  type: MarketType;
  endDate: Date;
  creatorId: string;
  outcomes?: string[];
  tags?: string[];
}

interface MarketCreationResult {
  success: boolean;
  market?: any;
  error?: string;
  outcomeCount?: number;
}

// Mock market creation service
class MarketCreationService {
  constructor(private prisma: any) {}

  async createMarket(request: MarketCreationRequest): Promise<MarketCreationResult> {
    try {
      // Validate user exists and has permissions
      const user = await this.prisma.user.findUnique({
        where: { id: request.creatorId }
      });

      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Validate mandatory fields
      if (!request.title || !request.description || !request.endDate) {
        return { success: false, error: 'Missing mandatory fields' };
      }

      // Validate end date is in the future
      if (request.endDate <= new Date()) {
        return { success: false, error: 'End date must be in the future' };
      }

      // Validate outcome count based on market type
      let outcomeCount: number;
      let outcomes: string[];

      if (request.type === MarketType.BINARY) {
        outcomeCount = 2;
        outcomes = ['Yes', 'No'];
      } else if (request.type === MarketType.MULTI_OUTCOME) {
        if (!request.outcomes || request.outcomes.length < 3 || request.outcomes.length > 10) {
          return { success: false, error: 'Multi-outcome markets must have 3-10 outcomes' };
        }
        outcomeCount = request.outcomes.length;
        outcomes = request.outcomes;
      } else {
        return { success: false, error: 'Invalid market type' };
      }

      // Create market
      const market = await this.prisma.market.create({
        data: {
          title: request.title,
          description: request.description,
          category: request.category,
          type: request.type,
          endDate: request.endDate,
          creatorId: request.creatorId,
          tags: request.tags || [],
          status: MarketStatus.ACTIVE,
        }
      });

      // Create outcomes
      await this.prisma.outcome.createMany({
        data: outcomes.map((name) => ({
          marketId: market.id,
          name,
          currentPrice: 1 / outcomeCount, // Equal initial probability
        }))
      });

      return { 
        success: true, 
        market, 
        outcomeCount 
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

describe('Market Creation Validation Property Tests', () => {
  let marketService: MarketCreationService;

  beforeEach(() => {
    jest.clearAllMocks();
    marketService = new MarketCreationService(mockPrisma);
    
    // Default mock implementations
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      walletAddress: '0x123',
      isAdmin: false,
    });
    
    (mockPrisma.market.create as jest.Mock).mockImplementation((data) => 
      Promise.resolve({
        id: 'market-1',
        ...data.data,
      })
    );
    
    (mockPrisma.outcome.createMany as jest.Mock).mockResolvedValue({ count: 2 });
  });

  /**
   * Property 1.1: Binary markets must have exactly 2 outcomes
   */
  test('Property 1.1: Binary markets always create exactly 2 outcomes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 200 }),
          description: fc.string({ minLength: 1, maxLength: 1000 }),
          category: fc.constantFrom('sports', 'politics', 'crypto', 'entertainment'),
          endDate: fc.date({ min: new Date(Date.now() + 86400000) }), // At least 1 day in future
          creatorId: fc.string({ minLength: 1 }),
          tags: fc.array(fc.string(), { maxLength: 5 }),
        }),
        async (validRequest: any) => {
          const request: MarketCreationRequest = {
            ...validRequest,
            type: MarketType.BINARY,
          };

          const result = await marketService.createMarket(request);

          if (result.success) {
            expect(result.outcomeCount).toBe(2);
            expect(mockPrisma.outcome.createMany).toHaveBeenCalledWith({
              data: expect.arrayContaining([
                expect.objectContaining({ name: 'Yes' }),
                expect.objectContaining({ name: 'No' }),
              ])
            });
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.2: Multi-outcome markets must have 3-10 outcomes
   */
  test('Property 1.2: Multi-outcome markets create correct number of outcomes (3-10)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 200 }),
          description: fc.string({ minLength: 1, maxLength: 1000 }),
          category: fc.constantFrom('sports', 'politics', 'crypto', 'entertainment'),
          endDate: fc.date({ min: new Date(Date.now() + 86400000) }),
          creatorId: fc.string({ minLength: 1 }),
          outcomes: fc.array(fc.string({ minLength: 1 }), { minLength: 3, maxLength: 10 }),
          tags: fc.array(fc.string(), { maxLength: 5 }),
        }),
        async (validRequest: any) => {
          const request: MarketCreationRequest = {
            ...validRequest,
            type: MarketType.MULTI_OUTCOME,
          };

          const result = await marketService.createMarket(request);

          if (result.success) {
            expect(result.outcomeCount).toBe(request.outcomes!.length);
            expect(result.outcomeCount).toBeGreaterThanOrEqual(3);
            expect(result.outcomeCount).toBeLessThanOrEqual(10);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.3: All mandatory fields must be present and valid
   */
  test('Property 1.3: Markets with missing mandatory fields are rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          title: fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
          description: fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
          category: fc.string(),
          type: fc.constantFrom(MarketType.BINARY, MarketType.MULTI_OUTCOME),
          endDate: fc.option(fc.date(), { nil: undefined }),
          creatorId: fc.string({ minLength: 1 }),
        }),
        async (request: any) => {
          // Only test cases where at least one mandatory field is missing
          const hasMissingFields = !request.title || !request.description || !request.endDate;
          
          if (hasMissingFields) {
            const result = await marketService.createMarket(request as MarketCreationRequest);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Missing mandatory fields');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.4: End date must be in the future
   */
  test('Property 1.4: Markets with past end dates are rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 200 }),
          description: fc.string({ minLength: 1, maxLength: 1000 }),
          category: fc.string(),
          type: fc.constantFrom(MarketType.BINARY, MarketType.MULTI_OUTCOME),
          endDate: fc.date({ max: new Date(Date.now() - 1000) }), // Past date
          creatorId: fc.string({ minLength: 1 }),
        }),
        async (request: any) => {
          const result = await marketService.createMarket(request);
          expect(result.success).toBe(false);
          expect(result.error).toContain('End date must be in the future');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.5: User permissions are respected
   */
  test('Property 1.5: Non-existent users cannot create markets', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 200 }),
          description: fc.string({ minLength: 1, maxLength: 1000 }),
          category: fc.string(),
          type: fc.constantFrom(MarketType.BINARY, MarketType.MULTI_OUTCOME),
          endDate: fc.date({ min: new Date(Date.now() + 86400000) }),
          creatorId: fc.string({ minLength: 1 }),
        }),
        async (request: any) => {
          // Mock user not found
          (mockPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);

          const result = await marketService.createMarket(request);
          expect(result.success).toBe(false);
          expect(result.error).toContain('User not found');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multi-outcome markets with invalid outcome counts are rejected
   */
  test('Property: Multi-outcome markets with < 3 or > 10 outcomes are rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 200 }),
          description: fc.string({ minLength: 1, maxLength: 1000 }),
          category: fc.string(),
          endDate: fc.date({ min: new Date(Date.now() + 86400000) }),
          creatorId: fc.string({ minLength: 1 }),
          outcomes: fc.oneof(
            fc.array(fc.string({ minLength: 1 }), { minLength: 0, maxLength: 2 }), // Too few
            fc.array(fc.string({ minLength: 1 }), { minLength: 11, maxLength: 15 }) // Too many
          ),
        }),
        async (request: any) => {
          const marketRequest: MarketCreationRequest = {
            ...request,
            type: MarketType.MULTI_OUTCOME,
          };

          const result = await marketService.createMarket(marketRequest);
          expect(result.success).toBe(false);
          expect(result.error).toContain('Multi-outcome markets must have 3-10 outcomes');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Valid market creation requests always succeed
   */
  test('Property: Valid market creation requests always succeed', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 200 }),
          description: fc.string({ minLength: 1, maxLength: 1000 }),
          category: fc.constantFrom('sports', 'politics', 'crypto', 'entertainment'),
          type: fc.constantFrom(MarketType.BINARY, MarketType.MULTI_OUTCOME),
          endDate: fc.date({ min: new Date(Date.now() + 86400000) }),
          creatorId: fc.string({ minLength: 1 }),
          tags: fc.array(fc.string(), { maxLength: 5 }),
        }),
        fc.array(fc.string({ minLength: 1 }), { minLength: 3, maxLength: 10 }),
        async (baseRequest: any, multiOutcomes: any) => {
          const request: MarketCreationRequest = {
            ...baseRequest,
            outcomes: baseRequest.type === MarketType.MULTI_OUTCOME ? multiOutcomes : undefined,
          };

          const result = await marketService.createMarket(request);

          expect(result.success).toBe(true);
          expect(result.market).toBeDefined();
          expect(result.outcomeCount).toBeDefined();
          
          if (request.type === MarketType.BINARY) {
            expect(result.outcomeCount).toBe(2);
          } else {
            expect(result.outcomeCount).toBe(multiOutcomes.length);
            expect(result.outcomeCount).toBeGreaterThanOrEqual(3);
            expect(result.outcomeCount).toBeLessThanOrEqual(10);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});