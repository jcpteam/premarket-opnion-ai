import { Request, Response } from 'express';
import { MarketService, CreateMarketRequest, UpdateMarketRequest, MarketFilters } from '../services/market.service';
import { MarketStatus, MarketType } from '@prisma/client';
import { logger } from '../config/logger';

export interface MarketControllerDependencies {
  marketService: MarketService;
}

/**
 * Market Controller
 * Handles HTTP requests for market management operations
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 6.2, 6.3
 * - Market creation and validation
 * - Market search and filtering
 * - Market state management
 */
export class MarketController {
  private marketService: MarketService;

  constructor(dependencies: MarketControllerDependencies) {
    this.marketService = dependencies.marketService;
  }

  /**
   * Create a new market
   * POST /api/markets
   */
  createMarket = async (req: Request, res: Response) => {
    try {
      const {
        title,
        description,
        category,
        tags,
        type,
        outcomes,
        endDate,
        resolutionDate
      } = req.body;

      // Validate authentication
      if (!req.userId) {
        return res.status(401).json({
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication is required to create markets',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
      }

      // Create market request
      const createRequest: CreateMarketRequest = {
        title,
        description,
        category,
        tags,
        type,
        outcomes,
        endDate: new Date(endDate),
        resolutionDate: resolutionDate ? new Date(resolutionDate) : undefined,
        creatorId: req.userId
      };

      const market = await this.marketService.createMarket(createRequest);

      res.status(201).json({
        success: true,
        data: market,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });

    } catch (error) {
      logger.error('Market creation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.userId,
        body: req.body,
        requestId: req.headers['x-request-id']
      });

      res.status(400).json({
        error: {
          code: 'MARKET_CREATION_FAILED',
          message: error instanceof Error ? error.message : 'Failed to create market',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  };

  /**
   * Get market by ID
   * GET /api/markets/:id
   */
  getMarket = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          error: {
            code: 'INVALID_MARKET_ID',
            message: 'Market ID is required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
      }

      const market = await this.marketService.getMarketById(id);

      if (!market) {
        return res.status(404).json({
          error: {
            code: 'MARKET_NOT_FOUND',
            message: 'Market not found',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
      }

      res.json({
        success: true,
        data: market,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });

    } catch (error) {
      logger.error('Failed to get market', {
        marketId: req.params.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.headers['x-request-id']
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve market',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  };

  /**
   * Get markets with filtering and pagination
   * GET /api/markets
   */
  getMarkets = async (req: Request, res: Response) => {
    try {
      const {
        status,
        type,
        category,
        creatorId,
        tags,
        search,
        page,
        limit,
        sortBy,
        sortOrder
      } = req.query;

      // Build filters
      const filters: MarketFilters = {};

      if (status && typeof status === 'string') {
        if (Object.values(MarketStatus).includes(status as MarketStatus)) {
          filters.status = status as MarketStatus;
        }
      }

      if (type && typeof type === 'string') {
        if (Object.values(MarketType).includes(type as MarketType)) {
          filters.type = type as MarketType;
        }
      }

      if (category && typeof category === 'string') {
        filters.category = category;
      }

      if (creatorId && typeof creatorId === 'string') {
        filters.creatorId = creatorId;
      }

      if (tags) {
        if (typeof tags === 'string') {
          filters.tags = [tags];
        } else if (Array.isArray(tags)) {
          filters.tags = tags.filter(tag => typeof tag === 'string');
        }
      }

      if (search && typeof search === 'string') {
        filters.search = search;
      }

      if (page && typeof page === 'string') {
        const pageNum = parseInt(page);
        if (!isNaN(pageNum) && pageNum > 0) {
          filters.page = pageNum;
        }
      }

      if (limit && typeof limit === 'string') {
        const limitNum = parseInt(limit);
        if (!isNaN(limitNum) && limitNum > 0 && limitNum <= 100) {
          filters.limit = limitNum;
        }
      }

      if (sortBy && typeof sortBy === 'string') {
        if (['createdAt', 'endDate', 'totalVolume', 'title'].includes(sortBy)) {
          filters.sortBy = sortBy as any;
        }
      }

      if (sortOrder && typeof sortOrder === 'string') {
        if (['asc', 'desc'].includes(sortOrder)) {
          filters.sortOrder = sortOrder as 'asc' | 'desc';
        }
      }

      const result = await this.marketService.getMarkets(filters);

      res.json({
        success: true,
        data: result.markets,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });

    } catch (error) {
      logger.error('Failed to get markets', {
        query: req.query,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.headers['x-request-id']
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve markets',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  };

  /**
   * Update market
   * PUT /api/markets/:id
   */
  updateMarket = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates: UpdateMarketRequest = req.body;

      if (!id) {
        return res.status(400).json({
          error: {
            code: 'INVALID_MARKET_ID',
            message: 'Market ID is required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
      }

      if (!req.userId) {
        return res.status(401).json({
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication is required to update markets',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
      }

      // Convert date strings to Date objects
      if (updates.endDate) {
        updates.endDate = new Date(updates.endDate);
      }
      if (updates.resolutionDate) {
        updates.resolutionDate = new Date(updates.resolutionDate);
      }

      const market = await this.marketService.updateMarket(id, updates, req.userId);

      res.json({
        success: true,
        data: market,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });

    } catch (error) {
      logger.error('Market update failed', {
        marketId: req.params.id,
        updates: req.body,
        userId: req.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.headers['x-request-id']
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 400;

      res.status(statusCode).json({
        error: {
          code: 'MARKET_UPDATE_FAILED',
          message: error instanceof Error ? error.message : 'Failed to update market',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  };

  /**
   * Close market
   * POST /api/markets/:id/close
   */
  closeMarket = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          error: {
            code: 'INVALID_MARKET_ID',
            message: 'Market ID is required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
      }

      if (!req.userId) {
        return res.status(401).json({
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication is required to close markets',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
      }

      const market = await this.marketService.closeMarket(id, req.userId);

      res.json({
        success: true,
        data: market,
        message: 'Market closed successfully',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });

    } catch (error) {
      logger.error('Market close failed', {
        marketId: req.params.id,
        userId: req.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.headers['x-request-id']
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 400;

      res.status(statusCode).json({
        error: {
          code: 'MARKET_CLOSE_FAILED',
          message: error instanceof Error ? error.message : 'Failed to close market',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  };

  /**
   * Search markets
   * GET /api/markets/search
   */
  searchMarkets = async (req: Request, res: Response) => {
    try {
      const { q, ...filters } = req.query;

      if (!q || typeof q !== 'string') {
        return res.status(400).json({
          error: {
            code: 'INVALID_SEARCH_QUERY',
            message: 'Search query is required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
      }

      // Build filters (similar to getMarkets)
      const searchFilters: Omit<MarketFilters, 'search'> = {};

      if (filters.status && typeof filters.status === 'string') {
        if (Object.values(MarketStatus).includes(filters.status as MarketStatus)) {
          searchFilters.status = filters.status as MarketStatus;
        }
      }

      if (filters.type && typeof filters.type === 'string') {
        if (Object.values(MarketType).includes(filters.type as MarketType)) {
          searchFilters.type = filters.type as MarketType;
        }
      }

      if (filters.category && typeof filters.category === 'string') {
        searchFilters.category = filters.category;
      }

      if (filters.page && typeof filters.page === 'string') {
        const pageNum = parseInt(filters.page);
        if (!isNaN(pageNum) && pageNum > 0) {
          searchFilters.page = pageNum;
        }
      }

      if (filters.limit && typeof filters.limit === 'string') {
        const limitNum = parseInt(filters.limit);
        if (!isNaN(limitNum) && limitNum > 0 && limitNum <= 100) {
          searchFilters.limit = limitNum;
        }
      }

      const result = await this.marketService.searchMarkets(q, searchFilters);

      res.json({
        success: true,
        data: result.markets,
        total: result.total,
        query: q,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });

    } catch (error) {
      logger.error('Market search failed', {
        query: req.query,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.headers['x-request-id']
      });

      res.status(500).json({
        error: {
          code: 'SEARCH_FAILED',
          message: 'Failed to search markets',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  };

  /**
   * Get markets by category
   * GET /api/markets/category/:category
   */
  getMarketsByCategory = async (req: Request, res: Response) => {
    try {
      const { category } = req.params;
      const { page, limit } = req.query;

      if (!category) {
        return res.status(400).json({
          error: {
            code: 'INVALID_CATEGORY',
            message: 'Category is required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
      }

      const pageNum = page && typeof page === 'string' ? parseInt(page) : 1;
      const limitNum = limit && typeof limit === 'string' ? parseInt(limit) : 20;

      const result = await this.marketService.getMarketsByCategory(
        category,
        pageNum,
        Math.min(limitNum, 100)
      );

      res.json({
        success: true,
        data: result.markets,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages
        },
        category,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });

    } catch (error) {
      logger.error('Failed to get markets by category', {
        category: req.params.category,
        query: req.query,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.headers['x-request-id']
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve markets by category',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  };

  /**
   * Get active markets
   * GET /api/markets/active
   */
  getActiveMarkets = async (req: Request, res: Response) => {
    try {
      const { page, limit, category, type } = req.query;

      const filters: Omit<MarketFilters, 'status'> = {};

      if (category && typeof category === 'string') {
        filters.category = category;
      }

      if (type && typeof type === 'string') {
        if (Object.values(MarketType).includes(type as MarketType)) {
          filters.type = type as MarketType;
        }
      }

      if (page && typeof page === 'string') {
        const pageNum = parseInt(page);
        if (!isNaN(pageNum) && pageNum > 0) {
          filters.page = pageNum;
        }
      }

      if (limit && typeof limit === 'string') {
        const limitNum = parseInt(limit);
        if (!isNaN(limitNum) && limitNum > 0 && limitNum <= 100) {
          filters.limit = limitNum;
        }
      }

      const result = await this.marketService.getActiveMarkets(filters);

      res.json({
        success: true,
        data: result.markets,
        total: result.total,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });

    } catch (error) {
      logger.error('Failed to get active markets', {
        query: req.query,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.headers['x-request-id']
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve active markets',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  };

  /**
   * Get market statistics
   * GET /api/markets/stats
   */
  getMarketStats = async (req: Request, res: Response) => {
    try {
      const stats = await this.marketService.getMarketStats();

      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });

    } catch (error) {
      logger.error('Failed to get market statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.headers['x-request-id']
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve market statistics',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  };
}