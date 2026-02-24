export declare const authConfig: {
    jwt: {
        secret: string;
        refreshSecret: string;
        accessTokenExpiry: string;
        refreshTokenExpiry: string;
        issuer: string;
        audience: string;
    };
    redis: {
        url: string;
        keyPrefix: string;
        ttl: {
            nonce: number;
            refreshToken: number;
            blacklist: number;
        };
    };
    wallet: {
        supportedTypes: string[];
        messageTemplate: {
            domain: string;
            version: string;
            chainId: number;
            verifyingContract: string;
        };
    };
    security: {
        nonceLength: number;
        maxLoginAttempts: number;
        lockoutDuration: number;
        requireHttps: boolean;
        cookieSettings: {
            httpOnly: boolean;
            secure: boolean;
            sameSite: "strict";
            maxAge: number;
        };
    };
    rateLimiting: {
        nonce: {
            windowMs: number;
            max: number;
        };
        auth: {
            windowMs: number;
            max: number;
        };
        refresh: {
            windowMs: number;
            max: number;
        };
    };
};
export declare function validateAuthConfig(): void;
export declare function getAuthConfig(): {
    jwt: {
        secret: string;
        refreshSecret: string;
        accessTokenExpiry: string;
        refreshTokenExpiry: string;
        issuer: string;
        audience: string;
    };
    redis: {
        url: string;
        keyPrefix: string;
        ttl: {
            nonce: number;
            refreshToken: number;
            blacklist: number;
        };
    };
    wallet: {
        supportedTypes: string[];
        messageTemplate: {
            domain: string;
            version: string;
            chainId: number;
            verifyingContract: string;
        };
    };
    security: {
        nonceLength: number;
        maxLoginAttempts: number;
        lockoutDuration: number;
        requireHttps: boolean;
        cookieSettings: {
            httpOnly: boolean;
            secure: boolean;
            sameSite: "strict";
            maxAge: number;
        };
    };
    rateLimiting: {
        nonce: {
            windowMs: number;
            max: number;
        };
        auth: {
            windowMs: number;
            max: number;
        };
        refresh: {
            windowMs: number;
            max: number;
        };
    };
};
//# sourceMappingURL=auth.config.d.ts.map