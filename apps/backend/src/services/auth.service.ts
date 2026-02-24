import { ethers } from 'ethers';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';
import { logger } from '../config/logger';

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    walletAddress: string;
    username?: string;
    isAdmin: boolean;
  };
}

export interface WalletAuthRequest {
  walletAddress: string;
  signature: string;
  message: string;
  nonce: string;
}

export interface TokenPayload {
  userId: string;
  walletAddress: string;
  isAdmin: boolean;
  type: 'access' | 'refresh';
}

/**
 * Web3 Wallet Authentication Service
 * Handles wallet signature verification, JWT token generation, and session management
 * 
 * Requirements: 3.1, 3.4, 3.5
 * - Support MetaMask, WalletConnect, and Coinbase Wallet integration
 * - Authenticate users using wallet signature verification
 * - Manage sessions with Redis storage
 */
export class AuthService {
  private prisma: PrismaClient;
  private redis: ReturnType<typeof createClient>;
  private jwtSecret: string;
  private jwtRefreshSecret: string;
  private accessTokenExpiry: string;
  private refreshTokenExpiry: string;

  constructor(
    prisma: PrismaClient,
    redis: ReturnType<typeof createClient>,
    config: {
      jwtSecret: string;
      jwtRefreshSecret: string;
      accessTokenExpiry?: string;
      refreshTokenExpiry?: string;
    }
  ) {
    this.prisma = prisma;
    this.redis = redis;
    this.jwtSecret = config.jwtSecret;
    this.jwtRefreshSecret = config.jwtRefreshSecret;
    this.accessTokenExpiry = config.accessTokenExpiry || '15m';
    this.refreshTokenExpiry = config.refreshTokenExpiry || '7d';
  }

  /**
   * Generate a nonce for wallet authentication
   * Used to prevent replay attacks
   */
  async generateNonce(walletAddress: string): Promise<string> {
    const nonce = Math.random().toString(36).substring(2, 15);
    const key = `auth:nonce:${walletAddress.toLowerCase()}`;
    
    // Store nonce in Redis with 5-minute expiry
    await this.redis.setEx(key, 300, nonce);
    
    logger.info('Generated nonce for wallet authentication', {
      walletAddress: walletAddress.toLowerCase(),
      nonce
    });
    
    return nonce;
  }

  /**
   * Generate authentication message for wallet signing
   * Standard format for Web3 wallet authentication
   */
  generateAuthMessage(walletAddress: string, nonce: string): string {
    return `Welcome to Prediction Market Platform!

This request will not trigger a blockchain transaction or cost any gas fees.

Wallet address: ${walletAddress}
Nonce: ${nonce}
Timestamp: ${new Date().toISOString()}

Sign this message to authenticate your wallet.`;
  }

