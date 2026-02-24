import { PrismaClient, MarketType, MarketStatus, Market, Outcome } from '@prisma/client';
import { logger } from '../config/logger';
import { WebSocketService } from './websocket.service';

export interface CreateMarketRequest {
  title: string;
  description: string;
  category: string;
  tags?: string[];
  type: 'binary' | 'multi-outcome';
  outcomes: CreateOutcomeRequest[];
  endDate: Date;
  resolutionDate?: Date;
  creatorId: string;
}

export interface CreateOutcomeRequest {
  name: string;
  description?: string;
}

export interface UpdateMarketRequest {
  title?: string;
  description?: string;
  category?: string;
  tags?: string[];
  endDate?: Date;
  resolutionDate?: Date;
  status?: MarketStatus;
}

export interface MarketFilters {
  status?: MarketStatus;
  type?: MarketType;
  category?: string;
  creatorId?: string;
  tags?: string[];
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'endDate' | 'totalVolume' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export interface MarketWithOutcomes extends Market {
  outcomes: Outcome[];
  creator: {
    id: string;
    walletAddress: string;
    username?: string;
  };
}

/**
 * Market Management Service
 * Handles market creation, validation, and management operations
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 6.2, 6.3
 * - Create binary and multi-outcome markets
 * - Validate market parameters and business rules
 * - Manage market state transitions
 * - Provide search and filtering capabilities
 */
export class MarketService {
  private prisma: PrismaClient;
  private webSocketService: WebSocketService | undefined;

  constructor(prisma: PrismaClient, webSocketService?: WebSocketService) {
    this.prisma = prisma;
    this.webSocketService = webSocketService;
  }

  /**
   * Create a new prediction market with validation
   * Supports both binary and multi-outcome markets
   */
  async createMarket(request: CreateMarketRequest): Promise<MarketWithOutcomes> {
    // Validate market creation request
    this.validateMarketCreationRequest(request);

    try {
      // Create market and outcomes in a transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // Create the market
        const market = await tx.market.create({
          data: {
            title: request.title.trim(),
            description: request.description.trim(),
            category: request.category.trim(),
            tags: request.tags || [],
            type: request.type === 'binary' ? MarketType.BINARY : MarketType.MULTI_OUTCOME,
            endDate: request.endDate,
            resolutionDate: request.resolutionDate || null,
            creatorId: request.creatorId,
            status: MarketStatus.ACTIVE
          }
        });

        // Create outcomes
        const outcomes = await Promise.all(
          request.outcomes.map((outcome) =>
            tx.outcome.create({
              data: {
                marketId: market.id,
                name: outcome.name.trim(),
                description: outcome.description?.trim() || null,
                currentPrice: request.type === 'binary' ? 0.5 : 1 / request.outcomes.length,
                bestBid: 0,
                bestAsk: 1,
                spread: 1
              }
            })
          )
        );

        return { market, outcomes };
      });

      // Fetch the complete market with relations
      const marketWithOutcomes = await this.getMarketById(result.market.id);

      logger.info('Market created successfully', {
        marketId: result.market.id,
        title: request.title,
        type: request.type,
        creatorId: request.creatorId,
        outcomesCount: request.outcomes.length
      });

