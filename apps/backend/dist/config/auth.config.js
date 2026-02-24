"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authConfig = void 0;
exports.validateAuthConfig = validateAuthConfig;
exports.getAuthConfig = getAuthConfig;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.authConfig = {
    jwt: {
        secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
        refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-change-in-production',
        accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
        refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
        issuer: 'prediction-market-platform',
        audience: 'prediction-market-users'
    },
    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        keyPrefix: process.env.REDIS_KEY_PREFIX || 'pm:',
        ttl: {
            nonce: 300,
            refreshToken: 7 * 24 * 60 * 60,
            blacklist: 15 * 60
        }
    },
    wallet: {
        supportedTypes: ['MetaMask', 'WalletConnect', 'Coinbase Wallet'],
        messageTemplate: {
            domain: process.env.APP_DOMAIN || 'localhost:3000',
            version: '1',
            chainId: parseInt(process.env.CHAIN_ID || '1'),
            verifyingContract: process.env.VERIFYING_CONTRACT || '0x0000000000000000000000000000000000000000'
        }
    },
    security: {
        nonceLength: 12,
        maxLoginAttempts: 5,
        lockoutDuration: 15 * 60,
        requireHttps: process.env.NODE_ENV === 'production',
        cookieSettings: {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        }
    },
    rateLimiting: {
        nonce: {
            windowMs: 15 * 60 * 1000,
            max: 10
        },
        auth: {
            windowMs: 15 * 60 * 1000,
            max: 5
        },
        refresh: {
            windowMs: 15 * 60 * 1000,
            max: 20
        }
    }
};
function validateAuthConfig() {
    const requiredEnvVars = [
        'JWT_SECRET',
        'JWT_REFRESH_SECRET'
    ];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
    if (process.env.NODE_ENV === 'production') {
        if (exports.authConfig.jwt.secret.includes('change-in-production')) {
            throw new Error('JWT_SECRET must be set to a secure value in production');
        }
        if (exports.authConfig.jwt.refreshSecret.includes('change-in-production')) {
            throw new Error('JWT_REFRESH_SECRET must be set to a secure value in production');
        }
    }
}
function getAuthConfig() {
    validateAuthConfig();
    return exports.authConfig;
}
//# sourceMappingURL=auth.config.js.map