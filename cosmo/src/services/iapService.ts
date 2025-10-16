import * as InAppPurchases from 'expo-in-app-purchases';
import { Platform } from 'react-native';

export const SUBSCRIPTION_PRODUCT_ID = 'com.cosmo.monthly';

export interface SubscriptionInfo {
  isActive: boolean;
  expirationDate?: Date;
  productId?: string;
  transactionId?: string;
}

class IAPService {
  private isInitialized = false;

  /**
   * Initialize IAP connection
   */
  async initialize(): Promise<void> {
    try {
      if (this.isInitialized) return;

      console.log('[IAP] Initializing In-App Purchases...');
      await InAppPurchases.connectAsync();
      this.isInitialized = true;
      console.log('[IAP] Successfully connected');

      // Set up purchase listener
      InAppPurchases.setPurchaseListener(({ responseCode, results, errorCode }) => {
        console.log('[IAP] Purchase listener triggered:', { responseCode, errorCode });

        if (responseCode === InAppPurchases.IAPResponseCode.OK) {
          results?.forEach((purchase) => {
            console.log('[IAP] Purchase successful:', purchase);
            if (!purchase.acknowledged) {
              console.log('[IAP] Finishing transaction:', purchase.transactionReceipt);
              // Finish the transaction
              InAppPurchases.finishTransactionAsync(purchase, true);
            }
          });
        } else if (responseCode === InAppPurchases.IAPResponseCode.USER_CANCELED) {
          console.log('[IAP] User canceled the purchase');
        } else if (responseCode === InAppPurchases.IAPResponseCode.ERROR) {
          console.error('[IAP] Purchase error:', errorCode);
        }
      });
    } catch (error) {
      console.error('[IAP] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Disconnect from IAP
   */
  async disconnect(): Promise<void> {
    try {
      if (!this.isInitialized) return;

      await InAppPurchases.disconnectAsync();
      this.isInitialized = false;
      console.log('[IAP] Disconnected');
    } catch (error) {
      console.error('[IAP] Failed to disconnect:', error);
    }
  }

  /**
   * Get available products
   */
  async getProducts(): Promise<InAppPurchases.IAPItemDetails[]> {
    try {
      console.log('[IAP] Fetching products:', [SUBSCRIPTION_PRODUCT_ID]);
      const { results, responseCode } = await InAppPurchases.getProductsAsync([
        SUBSCRIPTION_PRODUCT_ID,
      ]);

      if (responseCode === InAppPurchases.IAPResponseCode.OK) {
        console.log('[IAP] Products fetched successfully:', results);
        return results || [];
      } else {
        console.error('[IAP] Failed to fetch products, response code:', responseCode);
        return [];
      }
    } catch (error) {
      console.error('[IAP] Error fetching products:', error);
      return [];
    }
  }

  /**
   * Purchase a subscription
   */
  async purchaseSubscription(): Promise<boolean> {
    try {
      console.log('[IAP] Initiating purchase for:', SUBSCRIPTION_PRODUCT_ID);

      await InAppPurchases.purchaseItemAsync(SUBSCRIPTION_PRODUCT_ID);

      // The actual purchase result will be handled by the purchase listener
      return true;
    } catch (error: any) {
      console.error('[IAP] Purchase failed:', error);

      // User canceled
      if (error.code === 'E_USER_CANCELLED') {
        console.log('[IAP] User cancelled purchase');
        return false;
      }

      throw error;
    }
  }

  /**
   * Restore purchases
   */
  async restorePurchases(): Promise<InAppPurchases.InAppPurchase[]> {
    try {
      console.log('[IAP] Restoring purchases...');

      const { results, responseCode } = await InAppPurchases.getPurchaseHistoryAsync();

      if (responseCode === InAppPurchases.IAPResponseCode.OK && results) {
        console.log('[IAP] Purchases restored:', results.length);
        return results;
      } else {
        console.error('[IAP] Failed to restore purchases, response code:', responseCode);
        return [];
      }
    } catch (error) {
      console.error('[IAP] Error restoring purchases:', error);
      return [];
    }
  }

  /**
   * Check if user has active subscription
   */
  async checkSubscriptionStatus(): Promise<SubscriptionInfo> {
    try {
      console.log('[IAP] Checking subscription status...');

      const purchases = await this.restorePurchases();

      // Filter for our subscription product
      const subscription = purchases.find(
        (p) => p.productId === SUBSCRIPTION_PRODUCT_ID
      );

      if (!subscription) {
        console.log('[IAP] No subscription found');
        return { isActive: false };
      }

      // Check if subscription is still active
      // Note: For iOS, you should verify the receipt with Apple's servers
      // For now, we'll check the purchase history
      const expirationDate = subscription.expirationDate
        ? new Date(subscription.expirationDate)
        : undefined;

      const isActive = expirationDate
        ? expirationDate > new Date()
        : true; // If no expiration date, consider it active

      console.log('[IAP] Subscription status:', {
        isActive,
        expirationDate,
        productId: subscription.productId,
      });

      return {
        isActive,
        expirationDate,
        productId: subscription.productId,
        transactionId: subscription.transactionReceipt,
      };
    } catch (error) {
      console.error('[IAP] Error checking subscription status:', error);
      return { isActive: false };
    }
  }

  /**
   * Get subscription receipt for server verification
   */
  async getSubscriptionReceipt(): Promise<string | null> {
    try {
      const purchases = await this.restorePurchases();
      const subscription = purchases.find(
        (p) => p.productId === SUBSCRIPTION_PRODUCT_ID
      );

      return subscription?.transactionReceipt || null;
    } catch (error) {
      console.error('[IAP] Error getting receipt:', error);
      return null;
    }
  }
}

export const iapService = new IAPService();
