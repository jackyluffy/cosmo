import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { realAPI } from '../services/api';

interface User {
  id: string;
  phone?: string;
  email?: string;
  profile?: {
    name: string;
    age: number;
    gender: string;
    bio: string;
    photos: string[];
    interests: string[];
    traits: any;
    location?: {
      lat: number;
      lng: number;
    };
    radius: number;
    verified: boolean;
  };
  subscription?: {
    status: 'trial' | 'active' | 'past_due' | 'canceled';
    trial_event_used: boolean;
    renews_at?: string;
  };
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (phone?: string, email?: string, code?: string) => Promise<void>;
  googleSignIn: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  updateProfile: (profile: Partial<User['profile']>) => Promise<void>;
  updateInterests: (interests: string[]) => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (phone, email, code) => {
    set({ isLoading: true, error: null });
    try {
      if (!code) {
        // Request OTP via real API
        console.log('OTP requested for:', phone || email);
        if (phone) {
          await realAPI.auth.requestOTP(phone);
        } else if (email) {
          // TODO: Add email OTP support
          throw new Error('Email authentication not yet supported');
        }
        set({ isLoading: false });
        return;
      }

      // Verify OTP via real API
      const response = await realAPI.auth.verifyOTP(
        phone || email!,
        code
      );

      const { token, user } = response.data.data;

      // Store real token
      await AsyncStorage.setItem('auth_token', token);
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error: any) {
      console.error('Login error:', error);
      set({
        error: error.response?.data?.error || error.message || 'Authentication failed',
        isLoading: false
      });
      throw error;
    }
  },

  googleSignIn: async (idToken: string) => {
    set({ isLoading: true, error: null });
    try {
      console.log('Google Sign-In initiated');
      const response = await realAPI.auth.googleSignIn(idToken);
      const { token, user } = response.data.data;

      // Store token
      await AsyncStorage.setItem('auth_token', token);
      set({ user, isAuthenticated: true, isLoading: false });
      console.log('Google Sign-In successful');
    } catch (error: any) {
      console.error('Google Sign-In error:', error);
      set({
        error: error.response?.data?.error || error.message || 'Google authentication failed',
        isLoading: false
      });
      throw error;
    }
  },

  logout: async () => {
    await AsyncStorage.removeItem('auth_token');
    set({ user: null, isAuthenticated: false });
  },

  loadUser: async () => {
    set({ isLoading: true });
    try {
      // Check if we have a stored token
      const token = await AsyncStorage.getItem('auth_token');
      if (token) {
        // Get user profile from real API
        const response = await realAPI.profile.get();
        const user = response.data.data;
        set({ user, isAuthenticated: true, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Load user error:', error);
      // If token is invalid, clear it
      await AsyncStorage.removeItem('auth_token');
      set({ isLoading: false, isAuthenticated: false, user: null });
    }
  },

  updateProfile: async (profile) => {
    console.log('[authStore] updateProfile called with:', JSON.stringify(profile, null, 2));
    set({ isLoading: true, error: null });
    try {
      const currentUser = get().user;
      if (currentUser) {
        console.log('[authStore] Calling realAPI.profile.update with:', JSON.stringify(profile, null, 2));
        // Update via real API - send profile fields directly, not wrapped
        await realAPI.profile.update(profile);
        console.log('[authStore] realAPI.profile.update completed');

        // Update locally - ensure profile exists first
        const updatedProfile = {
          ...(currentUser.profile || {}),
          ...profile
        } as User['profile'];

        set({
          user: {
            ...currentUser,
            profile: updatedProfile
          },
          isLoading: false
        });
        console.log('[authStore] Profile updated locally:', profile);
        console.log('[authStore] Full profile now:', updatedProfile);
      }
    } catch (error: any) {
      console.error('[authStore] Update profile error:', error);
      set({
        error: error.response?.data?.error || error.message || 'Failed to update profile',
        isLoading: false
      });
      throw error;
    }
  },

  updateInterests: async (interests) => {
    set({ isLoading: true, error: null });
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      const currentUser = get().user;
      if (currentUser && currentUser.profile) {
        // Update interests locally
        set({
          user: {
            ...currentUser,
            profile: { ...currentUser.profile, interests }
          },
          isLoading: false
        });
        console.log('Interests updated:', interests);
      }
    } catch (error: any) {
      set({
        error: error.message || 'Failed to update interests',
        isLoading: false
      });
      throw error;
    }
  },

  checkAuth: async () => {
    const token = await AsyncStorage.getItem('auth_token');
    if (token) {
      await get().loadUser();
    }
  },
}));