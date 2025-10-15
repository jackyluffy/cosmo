import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Service for handling authentication with the backend
 * Includes methods for getting auth tokens and making authenticated requests
 */
class AuthService {
  private static TOKEN_KEY = 'cosmo_auth_token';
  private static REFRESH_TOKEN_KEY = 'cosmo_refresh_token';

  /**
   * Store authentication token
   */
  static async storeToken(token: string, refreshToken?: string): Promise<void> {
    try {
      await AsyncStorage.setItem(this.TOKEN_KEY, token);
      if (refreshToken) {
        await AsyncStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
      }
    } catch (error) {
      console.error('Error storing auth token:', error);
      throw error;
    }
  }

  /**
   * Get stored authentication token
   */
  static async getToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(this.TOKEN_KEY);
    } catch (error) {
      console.error('Error retrieving auth token:', error);
      return null;
    }
  }

  /**
   * Get stored refresh token
   */
  static async getRefreshToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(this.REFRESH_TOKEN_KEY);
    } catch (error) {
      console.error('Error retrieving refresh token:', error);
      return null;
    }
  }

  /**
   * Clear all stored tokens
   */
  static async clearTokens(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([this.TOKEN_KEY, this.REFRESH_TOKEN_KEY]);
    } catch (error) {
      console.error('Error clearing auth tokens:', error);
      throw error;
    }
  }

  /**
   * Check if user is authenticated
   */
  static async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return !!token;
  }

  /**
   * Get authentication headers for API requests
   */
  static async getAuthHeaders(): Promise<{ Authorization?: string }> {
    const token = await this.getToken();
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
    return {};
  }

  /**
   * For testing: Create a temporary auth token to test Cloud Run access
   * This is a placeholder - in production, tokens would come from your auth flow
   */
  static async createTestToken(): Promise<string> {
    // In a real app, this would be replaced with actual authentication
    // For now, return a placeholder that the backend can recognize
    return 'test-token-' + Date.now();
  }
}

export default AuthService;