      return marketWithOutcomes!;

    } catch (error) {
      logger.error('Failed to create market', {
        error: error instanceof Error ? error.message : 'Unknown error',
        request: {
          title: request.title,
          type: request.type,
          creatorId: request.creatorId
        }
      });
      throw error;
    }
  }

  /**
   * Get market by ID with all related data
   */
  async getMarketById(id: string): Promise<MarketWithOutcomes | null> {
    try {
      const market = await this.prisma.market.findUnique({
        where: { id },
        include: {
          outcomes: {
            orderBy: { createdAt: 'asc' }
          },
          creator: {
            select: {
              id: true,
              walletAddress: true,
              username: true
            }
          }
        }
      });

      return market as MarketWithOutcomes | null;

    } catch (error) {
      logger.error('Failed to get market by ID', {
        marketId: id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get markets with filtering, searching, and pagination
   */
  async getMarkets(filters: MarketFilters = {}): Promise<{
    markets: MarketWithOutcomes[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      status,
      type,
      category,
      creatorId,
      tags,
      search,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = filters;

    try {
      // Build where clause
      const where: any = {};

      if (status) {
        where.status = status;
      }

      if (type) {
        where.type = type;
      }

      if (category) {
        where.category = category;
      }

      if (creatorId) {
        where.creatorId = creatorId;
      }

      if (tags && tags.length > 0) {
        where.tags = {
          hasSome: tags
        };
      }

      if (search) {
        where.OR = [
          {
            title: {
              search: search.split(' ').join(' & ')
            }
          },
          {
            description: {
              search: search.split(' ').join(' & ')
            }
          },
          {
            title: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            description: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            category: {
              contains: search,
              mode: 'insensitive'
            }
          }
        ];
      }

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Get total count
      const total = await this.prisma.market.count({ where });

      // Get markets
      const markets = await this.prisma.market.findMany({
        where,
        include: {
          outcomes: {
            orderBy: { createdAt: 'asc' }
          },
          creator: {
            select: {
              id: true,
              walletAddress: true,
              username: true
            }
          }
        },
        orderBy: {
          [sortBy]: sortOrder
        },
        skip,
        take: limit
      });

      const totalPages = Math.ceil(total / limit);

      return {
        markets: markets as MarketWithOutcomes[],
        total,
        page,
        limit,
        totalPages
      };

    } catch (error) {
      logger.error('Failed to get markets', {
        filters,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Update market information
   * Only allows updates to non-critical fields
   */
  async updateMarket(id: string, updates: UpdateMarketRequest, updaterId: string): Promise<MarketWithOutcomes> {
    try {
      // Get existing market to validate permissions
      const existingMarket = await this.prisma.market.findUnique({
        where: { id },
        include: { creator: true }
      });

      if (!existingMarket) {
        throw new Error('Market not found');
      }

      // Validate update permissions and business rules
      this.validateMarketUpdate(existingMarket, updates, updaterId);

      // Update market
      await this.prisma.market.update({
        where: { id },
        data: {
          ...updates,
          updatedAt: new Date()
        }
      });

      // Return updated market
      const updatedMarket = await this.getMarketById(id);

      logger.info('Market updated successfully', {
        marketId: id,
        updates,
        updaterId
      });

      return updatedMarket!;

    } catch (error) {
      logger.error('Failed to update market', {
        marketId: id,
        updates,
        updaterId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Search markets using full-text search
   */
  async searchMarkets(query: string, filters: Omit<MarketFilters, 'search'> = {}): Promise<{
    markets: MarketWithOutcomes[];
    total: number;
  }> {
    return this.getMarkets({
      ...filters,
      search: query
    });
  }

  /**
   * Get markets by category with pagination
   */
  async getMarketsByCategory(category: string, page: number = 1, limit: number = 20): Promise<{
    markets: MarketWithOutcomes[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    return this.getMarkets({
      category,
      page,
      limit
    });
  }

  /**
   * Get active markets (not closed, resolved, or disputed)
   */
  async getActiveMarkets(filters: Omit<MarketFilters, 'status'> = {}): Promise<{
    markets: MarketWithOutcomes[];
    total: number;
  }> {
    return this.getMarkets({
      ...filters,
      status: 'ACTIVE'
    });
  }

  /**
   * Close market (prevent new orders)
   */
  async closeMarket(id: string, closerId: string): Promise<MarketWithOutcomes> {
    try {
      const market = await this.prisma.market.findUnique({
        where: { id },
        include: { creator: true }
      });

      if (!market) {
        throw new Error('Market not found');
      }

      if (market.status !== 'ACTIVE') {
        throw new Error('Market is not active and cannot be closed');
      }

      const previousStatus = market.status;

      // Update market status
      await this.prisma.market.update({
        where: { id },
        data: {
          status: 'CLOSED',
          updatedAt: new Date()
        }
      });

      const updatedMarket = await this.getMarketById(id);

      // Broadcast market status change via WebSocket
      if (this.webSocketService) {
        this.webSocketService.broadcastMarketStatusChange(id, {
          previousStatus,
          newStatus: 'CLOSED',
          closerId,
          timestamp: new Date().toISOString(),
          reason: 'Market closed by administrator'
        });
      }

      logger.info('Market closed successfully', {
        marketId: id,
        closerId,
        previousStatus: market.status
      });

      return updatedMarket!;

    } catch (error) {
      logger.error('Failed to close market', {
        marketId: id,
        closerId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get market statistics
   */
  async getMarketStats(): Promise<{
    totalMarkets: number;
    activeMarkets: number;
    closedMarkets: number;
    resolvedMarkets: number;
    disputedMarkets: number;
    totalVolume: number;
    averageVolume: number;
  }> {
    try {
      const [
        totalMarkets,
        activeMarkets,
        closedMarkets,
        resolvedMarkets,
        disputedMarkets,
        volumeStats
      ] = await Promise.all([
        this.prisma.market.count(),
        this.prisma.market.count({ where: { status: 'ACTIVE' } }),
        this.prisma.market.count({ where: { status: 'CLOSED' } }),
        this.prisma.market.count({ where: { status: 'RESOLVED' } }),
        this.prisma.market.count({ where: { status: 'DISPUTED' } }),
        this.prisma.market.aggregate({
          _sum: { totalVolume: true },
          _avg: { totalVolume: true }
        })
      ]);

      return {
        totalMarkets,
        activeMarkets,
        closedMarkets,
        resolvedMarkets,
        disputedMarkets,
        totalVolume: volumeStats._sum.totalVolume || 0,
        averageVolume: volumeStats._avg.totalVolume || 0
      };

    } catch (error) {
      logger.error('Failed to get market statistics', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Validate market creation request
   * Implements business rules from requirements 1.1-1.5
   */
  private validateMarketCreationRequest(request: CreateMarketRequest): void {
    // Validate required fields
    if (!request.title || request.title.trim().length === 0) {
      throw new Error('Market title is required');
    }

    if (!request.description || request.description.trim().length === 0) {
      throw new Error('Market description is required');
    }

    if (!request.category || request.category.trim().length === 0) {
      throw new Error('Market category is required');
    }

    if (!request.creatorId) {
      throw new Error('Creator ID is required');
    }

    if (!request.endDate) {
      throw new Error('End date is required');
    }

    // Validate end date is in the future (Requirement 1.4)
    if (request.endDate <= new Date()) {
      throw new Error('End date must be in the future');
    }

    // Validate resolution date if provided
    if (request.resolutionDate && request.resolutionDate <= request.endDate) {
      throw new Error('Resolution date must be after end date');
    }

    // Validate market type and outcomes
    if (!request.type || !['binary', 'multi-outcome'].includes(request.type)) {
      throw new Error('Market type must be either "binary" or "multi-outcome"');
    }

    if (!request.outcomes || !Array.isArray(request.outcomes) || request.outcomes.length === 0) {
      throw new Error('Market outcomes are required');
    }

    // Validate binary market (Requirement 1.1)
    if (request.type === 'binary') {
      if (request.outcomes.length !== 2) {
        throw new Error('Binary markets must have exactly 2 outcomes');
      }
    }

    // Validate multi-outcome market (Requirement 1.2)
    if (request.type === 'multi-outcome') {
      if (request.outcomes.length < 3 || request.outcomes.length > 10) {
        throw new Error('Multi-outcome markets must have between 3 and 10 outcomes');
      }
    }

    // Validate outcomes
    request.outcomes.forEach((outcome, index) => {
      if (!outcome.name || outcome.name.trim().length === 0) {
        throw new Error(`Outcome ${index + 1} name is required`);
      }
    });

    // Check for duplicate outcome names
    const outcomeNames = request.outcomes.map(o => o.name.trim().toLowerCase());
    const uniqueNames = new Set(outcomeNames);
    if (uniqueNames.size !== outcomeNames.length) {
      throw new Error('Outcome names must be unique');
    }

    // Validate title length
    if (request.title.trim().length > 200) {
      throw new Error('Market title must be 200 characters or less');
    }

    // Validate description length
    if (request.description.trim().length > 2000) {
      throw new Error('Market description must be 2000 characters or less');
    }

    // Validate category length
    if (request.category.trim().length > 50) {
      throw new Error('Market category must be 50 characters or less');
    }

    // Validate tags
    if (request.tags) {
      if (request.tags.length > 10) {
        throw new Error('Maximum 10 tags allowed');
      }
      
      request.tags.forEach((tag, index) => {
        if (!tag || tag.trim().length === 0) {
          throw new Error(`Tag ${index + 1} cannot be empty`);
        }
        if (tag.trim().length > 30) {
          throw new Error(`Tag ${index + 1} must be 30 characters or less`);
        }
      });
    }
  }

  /**
   * Validate market update request
   */
  private validateMarketUpdate(
    existingMarket: Market & { creator: any },
    updates: UpdateMarketRequest,
    _updaterId: string
  ): void {
    // Check if market can be updated
    if (existingMarket.status === 'RESOLVED') {
      throw new Error('Cannot update resolved market');
    }

    // Validate permissions - only creator or admin can update
    // Note: Admin check would be done at the controller level with middleware

    // Validate end date if being updated
    if (updates.endDate) {
      if (updates.endDate <= new Date()) {
        throw new Error('End date must be in the future');
      }
    }

    // Validate resolution date if being updated
    if (updates.resolutionDate) {
      const endDate = updates.endDate || existingMarket.endDate;
      if (updates.resolutionDate <= endDate) {
        throw new Error('Resolution date must be after end date');
      }
    }

    // Validate status transitions
    if (updates.status) {
      this.validateStatusTransition(existingMarket.status, updates.status);
    }

    // Validate field lengths
    if (updates.title && updates.title.trim().length > 200) {
      throw new Error('Market title must be 200 characters or less');
    }

    if (updates.description && updates.description.trim().length > 2000) {
      throw new Error('Market description must be 2000 characters or less');
    }

    if (updates.category && updates.category.trim().length > 50) {
      throw new Error('Market category must be 50 characters or less');
    }

    if (updates.tags) {
      if (updates.tags.length > 10) {
        throw new Error('Maximum 10 tags allowed');
      }
      
      updates.tags.forEach((tag, index) => {
        if (!tag || tag.trim().length === 0) {
          throw new Error(`Tag ${index + 1} cannot be empty`);
        }
        if (tag.trim().length > 30) {
          throw new Error(`Tag ${index + 1} must be 30 characters or less`);
        }
      });
    }
  }

  /**
   * Validate market status transitions
   */
  private validateStatusTransition(currentStatus: MarketStatus, newStatus: MarketStatus): void {
    const validTransitions: Record<string, string[]> = {
      'ACTIVE': ['CLOSED'],
      'CLOSED': ['RESOLVED', 'DISPUTED'],
      'RESOLVED': ['DISPUTED'],
      'DISPUTED': ['RESOLVED']
    };

    const allowedTransitions = validTransitions[currentStatus] || [];
    
    if (!allowedTransitions.includes(newStatus)) {
      throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
    }
  }
}