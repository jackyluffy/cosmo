import { Request, Response } from 'express';
export declare class ProfileController {
    /**
     * Get current user profile
     * GET /profile/me
     */
    static getMyProfile(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Update user profile
     * PUT /profile
     */
    static updateProfile(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Update user location
     * PUT /profile/location
     */
    static updateLocation(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Upload profile photo
     * POST /profile/photo
     */
    static uploadPhoto(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Delete profile photo
     * DELETE /profile/photo
     */
    static deletePhoto(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Update user interests
     * PUT /profile/interests
     */
    static updateInterests(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
}
//# sourceMappingURL=profile.controller.d.ts.map