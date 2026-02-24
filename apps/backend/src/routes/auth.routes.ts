import { Router, Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { logger } from '../config/logger';
import Joi from 'joi';

export interface AuthRouterDependencies {
  authService: AuthService;
}

/**
 * Authentication Routes
 * Handles Web3 wallet authentication endpoints
 * 
 * Endpoints:
 * - POST /api/auth/nonce - Generate nonce for wallet authentication
 * - POST /api/auth/wallet - Authenticate with wallet signature
 * - POST /api/auth/refresh - Refresh access token
 * - POST /api/auth/logout - Logout and revoke tokens
 * - GET /api/auth/me - Get current user info
 */
export function createAuthRouter(dependencies: AuthRouterDependencies): Router {
  const router = Router();
  const { authService } = dependencies;

  // Validation schemas
  const nonceSchema = Joi.object({
    walletAddress: Joi.string()
      .pattern(/^0x[a-fA-F0-9]{40}$/)
      .required()
      .messages({
        'string.pattern.base': 'Invalid wallet address format'
      })
  });

  const walletAuthSchema = Joi.object({
    walletAddress: Joi.string()
      .pattern(/^0x[a-fA-F0-9]{40}$/)
      .required(),
    signature: Joi.string().required(),
    message: Joi.string().required(),
    nonce: Joi.string().required()
  });

  const refreshTokenSchema = Joi.object({
    refreshToken: Joi.string().required()
  });

  /**
   * POST /api/auth/nonce
   * Generate nonce for wallet authentication
   */
  router.post('/nonce', async (req: Request, res: Response) => {
    try {
      const { error, value } = nonceSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: error.details[0].message,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
      }

      const { walletAddress } = value;
      const nonce = await authService.generateNonce(walletAddress);
      const message = authService.generateAuthMessage(walletAddress, nonce);

      res.json({
        nonce,
        message,
        walletAddress: walletAddress.toLowerCase()
      });

    } catch (error) {
      logger.error('Nonce generation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.headers['x-request-id']
      });

      res.status(500).json({
        error: {
          code: 'NONCE_GENERATION_FAILED',
          message: 'Failed to generate authentication nonce',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  });

  /**
   * POST /api/auth/wallet
   * Authenticate with wallet signature
   */
  router.post('/wallet', async (req: Request, res: Response) => {
    try {
      const { error, value } = walletAuthSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: error.details[0].message,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
      }

      const authToken = await authService.authenticateWallet(value);

      // Set refresh token as httpOnly cookie
      res.cookie('refreshToken', authToken.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      res.json({
        accessToken: authToken.accessToken,
        expiresIn: authToken.expiresIn,
        user: authToken.user
      });

    } catch (error) {
      logger.error('Wallet authentication failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        walletAddress: req.body.walletAddress,
        requestId: req.headers['x-request-id']
      });

      const statusCode = error instanceof Error && 
        (error.message.includes('Invalid') || error.message.includes('expired')) ? 401 : 500;

      res.status(statusCode).json({
        error: {
          code: statusCode === 401 ? 'AUTHENTICATION_FAILED' : 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Authentication failed',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  });

  /**
   * POST /api/auth/refresh
   * Refresh access token
   */
  router.post('/refresh', async (req: Request, res: Response) => {
    try {
      // Try to get refresh token from cookie first, then from body
      const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

      if (!refreshToken) {
        return res.status(401).json({
          error: {
            code: 'MISSING_REFRESH_TOKEN',
            message: 'Refresh token is required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
      }

      const authToken = await authService.refreshToken(refreshToken);

      // Update refresh token cookie
      res.cookie('refreshToken', authToken.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      res.json({
        accessToken: authToken.accessToken,
        expiresIn: authToken.expiresIn,
        user: authToken.user
      });

    } catch (error) {
      logger.error('Token refresh failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.headers['x-request-id']
      });

      res.status(401).json({
        error: {
          code: 'TOKEN_REFRESH_FAILED',
          message: 'Invalid refresh token',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  });

  /**
   * POST /api/auth/logout
   * Logout and revoke tokens
   */
  router.post('/logout', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        await authService.revokeToken(token);
      }

      // Clear refresh token cookie
      res.clearCookie('refreshToken');

      res.json({
        message: 'Logged out successfully'
      });

    } catch (error) {
      logger.error('Logout failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.headers['x-request-id']
      });

      // Still return success - logout should be idempotent
      res.json({
        message: 'Logged out successfully'
      });
    }
  });

  /**
   * GET /api/auth/me
   * Get current user info (requires authentication)
   */
  router.get('/me', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: {
            code: 'MISSING_TOKEN',
            message: 'Authorization token is required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
      }

      const token = authHeader.substring(7);
      
      // Check if token is blacklisted
      if (await authService.isTokenBlacklisted(token)) {
        return res.status(401).json({
          error: {
            code: 'TOKEN_REVOKED',
            message: 'Token has been revoked',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
      }

      const user = await authService.validateToken(token);

      res.json({
        user: {
          id: user.id,
          walletAddress: user.walletAddress,
          username: user.username,
          email: user.email,
          profileImage: user.profileImage,
          isVerified: user.isVerified,
          isAdmin: user.isAdmin,
          totalVolume: user.totalVolume,
          totalTrades: user.totalTrades,
          winRate: user.winRate,
          profitLoss: user.profitLoss,
          createdAt: user.createdAt
        }
      });

    } catch (error) {
      logger.error('Get user info failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.headers['x-request-id']
      });

      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_FAILED',
          message: 'Invalid or expired token',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  });

  return router;
}