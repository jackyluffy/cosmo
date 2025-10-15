import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  InteractionManager,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { verifySelfie } from '../../services/verificationService';

export default function CameraVerificationScreen({ navigation }: any) {
  const [facing, setFacing] = useState<CameraType>('front');
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const cameraRef = useRef<any>(null);
  const { user, updateProfile, loadUser } = useAuthStore();

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <Text style={styles.title}>Camera Access Required</Text>
          <Text style={styles.subtitle}>
            We need to verify your identity by taking a selfie. This helps ensure the safety of our community.
          </Text>
          <TouchableOpacity style={styles.button} onPress={requestPermission}>
            <Text style={styles.buttonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const takePicture = async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
      });
      setCapturedPhoto(photo.uri);
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Error', 'Failed to take picture. Please try again.');
    }
  };

  const retakePicture = () => {
    setCapturedPhoto(null);
  };

  const handleVerify = async () => {
    if (!capturedPhoto) return;

    try {
      setIsVerifying(true);

      // Get user's uploaded photos
      const userPhotos = user?.profile?.photos || [];

      if (userPhotos.length === 0) {
        Alert.alert('Error', 'No profile photos found. Please upload photos first.');
        setIsVerifying(false);
        return;
      }

      console.log('[CameraVerification] Verifying selfie against profile photos...');

      // Call verification service
      const result = await verifySelfie(capturedPhoto, userPhotos);

      if (result.isVerified) {
        console.log('[CameraVerification] Verification successful!', result);

        // Update profile to mark as verified
        await updateProfile({
          verified: true,
          verificationDate: new Date().toISOString(),
        });

        await loadUser();

        Alert.alert(
          'Verification Successful! ✓',
          'Your identity has been verified. You can now continue.',
          [
            {
              text: 'Continue',
              onPress: () => {
                // Use InteractionManager for smooth navigation
                InteractionManager.runAfterInteractions(() => {
                  navigation.navigate('Interests');
                });
              },
            },
          ]
        );
      } else {
        console.log('[CameraVerification] Verification failed:', result);
        setCapturedPhoto(null);
        setIsVerifying(false);
        Alert.alert(
          'Verification Failed',
          `The selfie doesn't match your profile photos well enough (${result.similarity.toFixed(0)}% match, need 50%).\n\nPlease try again with:\n• Better lighting\n• Face the camera directly\n• Remove sunglasses or hats\n• A neutral expression`,
          [
            {
              text: 'Try Again',
              onPress: () => {
                // User will see the camera again
              }
            },
          ]
        );
      }
    } catch (error: any) {
      console.error('[CameraVerification] Error verifying selfie:', error);
      setCapturedPhoto(null);
      setIsVerifying(false);
      Alert.alert(
        'Verification Error',
        error.message || 'Failed to verify your photo. Please check your internet connection and try again.',
        [
          {
            text: 'Try Again',
            onPress: () => {
              // User will see the camera again
            }
          },
        ]
      );
    }
  };

  if (capturedPhoto) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Review Your Selfie</Text>
          <Text style={styles.subtitle}>
            Make sure your face is clearly visible
          </Text>
        </View>

        <View style={styles.previewContainer}>
          <Image source={{ uri: capturedPhoto }} style={styles.preview} />
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={retakePicture}
            disabled={isVerifying}
          >
            <Text style={[styles.buttonText, styles.secondaryButtonText]}>
              Retake
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, isVerifying && styles.buttonDisabled]}
            onPress={handleVerify}
            disabled={isVerifying}
          >
            {isVerifying ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.buttonText}>Verify</Text>
            )}
          </TouchableOpacity>
        </View>

        {isVerifying && (
          <View style={styles.verifyingOverlay}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.verifyingText}>Verifying your identity...</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Verify Your Identity</Text>
        <Text style={styles.subtitle}>
          Take a selfie to confirm you match your profile photos
        </Text>
        <View style={styles.tipsContainer}>
          <Text style={styles.tipsTitle}>Tips for best results:</Text>
          <Text style={styles.tipText}>• Face the camera directly</Text>
          <Text style={styles.tipText}>• Ensure good lighting</Text>
          <Text style={styles.tipText}>• Remove sunglasses/hats</Text>
          <Text style={styles.tipText}>• Keep a neutral expression</Text>
        </View>
      </View>

      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
        >
          <View style={styles.cameraOverlay}>
            <View style={styles.faceOutline} />
          </View>
        </CameraView>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
          <View style={styles.captureButtonInner} />
        </TouchableOpacity>
      </View>

      {/* DEV: Skip button for testing - remove in production */}
      {__DEV__ && (
        <TouchableOpacity
          style={styles.skipButton}
          onPress={async () => {
            await updateProfile({ verified: true });
            await loadUser();
            InteractionManager.runAfterInteractions(() => {
              navigation.navigate('Interests');
            });
          }}
        >
          <Text style={styles.skipButtonText}>Skip (Dev Only)</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.lg,
  },
  title: {
    ...Typography.h2,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  tipsContainer: {
    backgroundColor: Colors.primary100,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  tipsTitle: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.primary600,
    marginBottom: Spacing.sm,
  },
  tipText: {
    ...Typography.bodySmall,
    color: Colors.primary600,
    marginBottom: 4,
  },
  cameraContainer: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: BorderRadius.xl,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceOutline: {
    width: 250,
    height: 250,
    borderRadius: 125,
    borderWidth: 3,
    borderColor: Colors.white,
    borderStyle: 'dashed',
  },
  previewContainer: {
    flex: 1,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  preview: {
    flex: 1,
    width: '100%',
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  button: {
    flex: 1,
    height: 56,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: Colors.lightGray,
  },
  buttonText: {
    ...Typography.body,
    color: Colors.white,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  secondaryButtonText: {
    color: Colors.primary,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
  },
  verifyingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyingText: {
    ...Typography.body,
    color: Colors.text,
    marginTop: Spacing.lg,
  },
  skipButton: {
    position: 'absolute',
    top: 60,
    right: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.textSecondary,
    borderRadius: BorderRadius.md,
  },
  skipButtonText: {
    ...Typography.bodySmall,
    color: Colors.white,
    fontWeight: '600',
  },
});
