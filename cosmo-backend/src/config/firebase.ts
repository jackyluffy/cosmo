import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  // Use service account key file if specified
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.PROJECT_ID || 'cosmo-production-473621',
  });
} else {
  // Use Application Default Credentials (ADC) in Cloud Run
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.PROJECT_ID || 'cosmo-production-473621',
  });
}

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
  SWIPES: 'swipes',
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