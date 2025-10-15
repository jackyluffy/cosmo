// Real backend API configuration for deployed Cloud Run service
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Cloud Run service URL
// Use local IP for iOS simulator (localhost doesn't work in iOS simulator)
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.68:8080';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // Increased to 60 seconds for Vision API processing
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Disable caching for all requests
    config.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    config.headers['Pragma'] = 'no-cache';
    config.headers['Expires'] = '0';
    // Log all PUT requests to /api/v1/profile
    if (config.method === 'put' && config.url?.includes('/api/v1/profile')) {
      console.log('[API Interceptor] PUT /api/v1/profile request:', {
        url: config.url,
        data: config.data,
        dataType: typeof config.data,
        dataStringified: JSON.stringify(config.data),
      });
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('auth_token');
    }
    return Promise.reject(error);
  }
);

// Import mock APIs only for features not yet implemented
import mockApi, {
  authAPI,
  eventsAPI,
  proposalsAPI,
  billingAPI,
  adminAPI,
} from './mockApi';

// Real swipe API using backend endpoints
export const swipeAPI = {
  getDeck: () => api.get('/api/v1/swipe/deck'),
  swipe: (targetId: string, direction: 'like' | 'skip') =>
    api.post(`/api/v1/swipe/${targetId}`, { direction }),
  getMatches: () => api.get('/api/v1/swipe/matches'),
  unmatch: (matchId: string) => api.delete(`/api/v1/swipe/matches/${matchId}`),
};

// Real profile API using backend endpoints
export const profileAPI = {
  get: () => api.get('/api/v1/profile/me'),
  update: (profileData: any) => api.put('/api/v1/profile', profileData),
  uploadPhoto: (formData: FormData) =>
    api.post('/api/v1/profile/photo', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),
  deletePhoto: (photoUrl: string) =>
    api.delete('/api/v1/profile/photo', {
      data: { photoUrl },
    }),
  fixPhotoUrls: () => api.post('/api/v1/profile/fix-photos'),
};

// Real API endpoints for the production dating app backend
const realAPI = {
  // Health check endpoints
  health: () => api.get('/health'),
  publicHealth: () => api.get('/public/health'),

  // Authentication endpoints
  auth: {
    requestOTP: (phoneNumber: string) => api.post('/api/v1/auth/otp/request', { phone: phoneNumber }),
    verifyOTP: (phoneNumber: string, otp: string) => api.post('/api/v1/auth/otp/verify', { phone: phoneNumber, code: otp }),
    googleSignIn: (idToken: string) => api.post('/api/v1/auth/google', { idToken }),
    appleSignIn: (identityToken: string, user?: any) => api.post('/api/v1/auth/apple', { identityToken, user }),
  },

  // Profile management endpoints
  profile: {
    get: () => api.get('/api/v1/profile/me'),
    update: (profileData: any) => api.put('/api/v1/profile', profileData),
  },

  // Swipe and matching endpoints
  swipe: {
    getPotential: () => api.get('/api/v1/swipe/potential'),
    recordSwipe: (userId: string, action: 'like' | 'pass') =>
      api.post('/api/v1/swipe', { userId, action }),
  },

  // Group dating events endpoints
  events: {
    getAll: () => api.get('/api/v1/events'),
    create: (eventData: any) => api.post('/api/v1/events', eventData),
  },

  // Chat system endpoints
  chat: {
    getConversations: () => api.get('/api/v1/chat/conversations'),
    sendMessage: (conversationId: string, message: string) =>
      api.post('/api/v1/chat/send', { conversationId, message }),
  },

  // Billing and subscription endpoints
  billing: {
    getSubscription: () => api.get('/api/v1/billing/subscription'),
    upgrade: (planId: string) => api.post('/api/v1/billing/upgrade', { planId }),
  },
};

// Export all the APIs
export {
  authAPI,
  eventsAPI,
  proposalsAPI,
  billingAPI,
  adminAPI,
  realAPI,
};

export default api;