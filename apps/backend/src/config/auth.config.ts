import dotenv from 'dotenv';

dotenv.config();

/**
 * Authentication Configuration
 * Centralized configuration for Web3 wallet authentication
 */
export const authConfig = {
  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-change-in-production',
    accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
    issuer: 'prediction-market-platform',
    audience: 'prediction-market-users'
  },

  // Redis Configuration
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'pm:',
    ttl: {
      nonce: 300, // 5 minutes
      refreshToken: 7 * 24 * 60 * 60, // 7 days
      blacklist: 15 * 60 // 15 minutes (should match access token expiry)
    }
  },

  // Wallet Configuration
  wallet: {
    supportedTypes: ['MetaMask', 'WalletConnect', 'Coinbase Wallet'],
    messageTemplate: {
      domain: process.env.APP_DOMAIN || 'localhost:3000',
      version: '1',
      chainId: parseInt(process.env.CHAIN_ID || '1'), // Ethereum mainnet by default
      verifyingContract: process.env.VERIFYING_CONTRACT || '0x0000000000000000000000000000000000000000'
    }
  },

  // Security Configuration
  security: {
    nonceLength: 12,
    maxLoginAttempts: 5,
    lockoutDuration: 15 * 60, // 15 minutes
    requireHttps: process.env.NODE_ENV === 'production',
    cookieSettings: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    }
  },

  // Rate Limiting
  rateLimiting: {
    nonce: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 10 // 10 nonce requests per window
    },
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5 // 5 auth attempts per window
    },
    refresh: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 20 // 20 refresh attempts per window
    }
  }
};

/**
 * Validate required environment variables
 */
export function validateAuthConfig(): void {
  const requiredEnvVars = [
    'JWT_SECRET',
    'JWT_REFRESH_SECRET'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  // Warn about default values in production
  if (process.env.NODE_ENV === 'production') {
    if (authConfig.jwt.secret.includes('change-in-production')) {
      throw new Error('JWT_SECRET must be set to a secure value in production');
    }
    if (authConfig.jwt.refreshSecret.includes('change-in-production')) {
      throw new Error('JWT_REFRESH_SECRET must be set to a secure value in production');
    }
  }
}

/**
 * Get environment-specific configuration
 */
export function getAuthConfig() {
  validateAuthConfig();
  return authConfig;
}