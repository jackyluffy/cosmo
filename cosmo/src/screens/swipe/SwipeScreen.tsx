import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { swipeAPI } from '../../services/api';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/theme';

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
}

export default function SwipeScreen() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  const position = useRef(new Animated.ValueXY()).current;
  const swipeDirection = useRef<'left' | 'right' | null>(null);

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      console.log('[SwipeScreen] Calling getDeck API...');
      const response = await swipeAPI.getDeck();
      console.log('[SwipeScreen] Response received:', response);

      if (!response || !response.data) {
        console.log('[SwipeScreen] Response is null/undefined or has no data');
        setProfiles([]);
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
        };
      });

      console.log('[SwipeScreen] Mapped profiles:', mappedProfiles.length);
      setProfiles(mappedProfiles);
      setCurrentIndex(0);
    } catch (error) {
      console.error('[SwipeScreen] Failed to load profiles:', error);
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSwipe = async (direction: 'left' | 'right') => {
    const profile = profiles[currentIndex];
    if (!profile) return;

    try {
      await swipeAPI.swipe(profile.id, direction === 'right' ? 'like' : 'skip');
    } catch (error) {
      console.error('Failed to record swipe:', error);
    }

    // Move to next card
    setTimeout(() => {
      if (currentIndex === profiles.length - 1) {
        loadProfiles();
      } else {
        setCurrentIndex(currentIndex + 1);
        position.setValue({ x: 0, y: 0 });
      }
    }, 300);
  };

  const swipeLeft = () => {
    Animated.timing(position, {
      toValue: { x: -screenWidth - 100, y: 0 },
      duration: 250,
      useNativeDriver: false,
    }).start(() => handleSwipe('left'));
  };

  const swipeRight = () => {
    Animated.timing(position, {
      toValue: { x: screenWidth + 100, y: 0 },
      duration: 250,
      useNativeDriver: false,
    }).start(() => handleSwipe('right'));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        position.setValue({ x: gesture.dx, y: gesture.dy });
      },
      onPanResponderRelease: (_, gesture) => {
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
    })
  ).current;

  const renderCard = (profile: Profile, index: number) => {
    if (!profile || index !== currentIndex) return null;

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

    return (
      <Animated.View
        key={profile.id}
        style={[
          styles.card,
          {
            transform: [
              { translateX: position.x },
              { translateY: position.y },
              { rotate },
            ],
          },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Swipe Overlays */}
        <Animated.View style={[styles.swipeOverlay, styles.likeOverlay, { opacity: likeOpacity }]}>
          <Text style={styles.overlayText}>LIKE</Text>
        </Animated.View>
        <Animated.View style={[styles.swipeOverlay, styles.nopeOverlay, { opacity: nopeOpacity }]}>
          <Text style={styles.overlayText}>SKIP</Text>
        </Animated.View>

        {/* Photo Carousel */}
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.photoCarousel}
        >
          {photos.map((photoUrl, idx) => (
            <Image
              key={idx}
              source={{ uri: photoUrl }}
              style={styles.photo}
              resizeMode="cover"
            />
          ))}
        </ScrollView>

        {/* Profile Info Overlay */}
        <View style={styles.profileOverlay}>
          <View style={styles.nameRow}>
            <Text style={styles.cardName}>
              {profile.name}, {profile.age}
            </Text>
          </View>

          <View style={styles.detailsRow}>
            {profile.gender && (
              <View style={styles.detailItem}>
                <Ionicons name="person-outline" size={16} color={Colors.white} />
                <Text style={styles.detailText}>
                  {profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1)}
                </Text>
              </View>
            )}
            <View style={styles.detailItem}>
              <Ionicons name="location-outline" size={16} color={Colors.white} />
              <Text style={styles.detailText}>{profile.distance} miles away</Text>
            </View>
          </View>

          {profile.bio && (
            <Text style={styles.cardBio} numberOfLines={2}>
              {profile.bio}
            </Text>
          )}

          {profile.interests && profile.interests.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.interestsScroll}
            >
              {profile.interests.slice(0, 5).map((interest, idx) => (
                <View key={idx} style={styles.interestChip}>
                  <Text style={styles.interestText}>
                    {getInterestEmoji(interest)} {interest}
                  </Text>
                </View>
              ))}
              {profile.interests.length > 5 && (
                <View style={styles.interestChip}>
                  <Text style={styles.interestText}>+{profile.interests.length - 5}</Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Discover</Text>
      </View>

      <View style={styles.cardContainer}>
        {profiles.map((profile, index) => renderCard(profile, index))}
      </View>

      <View style={styles.buttonsContainer}>
        <TouchableOpacity style={[styles.button, styles.skipButton]} onPress={swipeLeft}>
          <Ionicons name="close" size={32} color={Colors.error} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.likeButton]} onPress={swipeRight}>
          <Ionicons name="heart" size={32} color={Colors.success} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    ...Typography.h2,
    textAlign: 'center',
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    position: 'absolute',
    width: screenWidth * 0.9,
    height: screenHeight * 0.7,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.black,
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
  swipeOverlay: {
    position: 'absolute',
    top: 50,
    zIndex: 10,
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
  photoCarousel: {
    flex: 1,
  },
  photo: {
    width: screenWidth * 0.9,
    height: '100%',
  },
  profileOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  nameRow: {
    marginBottom: Spacing.xs,
  },
  cardName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.white,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  detailsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 14,
    color: Colors.white,
    fontWeight: '500',
  },
  cardBio: {
    fontSize: 15,
    color: Colors.white,
    marginBottom: Spacing.sm,
    lineHeight: 20,
  },
  interestsScroll: {
    marginTop: Spacing.xs,
  },
  interestChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: BorderRadius.round,
    marginRight: Spacing.xs,
  },
  interestText: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '600',
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
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
    shadowOpacity: 0.1,
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
});
