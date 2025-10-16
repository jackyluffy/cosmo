import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { INTERESTS } from '../../constants/interests';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';

export default function InterestsScreen({ navigation }: any) {
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleInterest = useCallback((id: string) => {
    setSelectedInterests((prev) =>
      prev.includes(id)
        ? prev.filter((i) => i !== id)
        : [...prev, id]
    );
  }, []);

  const handleContinue = useCallback(async () => {
    if (selectedInterests.length < 3) {
      Alert.alert('Select More Interests', 'Please select at least 3 interests to continue.');
      return;
    }

    // Prevent double-clicks
    if (isSubmitting) {
      return;
    }

    try {
      setIsSubmitting(true);
      const { updateProfile, loadUser, user } = useAuthStore.getState();

      // Check if user has completed previous steps
      const hasBasicInfo = user?.profile?.name && user?.profile?.age && user?.profile?.gender;
      const hasPhotos = user?.profile?.photos && user.profile.photos.length >= 3;
      const hasLocation = user?.profile?.location?.lat && user?.profile?.location?.lng;

      if (!hasBasicInfo || !hasPhotos || !hasLocation) {
        Alert.alert(
          'Incomplete Profile',
          'Please complete all previous onboarding steps first.',
          [{ text: 'OK' }]
        );
        setIsSubmitting(false);
        return;
      }

      console.log('[InterestsScreen] Updating profile with interests:', selectedInterests);

      // Update the profile with interests
      await updateProfile({
        interests: selectedInterests,
      });

      console.log('[InterestsScreen] Reloading user data...');
      await loadUser();

      console.log('[InterestsScreen] Interests saved, navigating to subscription screen');

      // Navigate to subscription screen
      navigation.navigate('Subscription');

      setIsSubmitting(false)
    } catch (error: any) {
      console.error('[InterestsScreen] Failed to save interests:', error);
      setIsSubmitting(false);
      Alert.alert(
        'Error',
        error.response?.data?.error || error.message || 'Failed to save interests. Please try again.'
      );
    }
  }, [selectedInterests]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>What do you enjoy?</Text>
        <Text style={styles.subtitle}>
          Select at least 3 interests (required)
        </Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '33%' }]} />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.interestsGrid}>
          {INTERESTS.map((interest) => {
            const isSelected = selectedInterests.includes(interest.id);
            return (
              <TouchableOpacity
                key={interest.id}
                style={[
                  styles.interestCard,
                  isSelected && styles.interestCardSelected,
                ]}
                onPress={() => toggleInterest(interest.id)}
                activeOpacity={0.7}
              >
                <Text style={styles.emoji}>{interest.emoji}</Text>
                <Text style={[
                  styles.interestLabel,
                  isSelected && styles.interestLabelSelected,
                ]}>
                  {interest.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.selectedCount}>
          {selectedInterests.length} selected
          {selectedInterests.length < 3 && ' (min 3)'}
        </Text>
        <TouchableOpacity
          style={[
            styles.continueButton,
            (selectedInterests.length < 3 || isSubmitting) && styles.buttonDisabled,
          ]}
          onPress={handleContinue}
          disabled={selectedInterests.length < 3 || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.continueButtonText}>Continue</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
  progressBar: {
    height: 4,
    backgroundColor: Colors.lightGray,
    borderRadius: BorderRadius.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sm,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  interestCard: {
    width: '47%',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  interestCardSelected: {
    backgroundColor: Colors.primary100,
    borderColor: Colors.primary,
  },
  emoji: {
    fontSize: 32,
    marginBottom: Spacing.sm,
  },
  interestLabel: {
    ...Typography.bodySmall,
    textAlign: 'center',
    color: Colors.text,
  },
  interestLabelSelected: {
    color: Colors.primary600,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.white,
  },
  selectedCount: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  continueButton: {
    height: 56,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: Colors.lightGray,
  },
  continueButtonText: {
    ...Typography.body,
    color: Colors.white,
    fontWeight: '600',
  },
});