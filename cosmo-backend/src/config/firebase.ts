import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

const DEFAULT_PROJECT_ID = 'cosmo-production-473621';

const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.PROJECT_ID ||
  DEFAULT_PROJECT_ID;

const getServiceAccountFromFile = (filePath: string) => {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Firebase credentials file not found at path: ${resolvedPath}`);
  }
  const fileContents = fs.readFileSync(resolvedPath, 'utf8');
  return JSON.parse(fileContents);
};

const getServiceAccountFromBase64 = (base64: string) => {
  const json = Buffer.from(base64, 'base64').toString('utf8');
  return JSON.parse(json);
};

// Determine credential source
const base64Credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64;
const jsonCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
const credentialsFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;

let appOptions: admin.AppOptions = {
  projectId,
};

let loadedServiceAccount: any | null = null;

try {
  if (base64Credentials) {
    const serviceAccount = getServiceAccountFromBase64(base64Credentials);
    appOptions = {
      ...appOptions,
      projectId: serviceAccount.project_id || appOptions.projectId,
    };
    console.log('[Firebase] Loaded credentials from GOOGLE_APPLICATION_CREDENTIALS_BASE64');
    if (serviceAccount.client_email) {
      console.log('[Firebase] Service account:', serviceAccount.client_email);
    }
    loadedServiceAccount = serviceAccount;
  } else if (jsonCredentials) {
    const serviceAccount = JSON.parse(jsonCredentials);
    appOptions = {
      ...appOptions,
      projectId: serviceAccount.project_id || appOptions.projectId,
    };
    console.log('[Firebase] Loaded credentials from GOOGLE_APPLICATION_CREDENTIALS_JSON');
    if (serviceAccount.client_email) {
      console.log('[Firebase] Service account:', serviceAccount.client_email);
    }
    loadedServiceAccount = serviceAccount;
  } else if (credentialsFile) {
    const serviceAccount = getServiceAccountFromFile(credentialsFile);
    appOptions = {
      ...appOptions,
      projectId: serviceAccount.project_id || appOptions.projectId,
    };
    console.log('[Firebase] Loaded credentials from GOOGLE_APPLICATION_CREDENTIALS path');
    if (serviceAccount.client_email) {
      console.log('[Firebase] Service account:', serviceAccount.client_email);
    }
    loadedServiceAccount = serviceAccount;
  } else {
    console.log('[Firebase] Using application default credentials');
    appOptions = {
      ...appOptions,
      credential: admin.credential.applicationDefault(),
    };
  }
} catch (error: any) {
  console.error('[Firebase] Failed to load credentials:', error.message);
  throw error;
}

// Initialize Firebase Admin
if (
  loadedServiceAccount &&
  loadedServiceAccount.project_id &&
  loadedServiceAccount.project_id === appOptions.projectId
) {
  console.log('[Firebase] Using loaded service account for Firebase Admin');
  admin.initializeApp({
    ...appOptions,
    credential: admin.credential.cert(loadedServiceAccount as admin.ServiceAccount),
  });
} else {
  if (loadedServiceAccount && loadedServiceAccount.project_id !== appOptions.projectId) {
    console.warn(
      `[Firebase] Service account project (${loadedServiceAccount.project_id}) does not match target project (${appOptions.projectId}). Falling back to application default credentials.`
    );
  }
  admin.initializeApp({
    ...appOptions,
    credential: admin.credential.applicationDefault(),
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
