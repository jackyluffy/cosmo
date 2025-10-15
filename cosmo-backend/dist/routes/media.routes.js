"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mediaRoutes = void 0;
const express_1 = require("express");
const storage_1 = require("@google-cloud/storage");
const router = (0, express_1.Router)();
const storage = new storage_1.Storage();
/**
 * Proxy images from Google Cloud Storage
 * GET /media/image/:bucketName/:path
 */
router.get('/image/*', async (req, res) => {
    try {
        // Get the full path after /image/
        const fullPath = req.params[0];
        if (!fullPath) {
            return res.status(400).send('Invalid image path');
        }
        const bucketName = process.env.GCLOUD_STORAGE_BUCKET || 'cosmo-app-photos';
        const bucket = storage.bucket(bucketName);
        const file = bucket.file(fullPath);
        // Check if file exists
        const [exists] = await file.exists();
        if (!exists) {
            return res.status(404).send('Image not found');
        }
        // Get file metadata for content type
        const [metadata] = await file.getMetadata();
        // Set appropriate headers
        res.setHeader('Content-Type', metadata.contentType || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
        // Stream the file
        file.createReadStream()
            .on('error', (error) => {
            console.error('[Media Proxy] Stream error:', error);
            if (!res.headersSent) {
                res.status(500).send('Error streaming image');
            }
        })
            .pipe(res);
    }
    catch (error) {
        console.error('[Media Proxy] Error:', error);
        if (!res.headersSent) {
            res.status(500).send('Failed to load image');
        }
    }
});
exports.mediaRoutes = router;
//# sourceMappingURL=media.routes.js.map