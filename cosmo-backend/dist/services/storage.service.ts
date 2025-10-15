import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';
import { Buckets } from '../config/firebase';

const storage = new Storage();

export class StorageService {
  private static getProxiedUrl(fileName: string): string {
    // Get API base URL from environment or use default
    const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:8080';
    return `${apiBaseUrl}/api/v1/media/image/${fileName}`;
  }

  private static getPublicUrl(bucketName: string, fileName: string): string {
    return `https://storage.googleapis.com/${bucketName}/${fileName}`;
  }

  /**
   * Upload profile photo
   */
  static async uploadProfilePhoto(userId: string, file: Express.Multer.File): Promise<string> {
    const bucketName = process.env.GCLOUD_STORAGE_BUCKET || 'cosmo-app-photos';
    const bucket = storage.bucket(bucketName);

    // Generate unique filename
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${Buckets.PROFILE_PHOTOS}/${userId}/${uuidv4()}.${fileExtension}`;

    // Create file in bucket
    const blob = bucket.file(fileName);
    const blobStream = blob.createWriteStream({
      resumable: false,
      metadata: {
        contentType: file.mimetype,
        metadata: {
          userId,
          uploadedAt: new Date().toISOString(),
        },
      },
    });

    return new Promise((resolve, reject) => {
      blobStream.on('error', (err) => {
        console.error('Upload error:', err);
        reject(new Error('Failed to upload file'));
      });

      blobStream.on('finish', async () => {
        // Use proxied URL through our API
        const proxiedUrl = this.getProxiedUrl(fileName);
        console.log('[Storage] Generated proxied URL:', proxiedUrl);
        resolve(proxiedUrl);
      });

      blobStream.end(file.buffer);
    });
  }

  /**
   * Upload event photo
   */
  static async uploadEventPhoto(eventId: string, file: Express.Multer.File): Promise<string> {
    const bucketName = process.env.GCLOUD_STORAGE_BUCKET || 'cosmo-app-photos';
    const bucket = storage.bucket(bucketName);

    // Generate unique filename
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${Buckets.EVENT_PHOTOS}/${eventId}/${uuidv4()}.${fileExtension}`;

    // Create file in bucket
    const blob = bucket.file(fileName);
    const blobStream = blob.createWriteStream({
      resumable: false,
      metadata: {
        contentType: file.mimetype,
        metadata: {
          eventId,
          uploadedAt: new Date().toISOString(),
        },
      },
    });

    return new Promise((resolve, reject) => {
      blobStream.on('error', (err) => {
        console.error('Upload error:', err);
        reject(new Error('Failed to upload file'));
      });

      blobStream.on('finish', async () => {
        // Use proxied URL through our API
        const proxiedUrl = this.getProxiedUrl(fileName);
        console.log('[Storage] Generated proxied URL:', proxiedUrl);
        resolve(proxiedUrl);
      });

      blobStream.end(file.buffer);
    });
  }

  /**
   * Delete profile photo
   */
  static async deleteProfilePhoto(photoUrl: string): Promise<void> {
    try {
      const bucketName = process.env.GCLOUD_STORAGE_BUCKET || 'cosmo-app-photos';
      const bucket = storage.bucket(bucketName);

      // Extract filename from URL (handle both proxied and direct URLs)
      const urlWithoutQuery = photoUrl.split('?')[0]; // Remove query params
      let fileName: string | null = null;

      if (urlWithoutQuery.includes('/media/image/')) {
        // Proxied URL format: http://localhost:8080/api/v1/media/image/profile-photos/...
        fileName = urlWithoutQuery.split('/media/image/')[1];
      } else if (urlWithoutQuery.includes(bucketName)) {
        // Direct GCS URL format
        fileName = urlWithoutQuery.split(`${bucketName}/`)[1];
      }

      if (!fileName) {
        throw new Error('Invalid photo URL');
      }

      console.log('[Storage] Deleting file:', fileName);

      // Delete file
      await bucket.file(fileName).delete();
    } catch (error: any) {
      console.error('Delete photo error:', error);
      throw new Error('Failed to delete photo');
    }
  }

  /**
   * Delete all user photos
   */
  static async deleteAllUserPhotos(userId: string): Promise<void> {
    try {
      const bucketName = process.env.GCLOUD_STORAGE_BUCKET || 'cosmo-app-photos';
      const bucket = storage.bucket(bucketName);

      // List all files in user's directory
      const [files] = await bucket.getFiles({
        prefix: `${Buckets.PROFILE_PHOTOS}/${userId}/`,
      });

      // Delete all files
      await Promise.all(files.map(file => file.delete()));
    } catch (error: any) {
      console.error('Delete all photos error:', error);
      throw new Error('Failed to delete photos');
    }
  }
}