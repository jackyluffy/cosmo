import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../store/authStore';
import { profileAPI } from '../../services/api';
import { Colors } from '../../constants/theme';
import { INTEREST_CATEGORIES, getInterestEmoji } from '../../constants/interests';
import { iapService, SubscriptionInfo } from '../../services/iapService';

const { width } = Dimensions.get('window');
const PHOTO_SIZE = (width - 60) / 3; // 3 photos per row with spacing

export default function ProfileScreen() {
  const { user, loadUser, logout, updateProfile } = useAuthStore();
  const [photos, setPhotos] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [hasFixedPhotos, setHasFixedPhotos] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [isEditingInterests, setIsEditingInterests] = useState(false);
  const [editedInterests, setEditedInterests] = useState<string[]>([]);
  const [newInterest, setNewInterest] = useState('');
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const [loadingSubscription, setLoadingSubscription] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [editedBio, setEditedBio] = useState('');
  const [isEditingSocialMedia, setIsEditingSocialMedia] = useState(false);
  const [editedSocialPlatform, setEditedSocialPlatform] = useState<'instagram' | 'wechat' | null>(null);
  const [editedSocialHandle, setEditedSocialHandle] = useState('');

  useEffect(() => {
    loadProfile();
    loadSubscriptionInfo();
  }, []);

  const loadSubscriptionInfo = async () => {
    try {
      await iapService.initialize();
      const info = await iapService.checkSubscriptionStatus();
      setSubscriptionInfo(info);
    } catch (error) {
      console.error('[ProfileScreen] Failed to load subscription:', error);
    }
  };

  // Update photos whenever user changes
  useEffect(() => {
    if (user?.profile?.photos) {
      console.log('[ProfileScreen] Setting photos:', user.profile.photos);
      setPhotos(user.profile.photos);

      // Auto-fix photos if they contain signed URLs (only once)
      if (!hasFixedPhotos && user.profile.photos.some((url: string) => url.includes('?'))) {
        console.log('[ProfileScreen] Detected signed URLs, auto-fixing...');
        fixPhotosAutomatically();
      }
    }
  }, [user]);

  const fixPhotosAutomatically = async () => {
    try {
      console.log('[ProfileScreen] Auto-fixing photo URLs...');
      const response = await profileAPI.fixPhotoUrls();
      console.log('[ProfileScreen] Fixed photos:', response.data?.data?.fixedCount);
      setHasFixedPhotos(true);
      await loadUser(); // Reload to get new URLs
    } catch (error: any) {
      console.error('[ProfileScreen] Auto-fix photos error:', error);
      // Silently fail - don't bother the user
    }
  };

  const loadProfile = async () => {
    setIsLoading(true);
    try {
      await loadUser();
    } catch (error) {
      console.error('Failed to load profile:', error);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  const pickImage = async () => {
    // Check if we've already reached the max
    if (photos.length >= 6) {
      Alert.alert('Maximum photos', 'You can only upload up to 6 photos');
      return;
    }

    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos');
      return;
    }

    // Launch image picker
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
    setIsUploadingPhoto(true);
    try {
      // Create form data
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'photo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('photo', {
        uri,
        name: filename,
        type,
      } as any);

      // Upload photo
      const response = await profileAPI.uploadPhoto(formData);

      // Reload profile to get updated photos
      await loadProfile();
      Alert.alert('Success', 'Photo uploaded successfully');
    } catch (error: any) {
      console.error('Upload error:', error);
      Alert.alert('Upload failed', error.response?.data?.error || 'Failed to upload photo');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const deletePhoto = async (photoUrl: string) => {
    // Check minimum photos requirement
    if (photos.length <= 3) {
      Alert.alert('Minimum photos', 'You must have at least 3 photos');
      return;
    }

    Alert.alert(
      'Delete photo',
      'Are you sure you want to delete this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await profileAPI.deletePhoto(photoUrl);
              await loadProfile();
              Alert.alert('Success', 'Photo deleted');
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.error || 'Failed to delete photo');
            }
          },
        },
      ]
    );
  };

  const openInterestsEditor = () => {
    const rawInterests = user?.profile?.interests;
    const normalizedInterests = Array.isArray(rawInterests)
      ? Array.from(
          new Set(
            rawInterests
              .map((interest: any) => {
                if (typeof interest === 'string') {
                  return interest.trim();
                }
                if (interest && typeof interest === 'object') {
                  const label =
                    interest.label ||
                    interest.name ||
                    interest.id ||
                    interest.value ||
                    '';
                  return String(label).trim();
                }
                return '';
              })
              .filter(Boolean)
          )
        )
      : [];

    setEditedInterests(normalizedInterests);
    setIsEditingInterests(true);
  };

  const toggleInterest = useCallback((interest: string) => {
    const normalizedInterest = interest.trim();
    setEditedInterests(prev => {
      if (prev.includes(normalizedInterest)) {
        return prev.filter(i => i !== normalizedInterest);
      } else {
        return [...prev, normalizedInterest];
      }
    });
  }, []);

  const saveInterests = useCallback(async () => {
    try {
      const sanitized = Array.from(
        new Set(
          editedInterests
            .map((interest) => interest.trim())
            .filter((interest) => interest.length > 0)
        )
      );

      await updateProfile({ interests: sanitized });
      setIsEditingInterests(false);
      Alert.alert('Success', sanitized.length > 0 ? 'Interests updated' : 'Interests cleared');
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        error?.message ||
        'Failed to update interests';
      Alert.alert('Error', message);
    }
  }, [editedInterests, updateProfile]);

  const openBioEditor = () => {
    setEditedBio(user?.profile?.bio || '');
    setIsEditingBio(true);
  };

  const saveBio = async () => {
    try {
      const trimmedBio = editedBio.trim();
      await updateProfile({ bio: trimmedBio });
      setIsEditingBio(false);
      Alert.alert('Success', 'Bio updated');
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        error?.message ||
        'Failed to update bio';
      Alert.alert('Error', message);
    }
  };

  const openSocialMediaEditor = () => {
    const socialMedia = user?.profile?.socialMedia;
    if (socialMedia) {
      setEditedSocialPlatform(socialMedia.platform as 'instagram' | 'wechat');
      setEditedSocialHandle(socialMedia.handle || '');
    } else {
      setEditedSocialPlatform(null);
      setEditedSocialHandle('');
    }
    setIsEditingSocialMedia(true);
  };

  const saveSocialMedia = async () => {
    try {
      if (editedSocialPlatform && editedSocialHandle.trim()) {
        await updateProfile({
          socialMedia: {
            platform: editedSocialPlatform,
            handle: editedSocialHandle.trim(),
          },
        });
      } else {
        // Remove social media if both are empty
        await updateProfile({ socialMedia: null });
      }
      setIsEditingSocialMedia(false);
      Alert.alert('Success', 'Social media updated');
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        error?.message ||
        'Failed to update social media';
      Alert.alert('Error', message);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Profile</Text>
      </View>

      {/* Profile Info */}
      <View style={styles.section}>
        <Text style={styles.name}>{user?.profile?.name || 'No name'}</Text>
        <Text style={styles.details}>
          {user?.profile?.age || 'N/A'} • {user?.profile?.gender || 'N/A'}
        </Text>
      </View>

      {/* Bio Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.bioQuestion}>One thing I want you to know about me</Text>
          <TouchableOpacity onPress={openBioEditor}>
            <Ionicons name="pencil" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>
        {user?.profile?.bio ? (
          <Text style={styles.bio}>{user.profile.bio}</Text>
        ) : (
          <Text style={styles.noBioText}>Share something unique about yourself</Text>
        )}
      </View>

      {/* Social Media Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Social Media</Text>
          <TouchableOpacity onPress={openSocialMediaEditor}>
            <Ionicons name="pencil" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>
        {user?.profile?.socialMedia ? (
          <View style={styles.socialMediaDisplay}>
            <Ionicons
              name={user.profile.socialMedia.platform === 'instagram' ? 'logo-instagram' : 'chatbubbles'}
              size={24}
              color={Colors.primary}
            />
            <Text style={styles.socialMediaText}>
              {user.profile.socialMedia.platform === 'instagram' ? 'Instagram' : 'WeChat'}: @{user.profile.socialMedia.handle}
            </Text>
          </View>
        ) : (
          <Text style={styles.noSocialMediaText}>No social media added</Text>
        )}
      </View>

      {/* Photos Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Photos ({photos.length}/6)</Text>
          <Text style={styles.sectionSubtitle}>
            {photos.length < 3
              ? `Add at least ${3 - photos.length} more photo(s)`
              : 'Minimum 3 photos required'}
          </Text>
        </View>

        <View style={styles.photosGrid}>
          {photos.map((photo, index) => (
            <View key={index} style={styles.photoContainer}>
              <TouchableOpacity onPress={() => setSelectedPhotoIndex(index)}>
                <Image
                  source={{ uri: photo }}
                  style={styles.photo}
                  resizeMode="cover"
                  onError={(e) => console.log('[ProfileScreen] Image load error:', e.nativeEvent.error)}
                  onLoad={() => console.log('[ProfileScreen] Image loaded:', photo.substring(0, 100))}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => deletePhoto(photo)}
              >
                <Ionicons name="close-circle" size={24} color={Colors.danger} />
              </TouchableOpacity>
            </View>
          ))}

          {/* Add photo button */}
          {photos.length < 6 && (
            <TouchableOpacity
              style={styles.addPhotoButton}
              onPress={pickImage}
              disabled={isUploadingPhoto}
            >
              {isUploadingPhoto ? (
                <ActivityIndicator color={Colors.primary} />
              ) : (
                <>
                  <Ionicons name="add" size={40} color={Colors.gray} />
                  <Text style={styles.addPhotoText}>Add Photo</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Interests */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Interests</Text>
          <TouchableOpacity onPress={openInterestsEditor}>
            <Ionicons name="pencil" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>
        {user?.profile?.interests && user.profile.interests.length > 0 ? (
          <View style={styles.interestsContainer}>
            {user.profile.interests.map((interest, index) => (
              <View key={index} style={styles.interestTag}>
                <Text style={styles.interestText}>{interest}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.noInterestsText}>No interests added yet</Text>
        )}
      </View>

      {/* Subscription Status */}
      {/* Subscription Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Subscription</Text>
        <View style={styles.subscriptionCard}>
          {subscriptionInfo?.isActive ? (
            <>
              <View style={styles.subscriptionActive}>
                <Ionicons name="diamond" size={24} color={Colors.primary} />
                <Text style={styles.subscriptionActiveText}>Premium Active</Text>
              </View>
              {subscriptionInfo.expirationDate && (
                <Text style={styles.subscriptionExpiry}>
                  Renews on {new Date(subscriptionInfo.expirationDate).toLocaleDateString()}
                </Text>
              )}
              <TouchableOpacity
                style={styles.manageButton}
                onPress={() => {
                  Alert.alert(
                    'Manage Subscription',
                    'To manage your subscription, go to Settings > Apple ID > Subscriptions on your device.',
                    [{ text: 'OK' }]
                  );
                }}
              >
                <Text style={styles.manageButtonText}>Manage Subscription</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.subscriptionInactive}>
                <Ionicons name="diamond-outline" size={24} color={Colors.textSecondary} />
                <Text style={styles.subscriptionInactiveText}>Free Plan</Text>
              </View>
              <TouchableOpacity
                style={styles.upgradeButton}
                onPress={async () => {
                  try {
                    setLoadingSubscription(true);
                    console.log('[ProfileScreen] Initiating purchase...');
                    await iapService.purchaseSubscription();
                    await loadSubscriptionInfo();
                    Alert.alert('Success', 'Purchase initiated! Check your subscription status.');
                  } catch (error: any) {
                    console.error('[ProfileScreen] Purchase error:', error);
                    const errorMessage = error?.message || error?.code || 'An unknown error occurred';
                    Alert.alert(
                      'Purchase Failed',
                      `Unable to complete purchase: ${errorMessage}\n\nMake sure you have:\n• Set up the subscription in App Store Connect\n• Enabled In-App Purchases capability\n• Signed in with a sandbox tester account`
                    );
                  } finally {
                    setLoadingSubscription(false);
                  }
                }}
                disabled={loadingSubscription}
              >
                {loadingSubscription ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.upgradeButtonText}>Upgrade to Premium</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.restoreButton}
                onPress={async () => {
                  try {
                    setLoadingSubscription(true);
                    await loadSubscriptionInfo();
                    if (subscriptionInfo?.isActive) {
                      Alert.alert('Success', 'Subscription restored!');
                    } else {
                      Alert.alert('No Subscription', 'No active subscription found.');
                    }
                  } catch (error) {
                    Alert.alert('Error', 'Failed to restore purchase.');
                  } finally {
                    setLoadingSubscription(false);
                  }
                }}
              >
                <Text style={styles.restoreButtonText}>Restore Purchase</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Logout Button */}
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={() => {
          Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Logout', style: 'destructive', onPress: logout },
          ]);
        }}
      >
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      {/* Photo Viewer Modal */}
      <Modal
        visible={selectedPhotoIndex !== null}
        transparent
        onRequestClose={() => setSelectedPhotoIndex(null)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setSelectedPhotoIndex(null)}
          >
            <Ionicons name="close" size={32} color={Colors.white} />
          </TouchableOpacity>
          {selectedPhotoIndex !== null && (
            <Image
              source={{ uri: photos[selectedPhotoIndex] }}
              style={styles.fullScreenPhoto}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* Interests Editor Modal */}
      <Modal
        visible={isEditingInterests}
        animationType="slide"
        onRequestClose={() => setIsEditingInterests(false)}
      >
        <View style={styles.interestsEditorModal}>
          <View style={styles.interestsEditorHeader}>
            <TouchableOpacity onPress={() => setIsEditingInterests(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Interests</Text>
            <TouchableOpacity onPress={saveInterests}>
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.interestsEditorContent}>
            <Text style={styles.selectedCountText}>
              {editedInterests.length} selected
            </Text>

            {INTEREST_CATEGORIES.map((category, catIndex) => (
              <View key={catIndex} style={styles.categorySection}>
                <Text style={styles.categoryTitle}>
                  {category.emoji} {category.name}
                </Text>
                <View style={styles.interestsList}>
                  {category.interests.map((interest, intIndex) => {
                    const isSelected = editedInterests.includes(interest);
                    return (
                      <TouchableOpacity
                        key={intIndex}
                        style={[
                          styles.interestCheckbox,
                          isSelected && styles.interestCheckboxSelected
                        ]}
                        onPress={() => toggleInterest(interest)}
                      >
                        <Text style={[
                          styles.interestCheckboxText,
                          isSelected && styles.interestCheckboxTextSelected
                        ]}>
                          {getInterestEmoji(interest)} {interest}
                        </Text>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={20} color={Colors.white} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Bio Editor Modal */}
      <Modal
        visible={isEditingBio}
        animationType="slide"
        transparent
        onRequestClose={() => setIsEditingBio(false)}
      >
        <View style={styles.bioModalOverlay}>
          <View style={styles.bioModal}>
            <View style={styles.bioModalHeader}>
              <TouchableOpacity onPress={() => setIsEditingBio(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>About Me</Text>
              <TouchableOpacity onPress={saveBio}>
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.bioModalContent}>
              <Text style={styles.bioModalQuestion}>
                One thing I want you to know about me
              </Text>
              <TextInput
                style={styles.bioInput}
                placeholder="Share something unique about yourself..."
                placeholderTextColor={Colors.gray}
                value={editedBio}
                onChangeText={setEditedBio}
                multiline
                maxLength={500}
                autoFocus
              />
              <Text style={styles.charCount}>
                {editedBio.length}/500
              </Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* Social Media Editor Modal */}
      <Modal
        visible={isEditingSocialMedia}
        animationType="slide"
        transparent
        onRequestClose={() => setIsEditingSocialMedia(false)}
      >
        <View style={styles.bioModalOverlay}>
          <View style={styles.bioModal}>
            <View style={styles.bioModalHeader}>
              <TouchableOpacity onPress={() => setIsEditingSocialMedia(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Social Media</Text>
              <TouchableOpacity onPress={saveSocialMedia}>
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.bioModalContent}>
              <Text style={styles.socialMediaInstructions}>
                Share your social media to connect with your matches
              </Text>

              <Text style={styles.socialMediaLabel}>Select Platform</Text>
              <View style={styles.platformButtonsRow}>
                <TouchableOpacity
                  style={[
                    styles.platformModalButton,
                    editedSocialPlatform === 'instagram' && styles.platformModalButtonSelected,
                  ]}
                  onPress={() => setEditedSocialPlatform('instagram')}
                >
                  <Ionicons
                    name="logo-instagram"
                    size={28}
                    color={editedSocialPlatform === 'instagram' ? Colors.white : Colors.gray}
                  />
                  <Text
                    style={[
                      styles.platformModalText,
                      editedSocialPlatform === 'instagram' && styles.platformModalTextSelected,
                    ]}
                  >
                    Instagram
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.platformModalButton,
                    editedSocialPlatform === 'wechat' && styles.platformModalButtonSelected,
                  ]}
                  onPress={() => setEditedSocialPlatform('wechat')}
                >
                  <Ionicons
                    name="chatbubbles"
                    size={28}
                    color={editedSocialPlatform === 'wechat' ? Colors.white : Colors.gray}
                  />
                  <Text
                    style={[
                      styles.platformModalText,
                      editedSocialPlatform === 'wechat' && styles.platformModalTextSelected,
                    ]}
                  >
                    WeChat
                  </Text>
                </TouchableOpacity>
              </View>

              {editedSocialPlatform && (
                <View style={styles.handleInputSection}>
                  <Text style={styles.socialMediaLabel}>
                    {editedSocialPlatform === 'instagram' ? 'Instagram' : 'WeChat'} Handle
                  </Text>
                  <TextInput
                    style={styles.socialMediaInput}
                    placeholder={`@${editedSocialPlatform === 'instagram' ? 'username' : 'wechat_id'}`}
                    placeholderTextColor={Colors.gray}
                    value={editedSocialHandle}
                    onChangeText={setEditedSocialHandle}
                    autoCapitalize="none"
                    maxLength={50}
                    autoFocus
                  />
                  <Text style={styles.socialMediaHint}>
                    Your handle will be visible to your matches
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
  },
  section: {
    padding: 20,
    backgroundColor: Colors.white,
    marginTop: 10,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 5,
  },
  details: {
    fontSize: 16,
    color: Colors.gray,
    marginBottom: 10,
  },
  bio: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 24,
  },
  bioQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  noBioText: {
    fontSize: 14,
    color: Colors.gray,
    fontStyle: 'italic',
  },
  sectionHeader: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 5,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: Colors.gray,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
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
    top: 5,
    right: 5,
    backgroundColor: Colors.white,
    borderRadius: 12,
  },
  addPhotoButton: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE * 1.3,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.lightGray,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  addPhotoText: {
    marginTop: 5,
    fontSize: 12,
    color: Colors.gray,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestTag: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  interestText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '500',
  },
  subscriptionStatus: {
    fontSize: 16,
    color: Colors.text,
    textTransform: 'capitalize',
  },
  subscriptionCard: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
  },
  subscriptionActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  subscriptionActiveText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  subscriptionExpiry: {
    fontSize: 14,
    color: Colors.gray,
    marginBottom: 15,
  },
  manageButton: {
    backgroundColor: Colors.lightGray,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  manageButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  subscriptionInactive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  subscriptionInactiveText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textSecondary,
  },
  upgradeButton: {
    backgroundColor: Colors.primary,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  upgradeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.white,
  },
  restoreButton: {
    padding: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  restoreButtonText: {
    fontSize: 14,
    color: Colors.primary,
  },
  logoutButton: {
    backgroundColor: Colors.white,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.danger,
    alignItems: 'center',
  },
  logoutText: {
    color: Colors.danger,
    fontSize: 16,
    fontWeight: '600',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  noInterestsText: {
    fontSize: 14,
    color: Colors.gray,
    fontStyle: 'italic',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  interestsEditorModal: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalCloseButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
  },
  fullScreenPhoto: {
    width: '100%',
    height: '100%',
  },
  interestsEditorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  cancelText: {
    fontSize: 16,
    color: Colors.gray,
  },
  saveText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
  },
  interestsEditorContent: {
    flex: 1,
    padding: 20,
  },
  selectedCountText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 20,
    textAlign: 'center',
  },
  categorySection: {
    marginBottom: 30,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 15,
  },
  interestsList: {
    gap: 10,
  },
  interestCheckbox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.lightGray,
  },
  interestCheckboxSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  interestCheckboxText: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500',
  },
  interestCheckboxTextSelected: {
    color: Colors.white,
  },
  bioModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  bioModal: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  bioModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  bioModalContent: {
    padding: 20,
  },
  bioModalQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 15,
    lineHeight: 22,
  },
  bioInput: {
    fontSize: 16,
    color: Colors.text,
    minHeight: 150,
    textAlignVertical: 'top',
    padding: 15,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.lightGray,
  },
  charCount: {
    fontSize: 14,
    color: Colors.gray,
    textAlign: 'right',
    marginTop: 10,
  },
  socialMediaDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  socialMediaText: {
    fontSize: 16,
    color: Colors.text,
  },
  noSocialMediaText: {
    fontSize: 14,
    color: Colors.gray,
    fontStyle: 'italic',
  },
  socialMediaInstructions: {
    fontSize: 14,
    color: Colors.gray,
    marginBottom: 24,
    lineHeight: 20,
  },
  socialMediaLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  platformButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  platformModalButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 20,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.lightGray,
  },
  platformModalButtonSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  platformModalText: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '600',
  },
  platformModalTextSelected: {
    color: Colors.white,
    fontWeight: '700',
  },
  handleInputSection: {
    marginTop: 4,
  },
  socialMediaInput: {
    fontSize: 16,
    color: Colors.text,
    padding: 15,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.lightGray,
    marginBottom: 8,
  },
  socialMediaHint: {
    fontSize: 13,
    color: Colors.gray,
    fontStyle: 'italic',
  },
});
