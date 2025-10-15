import { Request, Response } from 'express';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import admin from '../config/firebase';
import path from 'path';

// Initialize Vision API client with credentials
const keyFilePath = path.join(__dirname, '../../cosmo-firebase-key.json');
const vision = new ImageAnnotatorClient({
  keyFilename: keyFilePath,
});

export class VerificationController {
  /**
   * Verify selfie against profile photos using Google Cloud Vision API
   */
  async verifySelfie(req: Request, res: Response) {
    try {
      const userId = req.userId;
      const { selfieBase64, profilePhotos, threshold = 0.5 } = req.body;

      if (!selfieBase64 || !Array.isArray(profilePhotos) || profilePhotos.length === 0) {
        return res.status(400).json({
          error: 'Missing required fields: selfieBase64 and profilePhotos',
        });
      }

      console.log(`\n========== VERIFICATION STARTED ==========`);
      console.log(`[Verification] User ID: ${userId}`);
      console.log(`[Verification] Profile photos count: ${profilePhotos.length}`);
      console.log(`[Verification] Profile photos URLs:`, profilePhotos);
      console.log(`[Verification] Threshold: ${(threshold * 100).toFixed(0)}%`);
      console.log(`[Verification] Selfie base64 length: ${selfieBase64.length} characters`);

      // Convert selfie base64 to buffer
      const selfieBuffer = Buffer.from(selfieBase64, 'base64');
      console.log(`[Verification] Selfie buffer size: ${selfieBuffer.length} bytes`);

      // Detect faces in the selfie
      console.log(`[Verification] Calling Google Vision API for selfie face detection...`);
      const [selfieResult] = await vision.faceDetection({
        image: { content: selfieBuffer },
      });

      const selfieFaces = selfieResult.faceAnnotations || [];
      console.log(`[Verification] Faces detected in selfie: ${selfieFaces.length}`);

      if (selfieFaces.length === 0) {
        console.error(`[Verification] FAILED: No face detected in selfie`);
        return res.status(400).json({
          error: 'No face detected in selfie. Please try again with a clear photo of your face.',
        });
      }

      if (selfieFaces.length > 1) {
        console.error(`[Verification] FAILED: Multiple faces detected (${selfieFaces.length})`);
        return res.status(400).json({
          error: 'Multiple faces detected. Please take a selfie with only your face visible.',
        });
      }

      console.log(`[Verification] ✓ Detected 1 face in selfie`);

      // Get the face from selfie
      const selfieFace = selfieFaces[0];
      const selfieConfidence = selfieFace.detectionConfidence || 0;
      console.log(`[Verification] Selfie face detection confidence: ${(selfieConfidence * 100).toFixed(2)}%`);
      console.log(`[Verification] Selfie landmarks count: ${selfieFace.landmarks?.length || 0}`);

      // Check face detection confidence
      if (selfieConfidence < 0.7) {
        console.error(`[Verification] FAILED: Face detection confidence too low (${(selfieConfidence * 100).toFixed(2)}%)`);
        return res.status(400).json({
          error: 'Face detection confidence too low. Please try again with better lighting.',
        });
      }

      // Compare with each profile photo
      let bestMatch = {
        similarity: 0,
        photoIndex: -1,
      };

      const allSimilarities: { photoIndex: number; similarity: number; photoUrl: string }[] = [];
      console.log(`\n---------- COMPARING WITH PROFILE PHOTOS ----------`);

      for (let i = 0; i < profilePhotos.length; i++) {
        const photoUrl = profilePhotos[i];
        console.log(`\n[Verification] Photo ${i + 1}/${profilePhotos.length}:`);
        console.log(`[Verification]   URL: ${photoUrl}`);

        try {
          // Fetch profile photo
          console.log(`[Verification]   Fetching profile photo...`);
          const photoResponse = await fetch(photoUrl);
          if (!photoResponse.ok) {
            console.warn(`[Verification]   ✗ SKIPPED: Failed to fetch (${photoResponse.status} ${photoResponse.statusText})`);
            allSimilarities.push({ photoIndex: i, similarity: 0, photoUrl });
            continue;
          }

          const photoBuffer = Buffer.from(await photoResponse.arrayBuffer());
          console.log(`[Verification]   ✓ Fetched (${photoBuffer.length} bytes)`);

          // Detect faces in profile photo
          console.log(`[Verification]   Detecting faces in profile photo...`);
          const [photoResult] = await vision.faceDetection({
            image: { content: photoBuffer },
          });

          const photoFaces = photoResult.faceAnnotations || [];
          console.log(`[Verification]   Faces detected: ${photoFaces.length}`);

          if (photoFaces.length === 0) {
            console.warn(`[Verification]   ✗ SKIPPED: No face detected in profile photo`);
            allSimilarities.push({ photoIndex: i, similarity: 0, photoUrl });
            continue;
          }

          const photoFace = photoFaces[0];
          const photoConfidence = photoFace.detectionConfidence || 0;
          console.log(`[Verification]   Face detection confidence: ${(photoConfidence * 100).toFixed(2)}%`);
          console.log(`[Verification]   Landmarks count: ${photoFace.landmarks?.length || 0}`);

          // Compare faces using face landmarks
          console.log(`[Verification]   Comparing faces...`);
          const similarity = this.compareFaces(selfieFace, photoFaces[0]);
          console.log(`[Verification]   ✓ SIMILARITY SCORE: ${(similarity * 100).toFixed(2)}%`);

          allSimilarities.push({ photoIndex: i, similarity, photoUrl });

          if (similarity > bestMatch.similarity) {
            console.log(`[Verification]   🏆 NEW BEST MATCH! (previous: ${(bestMatch.similarity * 100).toFixed(2)}%)`);
            bestMatch = {
              similarity,
              photoIndex: i,
            };
          } else {
            console.log(`[Verification]   (Not better than current best: ${(bestMatch.similarity * 100).toFixed(2)}%)`);
          }
        } catch (error: any) {
          console.error(`[Verification]   ✗ ERROR processing photo:`, error.message);
          console.error(`[Verification]   Error stack:`, error.stack);
          allSimilarities.push({ photoIndex: i, similarity: 0, photoUrl });
          continue;
        }
      }

      console.log(`\n---------- COMPARISON SUMMARY ----------`);
      console.log(`[Verification] All similarity scores:`);
      allSimilarities.forEach(({ photoIndex, similarity, photoUrl }) => {
        const status = similarity === bestMatch.similarity && similarity > 0 ? '🏆 BEST' : '  ';
        console.log(`[Verification]   ${status} Photo ${photoIndex + 1}: ${(similarity * 100).toFixed(2)}% - ${photoUrl}`);
      });

      // Check if best match exceeds threshold
      const verified = bestMatch.similarity >= threshold;

      console.log(`\n========== FINAL RESULT ==========`);
      console.log(`[Verification] Best Match Photo: #${bestMatch.photoIndex + 1}`);
      console.log(`[Verification] Best Similarity: ${(bestMatch.similarity * 100).toFixed(2)}%`);
      console.log(`[Verification] Required Threshold: ${(threshold * 100).toFixed(2)}%`);
      console.log(`[Verification] Difference: ${((bestMatch.similarity - threshold) * 100).toFixed(2)}%`);
      console.log(`[Verification] VERIFICATION RESULT: ${verified ? '✓ PASSED' : '✗ FAILED'}`);

      // If verified, update user profile
      if (verified) {
        console.log(`[Verification] Updating user profile to mark as verified...`);
        await admin.firestore().collection('users').doc(userId).update({
          'profile.verified': true,
          'profile.verificationDate': admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`[Verification] ✓ Profile updated successfully`);
      } else {
        console.log(`[Verification] Not updating profile - verification failed`);
      }

      const responseData = {
        verified,
        similarity: bestMatch.similarity,
        matchedPhotoIndex: bestMatch.photoIndex,
        allSimilarities: allSimilarities.map(s => ({
          photoIndex: s.photoIndex,
          similarity: s.similarity,
        })),
        message: verified
          ? 'Verification successful!'
          : `Verification failed. Similarity ${(bestMatch.similarity * 100).toFixed(0)}% is below threshold ${(threshold * 100).toFixed(0)}%`,
      };

      console.log(`[Verification] Sending response:`, JSON.stringify(responseData, null, 2));
      console.log(`========== VERIFICATION ENDED ==========\n`);

      return res.json(responseData);
    } catch (error: any) {
      console.error('[Verification] Error:', error);
      return res.status(500).json({
        error: 'Failed to verify selfie',
        details: error.message,
      });
    }
  }

  /**
   * Get verification status for the current user
   */
  async getVerificationStatus(req: Request, res: Response) {
    try {
      const userId = req.userId;

      const userDoc = await admin.firestore().collection('users').doc(userId).get();
      const userData = userDoc.data();

      return res.json({
        verified: userData?.profile?.verified || false,
        verificationDate: userData?.profile?.verificationDate?.toDate?.() || null,
      });
    } catch (error: any) {
      console.error('[Verification] Error getting status:', error);
      return res.status(500).json({
        error: 'Failed to get verification status',
      });
    }
  }

  /**
   * Compare two faces using facial landmarks
   * Returns a similarity score between 0 and 1
   */
  private compareFaces(face1: any, face2: any): number {
    // Key facial landmarks to compare
    const landmarkTypes = [
      'LEFT_EYE',
      'RIGHT_EYE',
      'NOSE_TIP',
      'MOUTH_CENTER',
      'LEFT_EAR_TRAGION',
      'RIGHT_EAR_TRAGION',
    ];

    // Get landmark positions for both faces
    const landmarks1 = this.extractLandmarks(face1, landmarkTypes);
    const landmarks2 = this.extractLandmarks(face2, landmarkTypes);

    if (landmarks1.length === 0 || landmarks2.length === 0) {
      // Fallback to bounding box comparison
      return this.compareBoundingBoxes(face1.boundingPoly, face2.boundingPoly);
    }

    // Calculate normalized distances between corresponding landmarks
    const distances: number[] = [];

    for (let i = 0; i < landmarks1.length; i++) {
      if (landmarks1[i] && landmarks2[i]) {
        const distance = this.euclideanDistance(landmarks1[i], landmarks2[i]);
        distances.push(distance);
      }
    }

    if (distances.length === 0) {
      return this.compareBoundingBoxes(face1.boundingPoly, face2.boundingPoly);
    }

    // Calculate average distance
    const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;

    // Convert distance to similarity score (0-1)
    // Lower distance = higher similarity
    // We use a tolerance threshold to account for different angles and lighting
    const maxTolerance = 200; // Maximum acceptable distance for 0% similarity
    const similarity = Math.max(0, 1 - avgDistance / maxTolerance);

    return similarity;
  }

  /**
   * Extract landmark positions from face annotation
   */
  private extractLandmarks(face: any, types: string[]): Array<{ x: number; y: number }> {
    if (!face.landmarks) return [];

    const positions: Array<{ x: number; y: number }> = [];

    for (const type of types) {
      const landmark = face.landmarks.find((l: any) => l.type === type);
      if (landmark?.position) {
        positions.push({
          x: landmark.position.x || 0,
          y: landmark.position.y || 0,
        });
      }
    }

    return positions;
  }

  /**
   * Calculate Euclidean distance between two points
   */
  private euclideanDistance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
  }

