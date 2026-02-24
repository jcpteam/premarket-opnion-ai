"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuthRouter = createAuthRouter;
const express_1 = require("express");
const logger_1 = require("../config/logger");
const joi_1 = __importDefault(require("joi"));
function createAuthRouter(dependencies) {
    const router = (0, express_1.Router)();
    const { authService } = dependencies;
    const nonceSchema = joi_1.default.object({
        walletAddress: joi_1.default.string()
            .pattern(/^0x[a-fA-F0-9]{40}$/)
            .required()
            .messages({
            'string.pattern.base': 'Invalid wallet address format'
        })
    });
    const walletAuthSchema = joi_1.default.object({
        walletAddress: joi_1.default.string()
            .pattern(/^0x[a-fA-F0-9]{40}$/)
            .required(),
        signature: joi_1.default.string().required(),
        message: joi_1.default.string().required(),
        nonce: joi_1.default.string().required()
    });
    const refreshTokenSchema = joi_1.default.object({
        refreshToken: joi_1.default.string().required()
    });
    router.post('/nonce', async (req, res) => {
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
        }
        catch (error) {
            logger_1.logger.error('Nonce generation failed', {
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
    router.post('/wallet', async (req, res) => {
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
            res.cookie('refreshToken', authToken.refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000
            });
            res.json({
                accessToken: authToken.accessToken,
                expiresIn: authToken.expiresIn,
                user: authToken.user
            });
        }
        catch (error) {
            logger_1.logger.error('Wallet authentication failed', {
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
    router.post('/refresh', async (req, res) => {
        try {
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
            res.cookie('refreshToken', authToken.refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000
            });
            res.json({
                accessToken: authToken.accessToken,
                expiresIn: authToken.expiresIn,
                user: authToken.user
            });
        }
        catch (error) {
            logger_1.logger.error('Token refresh failed', {
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
    router.post('/logout', async (req, res) => {
        try {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.substring(7);
                await authService.revokeToken(token);
            }
            res.clearCookie('refreshToken');
            res.json({
                message: 'Logged out successfully'
            });
        }
        catch (error) {
            logger_1.logger.error('Logout failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId: req.headers['x-request-id']
            });
            res.json({
                message: 'Logged out successfully'
            });
        }
    });
    router.get('/me', async (req, res) => {
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
        }
        catch (error) {
            logger_1.logger.error('Get user info failed', {
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
//# sourceMappingURL=auth.routes.js.map