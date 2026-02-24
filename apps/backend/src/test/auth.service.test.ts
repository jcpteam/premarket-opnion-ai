import { AuthService } from '../services/auth.service';
import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';
import { ethers } from 'ethers';

// Mock dependencies
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
} as unknown as PrismaClient;

const mockRedis = {
  setEx: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
} as unknown as ReturnType<typeof createClient>;

describe('AuthService', () => {
  let authService: AuthService;
  const testConfig = {
    jwtSecret: 'test-secret',
    jwtRefreshSecret: 'test-refresh-secret',
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '7d',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    authService = new AuthService(mockPrisma, mockRedis, testConfig);
  });

  describe('generateNonce', () => {
    it('should generate and store a nonce', async () => {
      const walletAddress = '0x1234567890123456789012345678901234567890';
      
      const nonce = await authService.generateNonce(walletAddress);
      
      expect(nonce).toBeDefined();
      expect(typeof nonce).toBe('string');
      expect(nonce.length).toBeGreaterThan(0);
      expect(mockRedis.setEx).toHaveBeenCalledWith(
        `auth:nonce:${walletAddress.toLowerCase()}`,
        300,
        nonce
      );
    });
  });

  describe('generateAuthMessage', () => {
    it('should generate a properly formatted auth message', () => {
      const walletAddress = '0x1234567890123456789012345678901234567890';
      const nonce = 'test-nonce';
      
      const message = authService.generateAuthMessage(walletAddress, nonce);
      
      expect(message).toContain('Welcome to Prediction Market Platform!');
      expect(message).toContain(walletAddress);
      expect(message).toContain(nonce);
      expect(message).toContain('Sign this message to authenticate');
    });
  });

  describe('authenticateWallet', () => {
    const testWallet = ethers.Wallet.createRandom();
    const walletAddress = testWallet.address;
    const nonce = 'test-nonce';
    
    beforeEach(() => {
      (mockRedis.get as jest.Mock).mockResolvedValue(nonce);
      (mockRedis.del as jest.Mock).mockResolvedValue(1);
    });

    it('should authenticate a valid wallet signature', async () => {
      const message = authService.generateAuthMessage(walletAddress, nonce);
      const signature = await testWallet.signMessage(message);
      
      const mockUser = {
        id: 'user-1',
        walletAddress: walletAddress.toLowerCase(),
        username: null,
        isAdmin: false,
        isVerified: true,
      };

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const request = {
        walletAddress,
        signature,
        message,
        nonce,
      };

      const result = await authService.authenticateWallet(request);

      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.walletAddress).toBe(walletAddress.toLowerCase());
      expect(mockRedis.get).toHaveBeenCalledWith(`auth:nonce:${walletAddress.toLowerCase()}`);
      expect(mockRedis.del).toHaveBeenCalledWith(`auth:nonce:${walletAddress.toLowerCase()}`);
    });

    it('should create a new user if wallet is not found', async () => {
      const message = authService.generateAuthMessage(walletAddress, nonce);
      const signature = await testWallet.signMessage(message);
      
      const newUser = {
        id: 'user-new',
        walletAddress: walletAddress.toLowerCase(),
        username: null,
        isAdmin: false,
        isVerified: true,
      };

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.user.create as jest.Mock).mockResolvedValue(newUser);

      const request = {
        walletAddress,
        signature,
        message,
        nonce,
      };

      const result = await authService.authenticateWallet(request);

      expect(result).toBeDefined();
      expect(result.user.id).toBe('user-new');
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          walletAddress: walletAddress.toLowerCase(),
          isVerified: true,
        }
      });
    });

    it('should reject invalid nonce', async () => {
      (mockRedis.get as jest.Mock).mockResolvedValue('different-nonce');
      
      const message = authService.generateAuthMessage(walletAddress, nonce);
      const signature = await testWallet.signMessage(message);
      
      const request = {
        walletAddress,
        signature,
        message,
        nonce,
      };

      await expect(authService.authenticateWallet(request)).rejects.toThrow('Invalid or expired nonce');
    });

    it('should reject invalid signature', async () => {
      const message = authService.generateAuthMessage(walletAddress, nonce);
      const invalidSignature = '0x1234567890abcdef';
      
      const request = {
        walletAddress,
        signature: invalidSignature,
        message,
        nonce,
      };

      await expect(authService.authenticateWallet(request)).rejects.toThrow();
    });

    it('should reject signature from different wallet', async () => {
      const differentWallet = ethers.Wallet.createRandom();
      const message = authService.generateAuthMessage(walletAddress, nonce);
      const signature = await differentWallet.signMessage(message);
      
      const request = {
        walletAddress,
        signature,
        message,
        nonce,
      };

      await expect(authService.authenticateWallet(request)).rejects.toThrow('Invalid signature');
    });
  });

  describe('validateToken', () => {
    it('should validate a valid access token', async () => {
      const mockUser = {
        id: 'user-1',
        walletAddress: '0x1234567890123456789012345678901234567890',
        isAdmin: false,
      };

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      // Create a valid token
      const authService = new AuthService(mockPrisma, mockRedis, testConfig);
      const tokens = await (authService as any).generateTokens(mockUser);
      
      const validatedUser = await authService.validateToken(tokens.accessToken);
      
      expect(validatedUser).toEqual(mockUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' }
      });
    });

    it('should reject invalid token', async () => {
      const invalidToken = 'invalid.token.here';
      
      await expect(authService.validateToken(invalidToken)).rejects.toThrow('Invalid token');
    });

    it('should reject token for non-existent user', async () => {
      const mockUser = {
        id: 'user-1',
        walletAddress: '0x1234567890123456789012345678901234567890',
        isAdmin: false,
      };

      // Generate token for existing user
      const tokens = await (authService as any).generateTokens(mockUser);
      
      // Mock user not found
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      
      await expect(authService.validateToken(tokens.accessToken)).rejects.toThrow('Invalid token');
    });
  });

  describe('refreshToken', () => {
    it('should refresh a valid refresh token', async () => {
      const mockUser = {
        id: 'user-1',
        walletAddress: '0x1234567890123456789012345678901234567890',
        isAdmin: false,
      };

      const tokens = await (authService as any).generateTokens(mockUser);
      
      (mockRedis.get as jest.Mock).mockResolvedValue(tokens.refreshToken);
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (mockRedis.setEx as jest.Mock).mockResolvedValue('OK');

      const newTokens = await authService.refreshToken(tokens.refreshToken);
      
      expect(newTokens.accessToken).toBeDefined();
      expect(newTokens.refreshToken).toBeDefined();
      expect(newTokens.user.id).toBe('user-1');
    });

    it('should reject invalid refresh token', async () => {
      const invalidToken = 'invalid.refresh.token';
      
      await expect(authService.refreshToken(invalidToken)).rejects.toThrow('Invalid refresh token');
    });

    it('should reject refresh token not in Redis', async () => {
      const mockUser = {
        id: 'user-1',
        walletAddress: '0x1234567890123456789012345678901234567890',
        isAdmin: false,
      };

      const tokens = await (authService as any).generateTokens(mockUser);
      
      (mockRedis.get as jest.Mock).mockResolvedValue(null); // Token not in Redis
      
      await expect(authService.refreshToken(tokens.refreshToken)).rejects.toThrow('Invalid refresh token');
    });
  });

  describe('revokeToken', () => {
    it('should revoke a valid token', async () => {
      const mockUser = {
        id: 'user-1',
        walletAddress: '0x1234567890123456789012345678901234567890',
        isAdmin: false,
      };

      const tokens = await (authService as any).generateTokens(mockUser);
      
      (mockRedis.del as jest.Mock).mockResolvedValue(1);
      (mockRedis.setEx as jest.Mock).mockResolvedValue('OK');

      await expect(authService.revokeToken(tokens.accessToken)).resolves.not.toThrow();
      
      expect(mockRedis.del).toHaveBeenCalledWith(`refresh:${mockUser.id}`);
      expect(mockRedis.setEx).toHaveBeenCalledWith(
        `blacklist:${tokens.accessToken}`,
        expect.any(Number),
        'revoked'
      );
    });

    it('should not throw on invalid token during revocation', async () => {
      const invalidToken = 'invalid.token.here';
      
      await expect(authService.revokeToken(invalidToken)).resolves.not.toThrow();
    });
  });

  describe('isTokenBlacklisted', () => {
    it('should return true for blacklisted token', async () => {
      const token = 'some.token.here';
      (mockRedis.get as jest.Mock).mockResolvedValue('revoked');
      
      const result = await authService.isTokenBlacklisted(token);
      
      expect(result).toBe(true);
      expect(mockRedis.get).toHaveBeenCalledWith(`blacklist:${token}`);
    });

    it('should return false for non-blacklisted token', async () => {
      const token = 'some.token.here';
      (mockRedis.get as jest.Mock).mockResolvedValue(null);
      
      const result = await authService.isTokenBlacklisted(token);
      
      expect(result).toBe(false);
    });
  });

  describe('clearUserSessions', () => {
    it('should clear all user sessions', async () => {
      const userId = 'user-1';
      (mockRedis.del as jest.Mock).mockResolvedValue(1);
      
      await authService.clearUserSessions(userId);
      
      expect(mockRedis.del).toHaveBeenCalledWith(`refresh:${userId}`);
    });
  });
});