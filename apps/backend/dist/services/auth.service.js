"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const ethers_1 = require("ethers");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const logger_1 = require("../config/logger");
class AuthService {
    constructor(prisma, redis, config) {
        this.prisma = prisma;
        this.redis = redis;
        this.jwtSecret = config.jwtSecret;
        this.jwtRefreshSecret = config.jwtRefreshSecret;
        this.accessTokenExpiry = config.accessTokenExpiry || '15m';
        this.refreshTokenExpiry = config.refreshTokenExpiry || '7d';
    }
    async generateNonce(walletAddress) {
        const nonce = Math.random().toString(36).substring(2, 15);
        const key = `auth:nonce:${walletAddress.toLowerCase()}`;
        await this.redis.setEx(key, 300, nonce);
        logger_1.logger.info('Generated nonce for wallet authentication', {
            walletAddress: walletAddress.toLowerCase(),
            nonce
        });
        return nonce;
    }
    generateAuthMessage(walletAddress, nonce) {
        return `Welcome to Prediction Market Platform!

This request will not trigger a blockchain transaction or cost any gas fees.

Wallet address: ${walletAddress}
Nonce: ${nonce}
Timestamp: ${new Date().toISOString()}

Sign this message to authenticate your wallet.`;
    }
    async authenticateWallet(request) {
        const { walletAddress, signature, message, nonce } = request;
        const normalizedAddress = walletAddress.toLowerCase();
        try {
            const storedNonce = await this.redis.get(`auth:nonce:${normalizedAddress}`);
            if (!storedNonce || storedNonce !== nonce) {
                throw new Error('Invalid or expired nonce');
            }
            const recoveredAddress = ethers_1.ethers.verifyMessage(message, signature);
            if (recoveredAddress.toLowerCase() !== normalizedAddress) {
                throw new Error('Invalid signature');
            }
            await this.redis.del(`auth:nonce:${normalizedAddress}`);
            let user = await this.prisma.user.findUnique({
                where: { walletAddress: normalizedAddress }
            });
            if (!user) {
                user = await this.prisma.user.create({
                    data: {
                        walletAddress: normalizedAddress,
                        isVerified: true,
                    }
                });
                logger_1.logger.info('Created new user from wallet authentication', {
                    userId: user.id,
                    walletAddress: normalizedAddress
                });
            }
            const tokens = await this.generateTokens(user);
            await this.storeRefreshToken(user.id, tokens.refreshToken);
            logger_1.logger.info('Wallet authentication successful', {
                userId: user.id,
                walletAddress: normalizedAddress
            });
            return tokens;
        }
        catch (error) {
            logger_1.logger.error('Wallet authentication failed', {
                walletAddress: normalizedAddress,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async generateTokens(user) {
        const accessPayload = {
            userId: user.id,
            walletAddress: user.walletAddress,
            isAdmin: user.isAdmin,
            type: 'access'
        };
        const refreshPayload = {
            userId: user.id,
            walletAddress: user.walletAddress,
            isAdmin: user.isAdmin,
            type: 'refresh'
        };
        const accessToken = jsonwebtoken_1.default.sign(accessPayload, this.jwtSecret);
        const refreshToken = jsonwebtoken_1.default.sign(refreshPayload, this.jwtRefreshSecret);
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
    async validateToken(token) {
        try {
            const payload = jsonwebtoken_1.default.verify(token, this.jwtSecret);
            if (payload.type !== 'access') {
                throw new Error('Invalid token type');
            }
            const user = await this.prisma.user.findUnique({
                where: { id: payload.userId }
            });
            if (!user) {
                throw new Error('User not found');
            }
            return user;
        }
        catch (error) {
            logger_1.logger.warn('Token validation failed', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw new Error('Invalid token');
        }
    }
    async refreshToken(refreshToken) {
        try {
            const payload = jsonwebtoken_1.default.verify(refreshToken, this.jwtRefreshSecret);
            if (payload.type !== 'refresh') {
                throw new Error('Invalid token type');
            }
            const storedToken = await this.redis.get(`refresh:${payload.userId}`);
            if (!storedToken || storedToken !== refreshToken) {
                throw new Error('Invalid refresh token');
            }
            const user = await this.prisma.user.findUnique({
                where: { id: payload.userId }
            });
            if (!user) {
                throw new Error('User not found');
            }
            const tokens = await this.generateTokens(user);
            await this.storeRefreshToken(user.id, tokens.refreshToken);
            logger_1.logger.info('Token refresh successful', {
                userId: user.id,
                walletAddress: user.walletAddress
            });
            return tokens;
        }
        catch (error) {
            logger_1.logger.error('Token refresh failed', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw new Error('Invalid refresh token');
        }
    }
    async revokeToken(token) {
        try {
            const payload = jsonwebtoken_1.default.verify(token, this.jwtSecret);
            await this.redis.del(`refresh:${payload.userId}`);
            const tokenKey = `blacklist:${token}`;
            const expiresIn = this.parseTokenExpiry(this.accessTokenExpiry);
            await this.redis.setEx(tokenKey, expiresIn, 'revoked');
            logger_1.logger.info('Token revoked successfully', {
                userId: payload.userId,
                walletAddress: payload.walletAddress
            });
        }
        catch (error) {
            logger_1.logger.warn('Token revocation failed', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async isTokenBlacklisted(token) {
        const result = await this.redis.get(`blacklist:${token}`);
        return result !== null;
    }
    async storeRefreshToken(userId, refreshToken) {
        const key = `refresh:${userId}`;
        const expiresIn = this.parseTokenExpiry(this.refreshTokenExpiry);
        await this.redis.setEx(key, expiresIn, refreshToken);
    }
    parseTokenExpiry(expiry) {
        const unit = expiry.slice(-1);
        const value = parseInt(expiry.slice(0, -1));
        switch (unit) {
            case 's': return value;
            case 'm': return value * 60;
            case 'h': return value * 60 * 60;
            case 'd': return value * 60 * 60 * 24;
            default: return 900;
        }
    }
    async getSessionInfo(userId) {
        const refreshToken = await this.redis.get(`refresh:${userId}`);
        return {
            hasActiveSession: !!refreshToken,
            userId
        };
    }
    async clearUserSessions(userId) {
        await this.redis.del(`refresh:${userId}`);
        logger_1.logger.info('Cleared user sessions', { userId });
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=auth.service.js.map