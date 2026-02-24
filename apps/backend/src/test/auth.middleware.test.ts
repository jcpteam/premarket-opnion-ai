import { Request, Response, NextFunction } from 'express';
import { createAuthMiddleware, UserRole, Permission } from '../middleware/auth.middleware';
import { AuthService } from '../services/auth.service';

// Mock dependencies
const mockAuthService = {
  validateToken: jest.fn(),
  isTokenBlacklisted: jest.fn()
};

const mockRequest = (overrides: Partial<Request> = {}): Partial<Request> => ({
  headers: {},
  ip: '127.0.0.1',
  get: jest.fn(),
  path: '/test',
  method: 'GET',
  ...overrides
});

const mockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    removeHeader: jest.fn().mockReturnThis()
  };
  return res;
};

const mockNext = (): NextFunction => jest.fn();

describe('Authentication Middleware', () => {
  let authMiddleware: ReturnType<typeof createAuthMiddleware>;

  beforeEach(() => {
    jest.clearAllMocks();
    authMiddleware = createAuthMiddleware({
      authService: mockAuthService as unknown as AuthService
    });
  });

  describe('authenticate', () => {
    it('should authenticate valid token and set user context', async () => {
      const mockUser = {
        id: 'user123',
        walletAddress: '0x123',
        isAdmin: false,
        isVerified: true
      };

      mockAuthService.validateToken.mockResolvedValue(mockUser);
      mockAuthService.isTokenBlacklisted.mockResolvedValue(false);

      const req = mockRequest({
        headers: { authorization: 'Bearer valid-token' }
      }) as Request;
      const res = mockResponse() as Response;
      const next = mockNext();

      await authMiddleware.authenticate(req, res, next);

      expect(mockAuthService.validateToken).toHaveBeenCalledWith('valid-token');
      expect(req.user).toEqual(mockUser);
      expect(req.userId).toBe('user123');
      expect(req.walletAddress).toBe('0x123');
      expect(req.isAdmin).toBe(false);
      expect(req.isVerified).toBe(true);
      expect(req.userRoles).toContain(UserRole.USER);
      expect(next).toHaveBeenCalled();
    });

    it('should reject request without authorization header', async () => {
      const req = mockRequest() as Request;
      const res = mockResponse() as Response;
      const next = mockNext();

      await authMiddleware.authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'MISSING_TOKEN'
          })
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject blacklisted token', async () => {
      mockAuthService.isTokenBlacklisted.mockResolvedValue(true);

      const req = mockRequest({
        headers: { authorization: 'Bearer blacklisted-token' }
      }) as Request;
      const res = mockResponse() as Response;
      const next = mockNext();

      await authMiddleware.authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'TOKEN_REVOKED'
          })
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject invalid token', async () => {
      mockAuthService.isTokenBlacklisted.mockResolvedValue(false);
      mockAuthService.validateToken.mockRejectedValue(new Error('Invalid token'));

      const req = mockRequest({
        headers: { authorization: 'Bearer invalid-token' }
      }) as Request;
      const res = mockResponse() as Response;
      const next = mockNext();

      await authMiddleware.authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'AUTHENTICATION_FAILED'
          })
        })
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireAdmin', () => {
    it('should allow admin user', () => {
      const req = mockRequest({
        user: { id: 'admin123' },
        isAdmin: true,
        userRoles: [UserRole.ADMIN]
      }) as Request;
      const res = mockResponse() as Response;
      const next = mockNext();

      authMiddleware.requireAdmin(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject non-admin user', () => {
      const req = mockRequest({
        user: { id: 'user123' },
        isAdmin: false,
        userRoles: [UserRole.USER]
      }) as Request;
      const res = mockResponse() as Response;
      const next = mockNext();

      authMiddleware.requireAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'INSUFFICIENT_PRIVILEGES'
          })
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject unauthenticated user', () => {
      const req = mockRequest() as Request;
      const res = mockResponse() as Response;
      const next = mockNext();

      authMiddleware.requireAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'AUTHENTICATION_REQUIRED'
          })
        })
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requirePermission', () => {
    it('should allow user with required permission', () => {
      const req = mockRequest({
        user: { id: 'user123' },
        userRoles: [UserRole.MARKET_CREATOR]
      }) as Request;
      const res = mockResponse() as Response;
      const next = mockNext();

      const middleware = authMiddleware.requirePermission(Permission.CREATE_MARKET);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject user without required permission', () => {
      const req = mockRequest({
        user: { id: 'user123' },
        userRoles: [UserRole.USER]
      }) as Request;
      const res = mockResponse() as Response;
      const next = mockNext();

      const middleware = authMiddleware.requirePermission(Permission.CREATE_MARKET);
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'INSUFFICIENT_PERMISSIONS'
          })
        })
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    it('should allow user with required role', () => {
      const req = mockRequest({
        user: { id: 'user123' },
        userRoles: [UserRole.MODERATOR]
      }) as Request;
      const res = mockResponse() as Response;
      const next = mockNext();

      const middleware = authMiddleware.requireRole(UserRole.MODERATOR, UserRole.ADMIN);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject user without required role', () => {
      const req = mockRequest({
        user: { id: 'user123' },
        userRoles: [UserRole.USER]
      }) as Request;
      const res = mockResponse() as Response;
      const next = mockNext();

      const middleware = authMiddleware.requireRole(UserRole.MODERATOR, UserRole.ADMIN);
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'INSUFFICIENT_ROLE'
          })
        })
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireOwnership', () => {
    it('should allow user to access their own resource', () => {
      const req = mockRequest({
        user: { id: 'user123' },
        userId: 'user123',
        params: { userId: 'user123' },
        userRoles: [UserRole.USER]
      }) as Request;
      const res = mockResponse() as Response;
      const next = mockNext();

      const middleware = authMiddleware.requireOwnership('userId');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow admin to access any resource', () => {
      const req = mockRequest({
        user: { id: 'admin123' },
        userId: 'admin123',
        isAdmin: true,
        params: { userId: 'user123' },
        userRoles: [UserRole.ADMIN]
      }) as Request;
      const res = mockResponse() as Response;
      const next = mockNext();

      const middleware = authMiddleware.requireOwnership('userId');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject user accessing another user\'s resource', () => {
      const req = mockRequest({
        user: { id: 'user123' },
        userId: 'user123',
        params: { userId: 'user456' },
        userRoles: [UserRole.USER]
      }) as Request;
      const res = mockResponse() as Response;
      const next = mockNext();

      const middleware = authMiddleware.requireOwnership('userId');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'ACCESS_DENIED'
          })
        })
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('should set user context if valid token provided', async () => {
      const mockUser = {
        id: 'user123',
        walletAddress: '0x123',
        isAdmin: false,
        isVerified: true
      };

      mockAuthService.validateToken.mockResolvedValue(mockUser);
      mockAuthService.isTokenBlacklisted.mockResolvedValue(false);

      const req = mockRequest({
        headers: { authorization: 'Bearer valid-token' }
      }) as Request;
      const res = mockResponse() as Response;
      const next = mockNext();

      await authMiddleware.optionalAuth(req, res, next);

      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
    });

    it('should continue without authentication if no token provided', async () => {
      const req = mockRequest() as Request;
      const res = mockResponse() as Response;
      const next = mockNext();

      await authMiddleware.optionalAuth(req, res, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it('should continue without authentication if token is invalid', async () => {
      mockAuthService.isTokenBlacklisted.mockResolvedValue(false);
      mockAuthService.validateToken.mockRejectedValue(new Error('Invalid token'));

      const req = mockRequest({
        headers: { authorization: 'Bearer invalid-token' }
      }) as Request;
      const res = mockResponse() as Response;
      const next = mockNext();

      await authMiddleware.optionalAuth(req, res, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('securityHeaders', () => {
    it('should set security headers', () => {
      const req = mockRequest() as Request;
      const res = mockResponse() as Response;
      const next = mockNext();

      authMiddleware.securityHeaders(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(res.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
      expect(res.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
      expect(res.setHeader).toHaveBeenCalledWith('Referrer-Policy', 'strict-origin-when-cross-origin');
      expect(next).toHaveBeenCalled();
    });

    it('should add request ID if not present', () => {
      const req = mockRequest() as Request;
      const res = mockResponse() as Response;
      const next = mockNext();

      authMiddleware.securityHeaders(req, res, next);

      expect(req.headers['x-request-id']).toBeDefined();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('getUserRoles', () => {
    it('should return correct roles for admin user', () => {
      const user = { isAdmin: true };
      const roles = authMiddleware.getUserRoles(user);

      expect(roles).toContain(UserRole.USER);
      expect(roles).toContain(UserRole.ADMIN);
    });

    it('should return correct roles for regular user', () => {
      const user = { isAdmin: false };
      const roles = authMiddleware.getUserRoles(user);

      expect(roles).toContain(UserRole.USER);
      expect(roles).not.toContain(UserRole.ADMIN);
    });

    it('should return correct roles for market creator', () => {
      const user = { isAdmin: false, canCreateMarkets: true };
      const roles = authMiddleware.getUserRoles(user);

      expect(roles).toContain(UserRole.USER);
      expect(roles).toContain(UserRole.MARKET_CREATOR);
    });
  });

  describe('hasPermission', () => {
    it('should return true for admin with any permission', () => {
      const result = authMiddleware.hasPermission([UserRole.ADMIN], Permission.CREATE_MARKET);
      expect(result).toBe(true);
    });

    it('should return true for market creator with create market permission', () => {
      const result = authMiddleware.hasPermission([UserRole.MARKET_CREATOR], Permission.CREATE_MARKET);
      expect(result).toBe(true);
    });

    it('should return false for regular user with admin permission', () => {
      const result = authMiddleware.hasPermission([UserRole.USER], Permission.MANAGE_USERS);
      expect(result).toBe(false);
    });
  });
});