import { Request, Response } from 'express';
export declare class AuthController {
    /**
     * Request OTP
     * POST /auth/otp/request
     */
    static requestOTP(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Verify OTP and login/signup
     * POST /auth/otp/verify
     */
    static verifyOTP(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Validate token
     * POST /auth/validate
     */
    static validateToken(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Logout (client-side token removal)
     * POST /auth/logout
     */
    static logout(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
}
//# sourceMappingURL=auth.controller.d.ts.map