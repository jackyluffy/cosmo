import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import * as InAppPurchases from 'expo-in-app-purchases';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/theme';
import { iapService } from '../../services/iapService';
import { useFocusEffect } from '@react-navigation/native';

export default function SubscriptionScreen({ navigation, route }: any) {
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [products, setProducts] = useState<InAppPurchases.IAPItemDetails[]>([]);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const origin = route?.params?.origin;

  const loadSubscriptionStatus = useCallback(async () => {
    if (Platform.OS === 'web') {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      await iapService.initialize();
      const [availableProducts, status] = await Promise.all([
        iapService.getProducts(),
        iapService.checkSubscriptionStatus(),
      ]);
      setProducts(availableProducts);
      setHasActiveSubscription(status.isActive);
    } catch (error: any) {
      console.error('[SubscriptionScreen] Failed to initialize IAP:', error);
      Alert.alert(
        'In-App Purchases Unavailable',
        error?.message || 'We could not connect to the App Store. You can try again later.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSubscriptionStatus();

      return () => {
        iapService.disconnect().catch((error) => {
          console.warn('[SubscriptionScreen] Failed to disconnect IAP:', error);
        });
      };
    }, [loadSubscriptionStatus])
  );

  const handlePurchase = async () => {
    if (processing) return;
    try {
      setProcessing(true);
      const purchased = await iapService.purchaseSubscription();
      if (purchased) {
        Alert.alert('Purchase Pending', 'Your purchase is being processed.');
      }
    } catch (error: any) {
      if (error?.code !== 'E_USER_CANCELLED') {
        Alert.alert('Purchase Failed', error?.message || 'Unable to complete the purchase.');
      }
    } finally {
      setProcessing(false);
      loadSubscriptionStatus();
    }
  };

  const handleRestore = async () => {
    if (processing) return;

    try {
      setProcessing(true);
      const restored = await iapService.restorePurchases();
      if (restored.length === 0) {
        Alert.alert('No Purchases Found', 'We could not find any previous purchases to restore.');
      } else {
        Alert.alert('Restored', 'Your previous purchases have been restored.');
      }
    } catch (error: any) {
      Alert.alert('Restore Failed', error?.message || 'Failed to restore purchases.');
    } finally {
      setProcessing(false);
      loadSubscriptionStatus();
    }
  };

  const handleContinue = () => {
    if (origin === 'events') {
      navigation.goBack();
      return;
    }
    navigation.reset({
      index: 0,
      routes: [{ name: 'MainTabs' }],
    });
  };

  const primaryProduct = products[0];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Unlock Cosmo Premium</Text>
        <Text style={styles.subtitle}>
          Join a community of curated group dates, premium events, and exclusive perks.
        </Text>

        <View style={styles.benefitCard}>
          <Text style={styles.benefitTitle}>Your Membership Includes</Text>
          <View style={styles.benefitItem}>
            <View style={styles.bullet} />
            <Text style={styles.benefitText}>Priority matching with curated groups</Text>
          </View>
          <View style={styles.benefitItem}>
            <View style={styles.bullet} />
            <Text style={styles.benefitText}>Unlimited event RSVPs</Text>
          </View>
          <View style={styles.benefitItem}>
            <View style={styles.bullet} />
            <Text style={styles.benefitText}>Access to premium venues and hosts</Text>
          </View>
          <View style={styles.benefitItem}>
            <View style={styles.bullet} />
            <Text style={styles.benefitText}>Direct chat with your concierge</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Preparing your membership…</Text>
          </View>
        ) : (
          <>
            {hasActiveSubscription && (
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>You already have an active subscription</Text>
              </View>
            )}

            {primaryProduct && (
              <View style={styles.priceCard}>
                <Text style={styles.price}>{primaryProduct.price}</Text>
                <Text style={styles.priceCaption}>{primaryProduct.description}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.ctaButton, processing && styles.disabledButton]}
              onPress={handlePurchase}
              disabled={processing || loading}
            >
              {processing ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.ctaButtonText}>
                  {primaryProduct ? `Continue with ${primaryProduct.price}` : 'Subscribe'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleRestore}
              disabled={processing}
            >
              <Text style={styles.secondaryButtonText}>Restore Purchases</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.skipButton} onPress={handleContinue}>
              <Text style={styles.skipButtonText}>
                {hasActiveSubscription ? 'Continue to the app' : 'Maybe later'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      <Text style={styles.footerNote}>
        Payments are handled securely by the App Store. You can cancel anytime in your App Store
        account settings.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.lg,
  },
  title: {
    ...Typography.h2,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  benefitCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
    shadowColor: Colors.black,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  benefitTitle: {
    ...Typography.body,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  bullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginRight: Spacing.md,
  },
  benefitText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    flex: 1,
  },
  loadingContainer: {
    marginTop: Spacing.xl,
    alignItems: 'center',
  },
  loadingText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  activeBadge: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primary100,
    borderWidth: 1,
    borderColor: Colors.primary,
    marginBottom: Spacing.md,
  },
  activeBadgeText: {
    ...Typography.bodySmall,
    color: Colors.primary600,
    textAlign: 'center',
  },
  priceCard: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  price: {
    fontSize: 36,
    fontWeight: '700',
    color: Colors.text,
  },
  priceCaption: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  ctaButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.round,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  ctaButtonText: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.white,
  },
  disabledButton: {
    opacity: 0.6,
  },
  secondaryButton: {
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.round,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
    marginBottom: Spacing.md,
  },
  secondaryButtonText: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.primary,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  skipButtonText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    textDecorationLine: 'underline',
  },
  footerNote: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
});
