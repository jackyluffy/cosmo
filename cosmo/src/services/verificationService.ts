import api from './api';
import * as FileSystem from 'expo-file-system';

const SIMILARITY_THRESHOLD = 0.5; // 50% similarity threshold

export interface CapturedPhotoPayload {
  uri: string;
  base64?: string;
}

export interface VerificationResult {
  isVerified: boolean;
  similarity: number;
  matchedPhotoIndex?: number;
  message?: string;
}

/**
 * Verify a selfie against the user's profile photos using Google Cloud Vision API
 * @param selfie - Captured selfie payload (URI with optional base64 string)
 * @param profilePhotos - Array of profile photo URLs
 * @returns Verification result with similarity score
 */
export async function verifySelfie(
  selfie: CapturedPhotoPayload,
  profilePhotos: string[]
): Promise<VerificationResult> {
  try {
    console.log('[VerificationService] Starting verification...');
    console.log('[VerificationService] Selfie URI:', selfie.uri);
    console.log('[VerificationService] Has inline base64:', !!selfie.base64);
    console.log('[VerificationService] Profile photos count:', profilePhotos.length);
    console.log('[VerificationService] Profile photos:', profilePhotos);

    // Convert selfie to base64 (prefer the inline payload from Camera)
    let selfieBase64 = selfie.base64;
    if (!selfieBase64) {
      console.log('[VerificationService] No base64 on payload – reading from filesystem...');
      selfieBase64 = await FileSystem.readAsStringAsync(selfie.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }

    if (!selfieBase64) {
      throw new Error('Unable to read captured selfie data.');
    }

    console.log('[VerificationService] Selfie base64 length:', selfieBase64.length);
    console.log('[VerificationService] API Base URL:', process.env.EXPO_PUBLIC_API_URL);

    // Call backend API for verification
    console.log('[VerificationService] Calling backend API...');
    console.log('[VerificationService] Endpoint: /api/v1/verification/verify-selfie');
    console.log('[VerificationService] Request payload:', {
      selfieBase64Length: selfieBase64.length,
      profilePhotosCount: profilePhotos.length,
      profilePhotos,
      threshold: SIMILARITY_THRESHOLD,
    });

    const response = await api.post('/api/v1/verification/verify-selfie', {
      selfieBase64,
      profilePhotos,
      threshold: SIMILARITY_THRESHOLD,
    });

    console.log('[VerificationService] API call completed successfully!');
    console.log('[VerificationService] Verification response:', response.data);

    const { verified, similarity, matchedPhotoIndex, message } = response.data;

    return {
      isVerified: verified,
      similarity: similarity * 100, // Convert to percentage
      matchedPhotoIndex,
      message,
    };
  } catch (error: any) {
    console.error('\n========== VERIFICATION SERVICE ERROR ==========');
    console.error('[VerificationService] Error type:', error.constructor.name);
    console.error('[VerificationService] Error message:', error.message);
    console.error('[VerificationService] Error code:', error.code);
    console.error('[VerificationService] HTTP status:', error.response?.status);
    console.error('[VerificationService] Response data:', error.response?.data);
    console.error('[VerificationService] Response headers:', error.response?.headers);
    console.error('[VerificationService] Request URL:', error.config?.url);
    console.error('[VerificationService] Request method:', error.config?.method);
    console.error('[VerificationService] Request baseURL:', error.config?.baseURL);
    console.error('[VerificationService] Full config:', JSON.stringify(error.config, null, 2));
    console.error('[VerificationService] Full error object:', JSON.stringify({
      message: error.message,
      code: error.code,
      status: error.response?.status,
      data: error.response?.data,
    }, null, 2));
    console.error('================================================\n');

    if (error.response?.data?.error) {
      throw new Error(error.response.data.error);
    }

    if (error.response?.data?.details) {
      throw new Error(`${error.response.data.error || 'Verification failed'}: ${error.response.data.details}`);
    }

    // More specific error messages based on error type
    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timeout. Please check your internet connection and try again.');
    }

    if (error.code === 'NETWORK_ERROR' || error.message?.includes('Network')) {
      throw new Error('Network error. Please check your internet connection.');
    }

    if (!error.response) {
      throw new Error(`Unable to connect to server. Error: ${error.message}`);
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
