import api from './api';
import * as FileSystem from 'expo-file-system';

const SIMILARITY_THRESHOLD = 0.5; // 50% similarity threshold

export interface VerificationResult {
  isVerified: boolean;
  similarity: number;
  matchedPhotoIndex?: number;
  message?: string;
}

/**
 * Verify a selfie against the user's profile photos using Google Cloud Vision API
 * @param selfieUri - The URI of the selfie image
 * @param profilePhotos - Array of profile photo URLs
 * @returns Verification result with similarity score
 */
export async function verifySelfie(
  selfieUri: string,
  profilePhotos: string[]
): Promise<VerificationResult> {
  try {
    console.log('[VerificationService] Starting verification...');
    console.log('[VerificationService] Selfie URI:', selfieUri);
    console.log('[VerificationService] Profile photos count:', profilePhotos.length);

    // Convert selfie to base64
    const selfieBase64 = await FileSystem.readAsStringAsync(selfieUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Call backend API for verification
    const response = await api.post('/api/v1/verification/verify-selfie', {
      selfieBase64,
      profilePhotos,
      threshold: SIMILARITY_THRESHOLD,
    });

    console.log('[VerificationService] Verification response:', response.data);

    const { verified, similarity, matchedPhotoIndex, message } = response.data;

    return {
      isVerified: verified,
      similarity: similarity * 100, // Convert to percentage
      matchedPhotoIndex,
      message,
    };
  } catch (error: any) {
    console.error('[VerificationService] Error:', error);

    if (error.response?.data?.error) {
      throw new Error(error.response.data.error);
    }

    throw new Error('Failed to verify selfie. Please try again.');
  }
}

/**
 * Check if user has completed verification
 */
export async function checkVerificationStatus(): Promise<boolean> {
  try {
    const response = await api.get('/api/v1/verification/status');
    return response.data.verified || false;
  } catch (error) {
    console.error('[VerificationService] Error checking status:', error);
    return false;
  }
}
