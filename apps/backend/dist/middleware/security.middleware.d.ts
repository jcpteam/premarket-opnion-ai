import { Request, Response, NextFunction } from 'express';
export declare const securityHeaders: (_req: Request, res: Response, next: NextFunction) => void;
export declare const requestSizeLimiter: (maxSize?: string) => (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const suspiciousActivityDetector: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const ipFilter: (options: {
    whitelist?: string[];
    blacklist?: string[];
}) => (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const requestTimeout: (timeoutMs?: number) => (req: Request, res: Response, next: NextFunction) => void;
export declare const validateUserAgent: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
declare function parseSize(size: string): number;
export { parseSize };
//# sourceMappingURL=security.middleware.d.ts.map