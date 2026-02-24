import { Router } from 'express';
import { AuthService } from '../services/auth.service';
export interface AuthRouterDependencies {
    authService: AuthService;
}
export declare function createAuthRouter(dependencies: AuthRouterDependencies): Router;
//# sourceMappingURL=auth.routes.d.ts.map