import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
admin.initializeApp();

// Get Firestore instance
export const db = getFirestore();

// Set Firestore settings
db.settings({
  ignoreUndefinedProperties: true,
});

// Collections
export const Collections = {
  USERS: 'users',
  EVENTS: 'events',
  MATCHES: 'matches',
  GROUPS: 'groups',
  MESSAGES: 'messages',
  NOTIFICATIONS: 'notifications',
  REPORTS: 'reports',
  SUBSCRIPTIONS: 'subscriptions',
  OTP_CODES: 'otp_codes',
  ANALYTICS: 'analytics',
} as const;

// Storage buckets
export const Buckets = {
  PROFILE_PHOTOS: 'profile-photos',
  EVENT_PHOTOS: 'event-photos',
  CHAT_MEDIA: 'chat-media',
} as const;

export default admin;