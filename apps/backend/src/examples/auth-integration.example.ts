/**
 * Authentication Service Integration Example
 * 
 * This example demonstrates how to integrate the Web3 wallet authentication service
 * into an Express.js application with proper middleware setup.
 */

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';
import { AuthService } from '../services/auth.service';
import { createAuthRouter } from '../routes/auth.routes';
import { createAuthMiddleware } from '../middleware/auth.middleware';
import { getAuthConfig } from '../config/auth.config';

// Example integration setup
export async function setupAuthIntegration() {
  const app = express();
  
  // Initialize dependencies
  const prisma = new PrismaClient();
  const redis = createClient({ url: 'redis://localhost:6379' });
  await redis.connect();
  
  // Get configuration
  const config = getAuthConfig();
  
  // Initialize auth service
  const authService = new AuthService(prisma, redis, {
    jwtSecret: config.jwt.secret,
    jwtRefreshSecret: config.jwt.refreshSecret,
    accessTokenExpiry: config.jwt.accessTokenExpiry,
    refreshTokenExpiry: config.jwt.refreshTokenExpiry,
  });
  
  // Create middleware
  const authMiddleware = createAuthMiddleware({ authService });
  
  // Create auth routes
  const authRouter = createAuthRouter({ authService });
  
  // Setup middleware
  app.use(express.json());
  app.use(authMiddleware.addRequestId);
  
  // Mount auth routes
  app.use('/api/auth', authRouter);
  
  // Example protected route
  app.get('/api/protected', 
    authMiddleware.authenticate, 
    (req, res) => {
      res.json({
        message: 'This is a protected route',
        user: {
          id: req.userId,
          walletAddress: req.walletAddress,
          isAdmin: req.isAdmin
        }
      });
    }
  );
  
  // Example admin-only route
  app.get('/api/admin', 
    authMiddleware.authenticate,
    authMiddleware.requireAdmin,
    (req, res) => {
      res.json({
        message: 'This is an admin-only route',
        user: req.user
      });
    }
  );
  
  // Example route with optional authentication
  app.get('/api/public', 
    authMiddleware.optionalAuth,
    (req, res) => {
      res.json({
        message: 'This is a public route with optional auth',
        authenticated: !!req.user,
        user: req.user ? {
          id: req.userId,
          walletAddress: req.walletAddress
        } : null
      });
    }
  );
  
  return { app, authService, prisma, redis };
}

// Example usage in a real application
export async function exampleUsage() {
  const { app, authService } = await setupAuthIntegration();
  
  // Example: Generate nonce for wallet authentication
  const walletAddress = '0x1234567890123456789012345678901234567890';
  const nonce = await authService.generateNonce(walletAddress);
  const message = authService.generateAuthMessage(walletAddress, nonce);
  
  console.log('Generated authentication message:', message);
  
  // Example: Validate a token
  try {
    const token = 'your-jwt-token-here';
    const user = await authService.validateToken(token);
    console.log('Token is valid for user:', user.walletAddress);
  } catch (error) {
    console.log('Token validation failed:', error);
  }
  
  // Start server
  const port = process.env.PORT || 3001;
  app.listen(port, () => {
    console.log(`Auth service running on port ${port}`);
    console.log('Available endpoints:');
    console.log('  POST /api/auth/nonce - Generate nonce');
    console.log('  POST /api/auth/wallet - Authenticate wallet');
    console.log('  POST /api/auth/refresh - Refresh token');
    console.log('  POST /api/auth/logout - Logout');
    console.log('  GET /api/auth/me - Get user info');
    console.log('  GET /api/protected - Protected route');
    console.log('  GET /api/admin - Admin-only route');
    console.log('  GET /api/public - Public route with optional auth');
  });
}

// Frontend integration example (TypeScript/JavaScript)
export const frontendIntegrationExample = `
// Frontend Web3 Wallet Authentication Example

import { ethers } from 'ethers';

class WalletAuthClient {
  constructor(private apiUrl: string) {}

  async authenticateWallet(walletAddress: string, signer: ethers.Signer) {
    try {
      // Step 1: Get nonce from server
      const nonceResponse = await fetch(\`\${this.apiUrl}/api/auth/nonce\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress })
      });
      
      const { nonce, message } = await nonceResponse.json();
      
      // Step 2: Sign the message with wallet
      const signature = await signer.signMessage(message);
      
      // Step 3: Authenticate with server
      const authResponse = await fetch(\`\${this.apiUrl}/api/auth/wallet\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          signature,
          message,
          nonce
        })
      });
      
      const authData = await authResponse.json();
      
      // Store access token
      localStorage.setItem('accessToken', authData.accessToken);
      
      return authData;
      
    } catch (error) {
      console.error('Wallet authentication failed:', error);
      throw error;
    }
  }

  async makeAuthenticatedRequest(url: string, options: RequestInit = {}) {
    const token = localStorage.getItem('accessToken');
    
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': \`Bearer \${token}\`
      }
    });
  }

  async refreshToken() {
    try {
      const response = await fetch(\`\${this.apiUrl}/api/auth/refresh\`, {
        method: 'POST',
        credentials: 'include' // Include httpOnly refresh token cookie
      });
      
      const data = await response.json();
      localStorage.setItem('accessToken', data.accessToken);
      
      return data;
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw error;
    }
  }

  async logout() {
    try {
      const token = localStorage.getItem('accessToken');
      
      await fetch(\`\${this.apiUrl}/api/auth/logout\`, {
        method: 'POST',
        headers: { 'Authorization': \`Bearer \${token}\` },
        credentials: 'include'
      });
      
      localStorage.removeItem('accessToken');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }
}

// Usage example
const authClient = new WalletAuthClient('http://localhost:3001');

// Connect to MetaMask and authenticate
async function connectWallet() {
  if (window.ethereum) {
    const provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    
    const authData = await authClient.authenticateWallet(address, signer);
    console.log('Authentication successful:', authData);
  }
}
`;

// Environment variables example
export const environmentVariablesExample = `
# .env file example for Web3 wallet authentication

# JWT Configuration (REQUIRED)
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
JWT_REFRESH_SECRET=your-super-secret-refresh-key-minimum-32-characters-long
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/prediction_market

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_KEY_PREFIX=pm:

# Application Configuration
NODE_ENV=development
PORT=3001
APP_DOMAIN=localhost:3000

# Blockchain Configuration
CHAIN_ID=1
VERIFYING_CONTRACT=0x0000000000000000000000000000000000000000

# Security Configuration (Production)
# NODE_ENV=production
# JWT_SECRET=your-production-secret-key
# JWT_REFRESH_SECRET=your-production-refresh-secret
`;

if (require.main === module) {
  exampleUsage().catch(console.error);
}