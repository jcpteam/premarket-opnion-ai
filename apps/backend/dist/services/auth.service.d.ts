import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';
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
export declare class AuthService {
    private prisma;
    private redis;
    private jwtSecret;
    private jwtRefreshSecret;
    private accessTokenExpiry;
    private refreshTokenExpiry;
    constructor(prisma: PrismaClient, redis: ReturnType<typeof createClient>, config: {
        jwtSecret: string;
        jwtRefreshSecret: string;
        accessTokenExpiry?: string;
        refreshTokenExpiry?: string;
    });
    generateNonce(walletAddress: string): Promise<string>;
    generateAuthMessage(walletAddress: string, nonce: string): string;
    authenticateWallet(request: WalletAuthRequest): Promise<AuthToken>;
    private generateTokens;
    validateToken(token: string): Promise<any>;
    refreshToken(refreshToken: string): Promise<AuthToken>;
    revokeToken(token: string): Promise<void>;
    isTokenBlacklisted(token: string): Promise<boolean>;
    private storeRefreshToken;
    private parseTokenExpiry;
    getSessionInfo(userId: string): Promise<any>;
    clearUserSessions(userId: string): Promise<void>;
}
//# sourceMappingURL=auth.service.d.ts.map