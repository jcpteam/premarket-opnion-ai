import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import Joi from 'joi';
import { MarketController } from '../controllers/market.controller';
import { MarketService } from '../services/market.service';
import { createAuthMiddleware, Permission } from '../middleware/auth.middleware';
import { AuthService } from '../services/auth.service';
import { marketCreationRateLimiter } from '../middleware/rateLimiter';
import { logger } from '../config/logger';

export function createMarketRoutes(dependencies: {
  prisma: PrismaClient;
  authService: AuthService;
}): Router {
  const router = Router();
  const { prisma, authService } = dependencies;

  // Initialize services and controllers
  const marketService = new MarketService(prisma);
  const marketController = new MarketController({ marketService });

  // Initialize auth middleware
  const authMiddleware = createAuthMiddleware({ authService });

  // Validation schemas
  const createMarketSchema = Joi.object({
    title: Joi.string().trim().min(1).max(200).required(),
    description: Joi.string().trim().min(1).max(2000).required(),
    category: Joi.string().trim().min(1).max(50).required(),
    tags: Joi.array().items(Joi.string().trim().min(1).max(30)).max(10).optional(),
    type: Joi.string().valid('binary', 'multi-outcome').required(),
    outcomes: Joi.array().items(
      Joi.object({
        name: Joi.string().trim().min(1).max(100).required(),
        description: Joi.string().trim().max(500).optional()
      })
    ).min(2).max(10).required(),
    endDate: Joi.date().greater('now').required(),
    resolutionDate: Joi.date().greater(Joi.ref('endDate')).optional()
  });

  const updateMarketSchema = Joi.object({
    title: Joi.string().trim().min(1).max(200).optional(),
    description: Joi.string().trim().min(1).max(2000).optional(),
    category: Joi.string().trim().min(1).max(50).optional(),
    tags: Joi.array().items(Joi.string().trim().min(1).max(30)).max(10).optional(),
    endDate: Joi.date().greater('now').optional(),
    resolutionDate: Joi.date().optional(),
    status: Joi.string().valid('ACTIVE', 'CLOSED', 'RESOLVED', 'DISPUTED').optional()
  });

  const marketFiltersSchema = Joi.object({
    status: Joi.string().valid('ACTIVE', 'CLOSED', 'RESOLVED', 'DISPUTED').optional(),
    type: Joi.string().valid('BINARY', 'MULTI_OUTCOME').optional(),
    category: Joi.string().trim().optional(),
    creatorId: Joi.string().optional(),
    tags: Joi.alternatives().try(
      Joi.string(),
      Joi.array().items(Joi.string())
    ).optional(),
    search: Joi.string().trim().min(1).max(100).optional(),
    page: Joi.number().integer().min(1).max(1000).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    sortBy: Joi.string().valid('createdAt', 'endDate', 'totalVolume', 'title').optional(),
    sortOrder: Joi.string().valid('asc', 'desc').optional()
  });

  // Validation middleware
  const validateCreateMarket = (req: any, res: any, next: any) => {
    const { error } = createMarketSchema.validate(req.body);
    if (error) {
      logger.warn('Market creation validation failed', {
        error: error.details[0].message,
        body: req.body,
        requestId: req.headers['x-request-id']
      });

      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    // Additional validation for market type and outcomes
    const { type, outcomes } = req.body;
    
    if (type === 'binary' && outcomes.length !== 2) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Binary markets must have exactly 2 outcomes',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    if (type === 'multi-outcome' && (outcomes.length < 3 || outcomes.length > 10)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Multi-outcome markets must have between 3 and 10 outcomes',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    next();
  };

  const validateUpdateMarket = (req: any, res: any, next: any) => {
    const { error } = updateMarketSchema.validate(req.body);
    if (error) {
      logger.warn('Market update validation failed', {
        error: error.details[0].message,
        body: req.body,
        marketId: req.params.id,
        requestId: req.headers['x-request-id']
      });

      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    next();
  };

  const validateMarketFilters = (req: any, res: any, next: any) => {
    const { error } = marketFiltersSchema.validate(req.query);
    if (error) {
      logger.warn('Market filters validation failed', {
        error: error.details[0].message,
        query: req.query,
        requestId: req.headers['x-request-id']
      });

      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    next();
  };

  // Routes

  /**
   * Create a new market
   * POST /api/markets
   * Requires authentication and CREATE_MARKET permission
   */
  router.post('/',
    authMiddleware.securityHeaders,
    marketCreationRateLimiter,
    authMiddleware.authenticate,
    authMiddleware.requirePermission(Permission.CREATE_MARKET),
    validateCreateMarket,
    marketController.createMarket
  );

  /**
   * Get markets with filtering and pagination
   * GET /api/markets
   * Public endpoint with optional authentication
   */
  router.get('/',
    authMiddleware.securityHeaders,
    authMiddleware.optionalAuth,
    validateMarketFilters,
    marketController.getMarkets
  );

  /**
   * Search markets
   * GET /api/markets/search
   * Public endpoint with optional authentication
   */
  router.get('/search',
    authMiddleware.securityHeaders,
    authMiddleware.optionalAuth,
    marketController.searchMarkets
  );

  /**
   * Get active markets
   * GET /api/markets/active
   * Public endpoint with optional authentication
   */
  router.get('/active',
    authMiddleware.securityHeaders,
    authMiddleware.optionalAuth,
    validateMarketFilters,
    marketController.getActiveMarkets
  );

  /**
   * Get market statistics
   * GET /api/markets/stats
   * Public endpoint
   */
  router.get('/stats',
    authMiddleware.securityHeaders,
    marketController.getMarketStats
  );

  /**
   * Get markets by category
   * GET /api/markets/category/:category
   * Public endpoint with optional authentication
   */
  router.get('/category/:category',
    authMiddleware.securityHeaders,
    authMiddleware.optionalAuth,
    marketController.getMarketsByCategory
  );

  /**
   * Get market by ID
   * GET /api/markets/:id
   * Public endpoint with optional authentication
   */
  router.get('/:id',
    authMiddleware.securityHeaders,
    authMiddleware.optionalAuth,
    marketController.getMarket
  );

  /**
   * Update market
   * PUT /api/markets/:id
   * Requires authentication and ownership or admin privileges
   */
  router.put('/:id',
    authMiddleware.securityHeaders,
    authMiddleware.authenticate,
    validateUpdateMarket,
    marketController.updateMarket
  );

  /**
   * Close market
   * POST /api/markets/:id/close
   * Requires authentication and RESOLVE_MARKET permission or ownership
   */
  router.post('/:id/close',
    authMiddleware.securityHeaders,
    authMiddleware.authenticate,
    authMiddleware.requirePermission(Permission.RESOLVE_MARKET),
    marketController.closeMarket
  );

  return router;
}