  /**
   * Compare face bounding boxes as a fallback
   */
  private compareBoundingBoxes(box1: any, box2: any): number {
    if (!box1?.vertices || !box2?.vertices) return 0;

    // Calculate bounding box centers and sizes
    const center1 = this.getBoundingBoxCenter(box1.vertices);
    const center2 = this.getBoundingBoxCenter(box2.vertices);
    const size1 = this.getBoundingBoxSize(box1.vertices);
    const size2 = this.getBoundingBoxSize(box2.vertices);

    // Compare centers (normalized by size)
    const centerDistance = this.euclideanDistance(center1, center2) / Math.max(size1, size2);

    // Compare sizes
    const sizeRatio = Math.min(size1, size2) / Math.max(size1, size2);

    // Combine metrics
    const similarity = sizeRatio * Math.max(0, 1 - centerDistance);

    return similarity;
  }

  /**
   * Get center point of bounding box
   */
  private getBoundingBoxCenter(vertices: any[]): { x: number; y: number } {
    const x = vertices.reduce((sum, v) => sum + (v.x || 0), 0) / vertices.length;
    const y = vertices.reduce((sum, v) => sum + (v.y || 0), 0) / vertices.length;
    return { x, y };
  }

  /**
   * Get size of bounding box
   */
  private getBoundingBoxSize(vertices: any[]): number {
    const xs = vertices.map((v) => v.x || 0);
    const ys = vertices.map((v) => v.y || 0);
    const width = Math.max(...xs) - Math.min(...xs);
    const height = Math.max(...ys) - Math.min(...ys);
    return Math.sqrt(width * width + height * height);
  }
}
