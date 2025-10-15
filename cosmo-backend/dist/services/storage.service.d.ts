export declare class StorageService {
    private static getPublicUrl;
    /**
     * Upload profile photo
     */
    static uploadProfilePhoto(userId: string, file: Express.Multer.File): Promise<string>;
    /**
     * Upload event photo
     */
    static uploadEventPhoto(eventId: string, file: Express.Multer.File): Promise<string>;
    /**
     * Delete profile photo
     */
    static deleteProfilePhoto(photoUrl: string): Promise<void>;
    /**
     * Delete all user photos
     */
    static deleteAllUserPhotos(userId: string): Promise<void>;
}
//# sourceMappingURL=storage.service.d.ts.map