import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';

const { width } = Dimensions.get('window');
const PHOTO_SIZE = (width - 80) / 3; // 3 photos per row

interface PhotoUploadScreenProps {
  onComplete: () => void;
}

export default function PhotoUploadScreen({ onComplete }: PhotoUploadScreenProps) {
  const { user } = useAuthStore();
  const [photos, setPhotos] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [hasFixedPhotos, setHasFixedPhotos] = useState(false);

  // Load existing photos and auto-fix if needed
  useEffect(() => {
    if (user?.profile?.photos) {
      console.log('[PhotoUploadScreen] Setting photos:', user.profile.photos);
      setPhotos(user.profile.photos);

      // Auto-fix photos if they contain signed URLs (only once)
      if (!hasFixedPhotos && user.profile.photos.some((url: string) => url.includes('?'))) {
        console.log('[PhotoUploadScreen] Detected signed URLs, auto-fixing...');
        fixPhotosAutomatically();
      }
    }
  }, [user]);

  const fixPhotosAutomatically = async () => {
    try {
      console.log('[PhotoUploadScreen] Auto-fixing photo URLs...');
      const { profileAPI } = await import('../../services/api');
      const response = await profileAPI.fixPhotoUrls();
      console.log('[PhotoUploadScreen] Fixed photos:', response.data?.data?.fixedCount);
      setHasFixedPhotos(true);

      // Reload user to get updated photo URLs
      const { loadUser } = useAuthStore.getState();
      await loadUser();
    } catch (error: any) {
      console.error('[PhotoUploadScreen] Auto-fix photos error:', error);
      // Silently fail - don't bother the user
    }
  };

  const pickImage = async () => {
    if (photos.length >= 6) {
      Alert.alert('Maximum photos', 'You can only upload up to 6 photos');
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      uploadPhoto(result.assets[0].uri);
    }
  };

  const uploadPhoto = async (uri: string) => {
    setIsUploading(true);
    try {
      // Create FormData for multipart upload
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'photo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('photo', {
        uri,
        name: filename,
        type,
      } as any);

      // Upload photo to backend (which will store it in Firebase Storage)
      const { profileAPI } = await import('../../services/api');
      const response = await profileAPI.uploadPhoto(formData);
      const photoUrl = response.data.photoUrl;

      // Update local state with the new photo URL
      const newPhotos = [...photos, photoUrl];
      setPhotos(newPhotos);

      // Reload user profile to sync with backend
      const { loadUser } = useAuthStore.getState();
      await loadUser();
    } catch (error: any) {
      console.error('Upload error:', error);
      Alert.alert('Upload failed', error.response?.data?.error || 'Failed to upload photo');
    } finally {
      setIsUploading(false);
    }
  };

  const deletePhoto = async (index: number) => {
    const photoUrl = photos[index];
    try {
      // Delete from backend
      const { profileAPI } = await import('../../services/api');
      await profileAPI.deletePhoto(photoUrl);

      // Update local state
      const newPhotos = photos.filter((_, i) => i !== index);
      setPhotos(newPhotos);

      // Reload user profile to sync with backend
      const { loadUser } = useAuthStore.getState();
      await loadUser();
    } catch (error: any) {
      console.error('Delete photo error:', error);
      Alert.alert('Delete failed', error.response?.data?.error || 'Failed to delete photo');
    }
  };

  const handleContinue = () => {
    if (photos.length < 3) {
      Alert.alert('Minimum photos required', 'Please upload at least 3 photos to continue');
      return;
    }
    onComplete();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Add Your Photos</Text>
        <Text style={styles.subtitle}>
          Upload 3-6 photos to show your best self
        </Text>
        <Text style={styles.requirement}>
          {photos.length}/6 photos • Min: 3, Max: 6
        </Text>
      </View>

      <View style={styles.photosGrid}>
        {photos.map((photo, index) => (
          <View key={index} style={styles.photoContainer}>
            <Image source={{ uri: photo }} style={styles.photo} />
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => deletePhoto(index)}
            >
              <Ionicons name="close-circle" size={28} color={Colors.danger} />
            </TouchableOpacity>
          </View>
        ))}

        {photos.length < 6 && (
          <TouchableOpacity
            style={styles.addPhotoButton}
            onPress={pickImage}
            disabled={isUploading}
          >
            {isUploading ? (
              <ActivityIndicator color={Colors.primary} />
            ) : (
              <>
                <Ionicons name="add" size={40} color={Colors.primary} />
                <Text style={styles.addPhotoText}>Add Photo</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {photos.length >= 3 && (
        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleContinue}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>
      )}

      {photos.length < 3 && (
        <Text style={styles.helpText}>
          Add at least {3 - photos.length} more photo{3 - photos.length > 1 ? 's' : ''} to continue
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.gray,
    marginBottom: 12,
  },
  requirement: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 30,
  },
  photoContainer: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE * 1.3,
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  deleteButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: Colors.white,
    borderRadius: 14,
  },
  addPhotoButton: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE * 1.3,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
  addPhotoText: {
    marginTop: 8,
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  continueButton: {
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  continueButtonText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  helpText: {
    textAlign: 'center',
    color: Colors.gray,
    fontSize: 14,
    marginTop: 20,
  },
});
