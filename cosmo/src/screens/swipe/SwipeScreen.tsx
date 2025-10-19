import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  ScrollView,
  Animated,
  PanResponder,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import MultiSlider from '@ptomasroos/react-native-multi-slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { swipeAPI } from '../../services/api';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const SWIPE_THRESHOLD = 120;

// Map interests to emojis
const getInterestEmoji = (interest: string): string => {
  const emojiMap: { [key: string]: string } = {
    // Sports & Fitness
    'fitness': '💪',
    'gym': '🏋️',
    'yoga': '🧘',
    'running': '🏃',
    'hiking': '🥾',
    'cycling': '🚴',
    'swimming': '🏊',
    'basketball': '🏀',
    'football': '⚽',
    'tennis': '🎾',
    'soccer': '⚽',

    // Food & Drink
    'cooking': '👨‍🍳',
    'coffee': '☕',
    'wine': '🍷',
    'food': '🍕',
    'pizza': '🍕',
    'sushi': '🍣',
    'baking': '🧁',

    // Arts & Entertainment
    'music': '🎵',
    'guitar': '🎸',
    'singing': '🎤',
    'dancing': '💃',
    'movies': '🎬',
    'reading': '📚',
    'photography': '📸',
    'art': '🎨',
    'painting': '🎨',
    'gaming': '🎮',

    // Nature & Outdoors
    'travel': '✈️',
    'camping': '⛺',
    'beach': '🏖️',
    'nature': '🌲',
    'dogs': '🐕',
    'cats': '🐱',
    'pets': '🐾',

    // Other
    'meditation': '🧘‍♀️',
    'spirituality': '✨',
    'fashion': '👗',
    'shopping': '🛍️',
    'volunteering': '❤️',
  };

  const lowerInterest = interest.toLowerCase();
  return emojiMap[lowerInterest] || '✨';
};

// Helper to convert inches to feet'inches" format
const inchesToFeetString = (inches: number): string => {
  const feet = Math.floor(inches / 12);
  const remainingInches = inches % 12;
  return `${feet}'${remainingInches}"`;
};

// Helper to convert inches to centimeters
const inchesToCm = (inches: number): number => {
  return Math.round(inches * 2.54);
};

interface Profile {
  id: string;
  name: string;
  age: number;
  bio: string;
  photos: string[];
  interests: string[];
  distance: number;
  gender?: string;
  height?: string;
  occupation?: string;
  education?: string;
  ethnicity?: string;
  datingIntention?: string;
}

interface FilterOptions {
  minAge?: number;
  maxAge?: number;
  gender?: string[];
  minHeight?: number;
  maxHeight?: number;
  maxDistance?: number;
  ethnicity?: string[];
  datingIntention?: string[];
}

const DEFAULT_FILTERS: FilterOptions = {
  minAge: 18,
  maxAge: 35,
  minHeight: 60,
  maxHeight: 77,
  maxDistance: 50,
};