  /**
   * Verify wallet signature and authenticate user
   * Supports MetaMask, WalletConnect, and Coinbase Wallet signatures
   */
  async authenticateWallet(request: WalletAuthRequest): Promise<AuthToken> {
    const { walletAddress, signature, message, nonce } = request;
    const normalizedAddress = walletAddress.toLowerCase();

    try {
      // Verify nonce exists and is valid
      const storedNonce = await this.redis.get(`auth:nonce:${normalizedAddress}`);
      if (!storedNonce || storedNonce !== nonce) {
        throw new Error('Invalid or expired nonce');
      }

      // Verify the signature
      const recoveredAddress = ethers.verifyMessage(message, signature);
      if (recoveredAddress.toLowerCase() !== normalizedAddress) {
        throw new Error('Invalid signature');
      }

      // Remove used nonce
      await this.redis.del(`auth:nonce:${normalizedAddress}`);

      // Find or create user
      let user = await this.prisma.user.findUnique({
        where: { walletAddress: normalizedAddress }
      });

      if (!user) {
        user = await this.prisma.user.create({
          data: {
            walletAddress: normalizedAddress,
            isVerified: true, // Wallet ownership verified
          }
        });
        
        logger.info('Created new user from wallet authentication', {
          userId: user.id,
          walletAddress: normalizedAddress
        });
      }

      // Generate tokens
      const tokens = await this.generateTokens(user);

      // Store refresh token in Redis
      await this.storeRefreshToken(user.id, tokens.refreshToken);

      logger.info('Wallet authentication successful', {
        userId: user.id,
        walletAddress: normalizedAddress
      });

      return tokens;

    } catch (error) {
      logger.error('Wallet authentication failed', {
        walletAddress: normalizedAddress,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Generate JWT access and refresh tokens
   */
  private async generateTokens(user: any): Promise<AuthToken> {
    const accessPayload: TokenPayload = {
      userId: user.id,
      walletAddress: user.walletAddress,
      isAdmin: user.isAdmin,
      type: 'access'
    };

    const refreshPayload: TokenPayload = {
      userId: user.id,
      walletAddress: user.walletAddress,
      isAdmin: user.isAdmin,
      type: 'refresh'
    };

    const accessToken = jwt.sign(accessPayload, this.jwtSecret);
    const refreshToken = jwt.sign(refreshPayload, this.jwtRefreshSecret);

    // Calculate expiry time in seconds
    const expiresIn = this.parseTokenExpiry(this.accessTokenExpiry);

    return {
      accessToken,
      refreshToken,
      expiresIn,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        username: user.username,
        isAdmin: user.isAdmin
      }
    };
  }

  /**
   * Validate JWT access token
   */
  async validateToken(token: string): Promise<any> {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as TokenPayload;

      if (payload.type !== 'access') {
        throw new Error('Invalid token type');
      }

      // Check if user still exists and is active
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId }
      });

      if (!user) {
        throw new Error('User not found');
      }

      return user;

    } catch (error) {
      logger.warn('Token validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Invalid token');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<AuthToken> {
    try {
      const payload = jwt.verify(refreshToken, this.jwtRefreshSecret) as TokenPayload;

      if (payload.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Check if refresh token is stored in Redis
      const storedToken = await this.redis.get(`refresh:${payload.userId}`);
      if (!storedToken || storedToken !== refreshToken) {
        throw new Error('Invalid refresh token');
      }

      // Get user data
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user);

      // Update stored refresh token
      await this.storeRefreshToken(user.id, tokens.refreshToken);

      logger.info('Token refresh successful', {
        userId: user.id,
        walletAddress: user.walletAddress
      });

      return tokens;

    } catch (error) {
      logger.error('Token refresh failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Revoke token and clear session
   */
  async revokeToken(token: string): Promise<void> {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as TokenPayload;

      // Remove refresh token from Redis
      await this.redis.del(`refresh:${payload.userId}`);

      // Add token to blacklist (optional - for extra security)
      const tokenKey = `blacklist:${token}`;
      const expiresIn = this.parseTokenExpiry(this.accessTokenExpiry);
      await this.redis.setEx(tokenKey, expiresIn, 'revoked');

      logger.info('Token revoked successfully', {
        userId: payload.userId,
        walletAddress: payload.walletAddress
      });

    } catch (error) {
      logger.warn('Token revocation failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Don't throw error - revocation should be idempotent
    }
  }

  /**
   * Check if token is blacklisted
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    const result = await this.redis.get(`blacklist:${token}`);
    return result !== null;
  }

  /**
   * Store refresh token in Redis
   */
  private async storeRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const key = `refresh:${userId}`;
    const expiresIn = this.parseTokenExpiry(this.refreshTokenExpiry);
    await this.redis.setEx(key, expiresIn, refreshToken);
  }

  /**
   * Parse token expiry string to seconds
   */
  private parseTokenExpiry(expiry: string): number {
    const unit = expiry.slice(-1);
    const value = parseInt(expiry.slice(0, -1));

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 60 * 60 * 24;
      default: return 900; // 15 minutes default
    }
  }

  /**
   * Get user session info
   */
  async getSessionInfo(userId: string): Promise<any> {
    const refreshToken = await this.redis.get(`refresh:${userId}`);
    return {
      hasActiveSession: !!refreshToken,
      userId
    };
  }

  /**
   * Clear all user sessions
   */
  async clearUserSessions(userId: string): Promise<void> {
    await this.redis.del(`refresh:${userId}`);
    
    logger.info('Cleared user sessions', { userId });
  }
}