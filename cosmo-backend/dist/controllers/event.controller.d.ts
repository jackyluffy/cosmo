import { Request, Response } from 'express';
export declare class EventController {
    /**
     * Get all available events
     * GET /events
     */
    static getEvents(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Get event by ID
     * GET /events/:id
     */
    static getEvent(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Create new event (for organizers)
     * POST /events
     */
    static createEvent(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Join event
     * POST /events/:id/join
     */
    static joinEvent(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Leave event
     * DELETE /events/:id/leave
     */
    static leaveEvent(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Calculate distance between two points
     */
    private static calculateDistance;
}
//# sourceMappingURL=event.controller.d.ts.map