export default function SwipeScreen() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({ ...DEFAULT_FILTERS });
  const [draftFilters, setDraftFilters] = useState<FilterOptions>({ ...DEFAULT_FILTERS });
  const [photoIndices, setPhotoIndices] = useState<Record<string, number>>({});
  const [cardHeight, setCardHeight] = useState(screenHeight);

  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const position = useRef(new Animated.ValueXY()).current;
  const isPhotoInteractingRef = useRef(false);
  const flatListRefs = useRef<Record<string, FlatList<string> | null>>({});
  const photoHeight = Math.max(cardHeight, 1);

  const interestReloadKey = useMemo(() => {
    const interests = user?.profile?.interests;
    if (!Array.isArray(interests) || interests.length === 0) {
      return 'none';
    }

    return interests
      .filter((interest): interest is string => typeof interest === 'string')
      .map((interest) => interest.trim().toLowerCase())
      .filter((interest) => interest.length > 0)
      .sort()
      .join('|');
  }, [user?.profile?.interests]);

  useEffect(() => {
    setCurrentIndex(0);
    setPhotoIndices({});
    setProfiles([]);
    loadProfiles();
  }, [filters, interestReloadKey]);

  useEffect(() => {
    if (filterModalVisible) {
      setDraftFilters({
        minAge: filters.minAge,
        maxAge: filters.maxAge,
        minHeight: filters.minHeight,
        maxHeight: filters.maxHeight,
        maxDistance: filters.maxDistance,
        gender: filters.gender ? [...filters.gender] : undefined,
        ethnicity: filters.ethnicity ? [...filters.ethnicity] : undefined,
        datingIntention: filters.datingIntention ? [...filters.datingIntention] : undefined,
      });
    }
  }, [filterModalVisible, filters]);

  useEffect(() => {
    const currentProfile = profiles[currentIndex];
    if (currentProfile) {
      setPhotoIndices((prev) =>
        prev[currentProfile.id] === undefined ? { ...prev, [currentProfile.id]: 0 } : prev
      );
    }
    isPhotoInteractingRef.current = false;
  }, [currentIndex, profiles]);

  useEffect(() => {
    const currentProfile = profiles[currentIndex];
    if (!currentProfile) {
      return;
    }

    const listRef = flatListRefs.current[currentProfile.id];
    if (!listRef) {
      return;
    }

    const targetIndex = photoIndices[currentProfile.id] ?? 0;
    const offset = targetIndex * photoHeight;

    requestAnimationFrame(() => {
      try {
        listRef.scrollToOffset({ offset, animated: false });
      } catch (error) {
        console.warn('[SwipeScreen] Failed to reset photo position:', error);
      }
    });
  }, [currentIndex, profiles, photoHeight]);

  const loadProfiles = async () => {
    try {
      if (interestReloadKey === 'none') {
        setLoading(false);
        setProfiles([]);
        setPhotoIndices({});
        return;
      }

      setLoading(true);
      console.log('[SwipeScreen] Calling getDeck API...');
      const response = await swipeAPI.getDeck();
      console.log('[SwipeScreen] Response received:', response);

      if (!response || !response.data) {
        console.log('[SwipeScreen] Response is null/undefined or has no data');
        setProfiles([]);
        setPhotoIndices({});
        return;
      }

      const backendProfiles = response.data?.data?.profiles || response.data?.profiles || [];
      console.log('[SwipeScreen] Raw profiles from backend:', backendProfiles.length);

      // Deep clone all values to prevent GC issues
      const mappedProfiles: Profile[] = backendProfiles.map((p: any) => {
        const id = String(p.id || '');
        const name = String(p.profile?.name || 'Unknown');
        const age = Number(p.profile?.age || 0);
        const bio = String(p.profile?.bio || '');
        const photos = Array.isArray(p.profile?.photos)
          ? [...p.profile.photos.map((url: string) => String(url))]
          : [];
        const interests = Array.isArray(p.profile?.interests)
          ? [...p.profile.interests.map((i: string) => String(i))]
          : [];
        const distance = 5;
        const gender = p.profile?.gender ? String(p.profile.gender) : undefined;
        const height = p.profile?.height ? String(p.profile.height) : undefined;
        const occupation = p.profile?.occupation ? String(p.profile.occupation) : undefined;
        const education = p.profile?.education ? String(p.profile.education) : undefined;
        const ethnicity = p.profile?.ethnicity ? String(p.profile.ethnicity) : undefined;
        const datingIntention = p.profile?.datingIntention ? String(p.profile.datingIntention) : undefined;

        return {
          id,
          name,
          age,
          bio,
          photos,
          interests,
          distance,
          gender,
          height,
          occupation,
          education,
          ethnicity,
          datingIntention,
        };
      });

      console.log('[SwipeScreen] Mapped profiles:', mappedProfiles.length);

      // Apply filters
      const filteredProfiles = applyFilters(mappedProfiles);

      setProfiles(filteredProfiles);
      setPhotoIndices(
        filteredProfiles.reduce((acc, profile) => {
          acc[profile.id] = 0;
          return acc;
        }, {} as Record<string, number>)
      );
      setCurrentIndex(0);
    } catch (error) {
      console.error('[SwipeScreen] Failed to load profiles:', error);
      setProfiles([]);
      setPhotoIndices({});
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = (profiles: Profile[]): Profile[] => {
    const normalizedUserInterests = interestReloadKey === 'none'
      ? []
      : interestReloadKey.split('|').filter((interest) => interest.length > 0);
    const userInterestSet = new Set(normalizedUserInterests);

    return profiles.filter(profile => {
      // Age filter
      if (filters.minAge && profile.age < filters.minAge) return false;
      if (filters.maxAge && profile.age > filters.maxAge) return false;

      // Gender filter
      if (filters.gender && filters.gender.length > 0 && profile.gender) {
        if (!filters.gender.includes(profile.gender)) return false;
      }

      // Height filter
      if (filters.minHeight || filters.maxHeight) {
        if (profile.height) {
          const heightInInches = parseInt(profile.height.replace(/[^0-9]/g, ''));
          if (filters.minHeight && heightInInches < filters.minHeight) return false;
          if (filters.maxHeight && heightInInches > filters.maxHeight) return false;
        }
      }

      // Distance filter
      if (filters.maxDistance && profile.distance > filters.maxDistance) return false;

      // Ethnicity filter
      if (filters.ethnicity && filters.ethnicity.length > 0 && profile.ethnicity) {
        if (!filters.ethnicity.includes(profile.ethnicity)) return false;
      }

      // Dating intention filter
      if (filters.datingIntention && filters.datingIntention.length > 0 && profile.datingIntention) {
        if (!filters.datingIntention.includes(profile.datingIntention)) return false;
      }

      const candidateInterests = Array.isArray(profile.interests)
        ? profile.interests
            .map((interest) => (typeof interest === 'string' ? interest.trim().toLowerCase() : ''))
            .filter((interest) => interest.length > 0)
        : [];

      const hasSharedInterest =
        normalizedUserInterests.length === 0
          ? true
          : candidateInterests.some((interest) => userInterestSet.has(interest));

      if (!hasSharedInterest) return false;

      return true;
    });
  };

  const handleSwipe = (
    direction: 'left' | 'right',
    swipedIndex: number,
    swipedProfile?: Profile
  ) => {
    const profile = swipedProfile ?? profiles[swipedIndex];
    if (!profile) {
      return;
    }

    swipeAPI
      .swipe(profile.id, direction === 'right' ? 'like' : 'skip')
      .catch(error => {
        console.error('Failed to record swipe:', error);
      });

    // Reset position first, then move to next card
    position.setValue({ x: 0, y: 0 });

    // Immediately move to next card (no blank screen)
    if (swipedIndex >= profiles.length - 1) {
      loadProfiles();
    } else {
      setCurrentIndex(prevIndex => {
        if (prevIndex > swipedIndex) {
          return prevIndex;
        }
        return swipedIndex + 1;
      });
    }
  };

  const swipeLeft = () => {
    const swipedIndex = currentIndex;
    const swipedProfile = profiles[swipedIndex];
    Animated.timing(position, {
      toValue: { x: -screenWidth - 100, y: 0 },
      duration: 250,
      useNativeDriver: false,
    }).start(() => handleSwipe('left', swipedIndex, swipedProfile));
  };

  const swipeRight = () => {
    const swipedIndex = currentIndex;
    const swipedProfile = profiles[swipedIndex];
    Animated.timing(position, {
      toValue: { x: screenWidth + 100, y: 0 },
      duration: 250,
      useNativeDriver: false,
    }).start(() => handleSwipe('right', swipedIndex, swipedProfile));
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gesture) => {
      if (isPhotoInteractingRef.current) {
        return false;
      }
      // Only capture horizontal swipes for card swiping
      const dx = Math.abs(gesture.dx);
      const dy = Math.abs(gesture.dy);
      const hasSufficientMovement = dx > 10;
      const isHorizontalSwipe = dx > dy * 1.5;
      if (!hasSufficientMovement) {
        return false;
      }
      if (isHorizontalSwipe) {
        isPhotoInteractingRef.current = false;
        return true;
      }
      return false;
    },
    onPanResponderMove: (_, gesture) => {
      if (isPhotoInteractingRef.current) {
        return;
      }
      const isHorizontalSwipe = Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5;
      if (isHorizontalSwipe) {
        position.setValue({ x: gesture.dx, y: gesture.dy });
      }
    },
    onPanResponderRelease: (_, gesture) => {
      if (isPhotoInteractingRef.current) {
        isPhotoInteractingRef.current = false;
        Animated.spring(position, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
        }).start();
        return;
      }

      const isHorizontalSwipe = Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5;
      if (!isHorizontalSwipe) {
        Animated.spring(position, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
        }).start();
        return;
      }

      if (gesture.dx > SWIPE_THRESHOLD) {
        swipeRight();
      } else if (gesture.dx < -SWIPE_THRESHOLD) {
        swipeLeft();
      } else {
        Animated.spring(position, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
        }).start();
      }
    },
    onPanResponderTerminate: () => {
      isPhotoInteractingRef.current = false;
      Animated.spring(position, {
        toValue: { x: 0, y: 0 },
        useNativeDriver: false,
      }).start();
    },
  });

  const toggleGender = (gender: string) => {
    const current = draftFilters.gender || [];
    if (current.includes(gender)) {
      setDraftFilters({ ...draftFilters, gender: current.filter(g => g !== gender) });
    } else {
      setDraftFilters({ ...draftFilters, gender: [...current, gender] });
    }
  };

  const toggleEthnicity = (ethnicity: string) => {
    const current = draftFilters.ethnicity || [];
    if (current.includes(ethnicity)) {
      setDraftFilters({ ...draftFilters, ethnicity: current.filter(e => e !== ethnicity) });
    } else {
      setDraftFilters({ ...draftFilters, ethnicity: [...current, ethnicity] });
    }
  };

  const toggleDatingIntention = (intention: string) => {
    const current = draftFilters.datingIntention || [];
    if (current.includes(intention)) {
      setDraftFilters({ ...draftFilters, datingIntention: current.filter(i => i !== intention) });
    } else {
      setDraftFilters({ ...draftFilters, datingIntention: [...current, intention] });
    }
  };

  const renderCard = (profile: Profile, index: number) => {
    // Render current and next card for smooth transitions
    if (index > currentIndex + 1 || index < currentIndex) return null;

    const photos = profile.photos.length > 0 ? profile.photos : ['https://via.placeholder.com/400'];

    const rotate = position.x.interpolate({
      inputRange: [-screenWidth / 2, 0, screenWidth / 2],
      outputRange: ['-10deg', '0deg', '10deg'],
      extrapolate: 'clamp',
    });

    const likeOpacity = position.x.interpolate({
      inputRange: [0, SWIPE_THRESHOLD],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });

    const nopeOpacity = position.x.interpolate({
      inputRange: [-SWIPE_THRESHOLD, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });

    const isCurrentCard = index === currentIndex;
    const currentPhotoIndex = photoIndices[profile.id] ?? 0;

    return (
      <Animated.View
        key={profile.id}
        style={[
          styles.card,
          {
            height: photoHeight,
            transform: isCurrentCard
              ? [
                  { translateX: position.x },
                  { translateY: position.y },
                  { rotate },
                ]
              : [],
            zIndex: isCurrentCard ? 10 : 1,
          },
        ]}
        {...(isCurrentCard ? panResponder.panHandlers : {})}
      >
        {/* Photo indicator (always show on current card) */}
        {isCurrentCard && (
          <View style={styles.photoIndicator}>
            <Text style={styles.photoIndicatorText}>
              {currentPhotoIndex + 1}/{photos.length}
            </Text>
          </View>
        )}

        {/* Swipe Overlays (only on current card) */}
        {isCurrentCard && (
          <>
            <Animated.View style={[styles.swipeOverlay, styles.likeOverlay, { opacity: likeOpacity }]}>
              <Text style={styles.overlayText}>LIKE</Text>
            </Animated.View>
            <Animated.View style={[styles.swipeOverlay, styles.nopeOverlay, { opacity: nopeOpacity }]}>
              <Text style={styles.overlayText}>SKIP</Text>
            </Animated.View>
          </>
        )}

        {/* Vertical ScrollView for all photos */}
        <FlatList
          ref={(ref) => {
            if (ref) {
              flatListRefs.current[profile.id] = ref;
            } else {
              delete flatListRefs.current[profile.id];
            }
          }}
          data={photos}
          keyExtractor={(_, idx) => `${profile.id}-photo-${idx}`}
          initialScrollIndex={currentPhotoIndex}
          pagingEnabled
          snapToInterval={photoHeight}
          snapToAlignment="start"
          decelerationRate="fast"
          bounces={false}
          showsVerticalScrollIndicator={true}
          style={[styles.photoList, { height: photoHeight }]}
          scrollEnabled={isCurrentCard}
          onScrollBeginDrag={() => {
            isPhotoInteractingRef.current = true;
          }}
          onScrollEndDrag={() => {
            isPhotoInteractingRef.current = false;
          }}
          onMomentumScrollBegin={() => {
            isPhotoInteractingRef.current = true;
          }}
          onMomentumScrollEnd={(e) => {
            isPhotoInteractingRef.current = false;
            if (!isCurrentCard) return;
            const offsetY = e.nativeEvent.contentOffset.y;
            const index = photoHeight > 0 ? Math.round(offsetY / photoHeight) : 0;
            setPhotoIndices((prev) => ({
              ...prev,
              [profile.id]: Math.min(Math.max(index, 0), photos.length - 1),
            }));
          }}
          getItemLayout={(_, idx) => ({
            length: photoHeight,
            offset: photoHeight * idx,
            index: idx,
          })}
          renderItem={({ item: photoUrl, index: photoIndex }) => (
            <View style={[styles.photoContainer, { height: photoHeight }]}>
              <Image source={{ uri: photoUrl }} style={[styles.photo, { height: photoHeight }]} resizeMode="cover" />
              {isCurrentCard && (
                <View style={styles.profileOverlay}>
                  <View style={styles.overlayContent}>
                    <Text style={styles.overlayName}>
                      {profile.name}, {profile.age}
                    </Text>

                    {profile.height && (
                      <View style={styles.overlayDetails}>
                        <View style={styles.overlayDetailItem}>
                          <Ionicons name="resize-outline" size={14} color={Colors.white} />
                          <Text style={styles.overlayDetailText}>{profile.height}</Text>
                        </View>
                      </View>
                    )}

                    {profile.occupation && (
                      <View style={styles.overlayDetailItem}>
                        <Ionicons name="briefcase-outline" size={14} color={Colors.white} />
                        <Text style={styles.overlayDetailText}>{profile.occupation}</Text>
                      </View>
                    )}

                    {profile.datingIntention && (
                      <View style={styles.overlayDetailItem}>
                        <Ionicons name="heart-outline" size={14} color={Colors.white} />
                        <Text style={styles.overlayDetailText}>{profile.datingIntention}</Text>
                      </View>
                    )}

                    {profile.bio && <Text style={styles.overlayBio}>{profile.bio}</Text>}

                    {profile.interests && profile.interests.length > 0 && (
                      <View style={styles.overlayInterests}>
                        {profile.interests.map((interest, interestIdx) => (
                          <View key={interestIdx} style={styles.overlayInterestChip}>
                            <Text style={styles.overlayInterestText}>
                              {getInterestEmoji(interest)} {interest}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              )}
            </View>
          )}
        />
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Finding matches...</Text>
      </View>
    );
  }

  if (profiles.length === 0 || currentIndex >= profiles.length) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="heart-outline" size={64} color={Colors.lightGray} />
        <Text style={styles.emptyTitle}>No more profiles</Text>
        <Text style={styles.emptySubtitle}>Check back later for new matches!</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={loadProfiles}>
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Filter button only (top left) */}
      <TouchableOpacity
        style={[styles.filterButton, { top: insets.top + Spacing.lg }]}
        onPress={() => setFilterModalVisible(true)}
      >
        <Ionicons name="options-outline" size={24} color={Colors.white} />
      </TouchableOpacity>

      {/* Card Container - full screen */}
      <View
        style={styles.cardContainer}
        onLayout={(event) => {
          const { height } = event.nativeEvent.layout;
          if (height > 0 && Math.abs(height - cardHeight) > 1) {
            setCardHeight(height);
          }
        }}
      >
        {profiles.map((profile, index) => renderCard(profile, index))}
      </View>

      {/* Filter Modal */}
      <Modal
        visible={filterModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filters</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <Ionicons name="close" size={28} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.filterScroll}>
              {/* Age Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Age: {draftFilters.minAge ?? 18} - {draftFilters.maxAge ?? 35}</Text>
                <MultiSlider
                  values={[
                    draftFilters.minAge ?? DEFAULT_FILTERS.minAge!,
                    draftFilters.maxAge ?? DEFAULT_FILTERS.maxAge!,
                  ]}
                  min={18}
                  max={50}
                  step={1}
                  onValuesChange={([min, max]) =>
                    setDraftFilters({
                      ...draftFilters,
                      minAge: Math.min(min, max),
                      maxAge: Math.max(min, max),
                    })
                  }
                  selectedStyle={styles.sliderSelectedTrack}
                  unselectedStyle={styles.sliderUnselectedTrack}
                  markerStyle={styles.sliderMarker}
                  containerStyle={styles.rangeSliderContainer}
                />
              </View>

              {/* Gender Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Gender</Text>
                <View style={styles.chipContainer}>
                  {['male', 'female', 'non-binary'].map((gender) => (
                    <TouchableOpacity
                      key={gender}
                      style={[
                        styles.filterChip,
                        (draftFilters.gender || []).includes(gender) && styles.filterChipSelected,
                      ]}
                      onPress={() => toggleGender(gender)}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          (draftFilters.gender || []).includes(gender) && styles.filterChipTextSelected,
                        ]}
                      >
                        {gender.charAt(0).toUpperCase() + gender.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Height Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>
                  Height: {inchesToFeetString(draftFilters.minHeight || 60)} ({inchesToCm(draftFilters.minHeight || 60)}cm) - {inchesToFeetString(draftFilters.maxHeight || 77)} ({inchesToCm(draftFilters.maxHeight || 77)}cm)
                </Text>
                <MultiSlider
                  values={[
                    draftFilters.minHeight ?? DEFAULT_FILTERS.minHeight!,
                    draftFilters.maxHeight ?? DEFAULT_FILTERS.maxHeight!,
                  ]}
                  min={60}
                  max={77}
                  step={1}
                  onValuesChange={([min, max]) =>
                    setDraftFilters({
                      ...draftFilters,
                      minHeight: Math.min(min, max),
                      maxHeight: Math.max(min, max),
                    })
                  }
                  selectedStyle={styles.sliderSelectedTrack}
                  unselectedStyle={styles.sliderUnselectedTrack}
                  markerStyle={styles.sliderMarker}
                  containerStyle={styles.rangeSliderContainer}
                />
              </View>

              {/* Distance Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Maximum Distance: {draftFilters.maxDistance || 50} miles</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={1}
                  maximumValue={100}
                  step={1}
                  value={draftFilters.maxDistance || 50}
                  onValueChange={(value) => setDraftFilters({ ...draftFilters, maxDistance: value })}
                  minimumTrackTintColor={Colors.primary}
                  maximumTrackTintColor={Colors.lightGray}
                />
              </View>

              {/* Ethnicity Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Ethnicity</Text>
                <View style={styles.chipContainer}>
                  {['Asian', 'Black', 'Hispanic', 'White', 'Mixed', 'Other'].map((ethnicity) => (
                    <TouchableOpacity
                      key={ethnicity}
                      style={[
                        styles.filterChip,
                        (draftFilters.ethnicity || []).includes(ethnicity) && styles.filterChipSelected,
                      ]}
                      onPress={() => toggleEthnicity(ethnicity)}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          (draftFilters.ethnicity || []).includes(ethnicity) && styles.filterChipTextSelected,
                        ]}
                      >
                        {ethnicity}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Dating Intention Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Dating Intentions</Text>
                <View style={styles.chipContainer}>
                  {['Long-term relationship', 'Casual dating', 'Friendship', 'Not sure yet'].map((intention) => (
                    <TouchableOpacity
                      key={intention}
                      style={[
                        styles.filterChip,
                        (draftFilters.datingIntention || []).includes(intention) && styles.filterChipSelected,
                      ]}
                      onPress={() => toggleDatingIntention(intention)}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          (draftFilters.datingIntention || []).includes(intention) && styles.filterChipTextSelected,
                        ]}
                      >
                        {intention}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.clearButton]}
                onPress={() => {
                  setDraftFilters({ ...DEFAULT_FILTERS });
                  setFilters({ ...DEFAULT_FILTERS });
                }}
              >
                <Text style={styles.clearButtonText}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.applyButton]}
                onPress={() => {
                  setFilters({ ...draftFilters });
                  setFilterModalVisible(false);
                }}
              >
                <Text style={styles.applyButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  filterButton: {
    position: 'absolute',
    left: 20,
    zIndex: 200,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    ...Typography.h3,
    marginTop: Spacing.lg,
  },
  emptySubtitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  refreshButton: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.round,
  },
  refreshButtonText: {
    ...Typography.body,
    color: Colors.white,
    fontWeight: '600',
  },
  cardContainer: {
    flex: 1,
    position: 'relative',
    width: '100%',
  },
  card: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: screenWidth,
    backgroundColor: Colors.white,
    shadowColor: Colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  photoIndicator: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 50,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.round,
  },
  photoIndicatorText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  swipeOverlay: {
    position: 'absolute',
    top: 100,
    zIndex: 100,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 3,
  },
  likeOverlay: {
    right: 30,
    borderColor: Colors.success,
    transform: [{ rotate: '15deg' }],
  },
  nopeOverlay: {
    left: 30,
    borderColor: Colors.error,
    transform: [{ rotate: '-15deg' }],
  },
  overlayText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.white,
  },
  photoList: {
    flex: 1,
  },
  photoContainer: {
    position: 'relative',
  },
  photo: {
    width: screenWidth,
  },
  profileOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  overlayContent: {
    gap: 8,
  },
  overlayName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.white,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  overlayBio: {
    fontSize: 15,
    color: Colors.white,
    lineHeight: 22,
  },
  overlayInterests: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  overlayInterestChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.round,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  overlayInterestText: {
    fontSize: 13,
    color: Colors.white,
    fontWeight: '600',
  },
  overlayDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  overlayDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  overlayDetailText: {
    fontSize: 14,
    color: Colors.white,
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  buttonsContainer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.xl,
  },
  button: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.white,
    shadowColor: Colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 3.84,
    elevation: 5,
  },
  skipButton: {
    borderWidth: 2,
    borderColor: Colors.error,
  },
  likeButton: {
    borderWidth: 2,
    borderColor: Colors.success,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing.lg,
    maxHeight: screenHeight * 0.85,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    ...Typography.h2,
  },
  filterScroll: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  filterSection: {
    marginBottom: Spacing.xl,
  },
  filterLabel: {
    ...Typography.body,
    fontWeight: '600',
    marginBottom: Spacing.sm,
    color: Colors.text,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  rangeSliderContainer: {
    marginHorizontal: Spacing.md,
  },
  sliderSelectedTrack: {
    backgroundColor: Colors.primary,
  },
  sliderUnselectedTrack: {
    backgroundColor: Colors.lightGray,
  },
  sliderMarker: {
    height: 24,
    width: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.lightGray,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
  },
  filterChipTextSelected: {
    color: Colors.white,
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: Colors.lightGray,
  },
  clearButtonText: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: '600',
  },
  applyButton: {
    backgroundColor: Colors.primary,
  },
  applyButtonText: {
    ...Typography.body,
    color: Colors.white,
    fontWeight: '600',
  },
});
