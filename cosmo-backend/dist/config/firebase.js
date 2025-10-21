"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Buckets = exports.Collections = exports.db = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const DEFAULT_PROJECT_ID = 'cosmo-production-473621';
const projectId = process.env.FIREBASE_PROJECT_ID ||
    process.env.PROJECT_ID ||
    DEFAULT_PROJECT_ID;
const getServiceAccountFromFile = (filePath) => {
    const resolvedPath = path_1.default.resolve(filePath);
    if (!fs_1.default.existsSync(resolvedPath)) {
        console.warn(`[Firebase] Credentials file not found at path: ${resolvedPath}, falling back to ADC`);
        return null;
    }
    const fileContents = fs_1.default.readFileSync(resolvedPath, 'utf8');
    if (!fileContents || fileContents.trim() === '') {
        console.warn(`[Firebase] Credentials file is empty at path: ${resolvedPath}, falling back to ADC`);
        return null;
    }
    return JSON.parse(fileContents);
};
const getServiceAccountFromBase64 = (base64) => {
    const json = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(json);
};
// Determine credential source
const base64Credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64;
const jsonCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
const credentialsFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
let appOptions = {
    projectId,
};
let loadedServiceAccount = null;
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
    }
    else if (jsonCredentials) {
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
    }
    else if (credentialsFile) {
        const serviceAccount = getServiceAccountFromFile(credentialsFile);
        if (serviceAccount) {
            appOptions = {
                ...appOptions,
                projectId: serviceAccount.project_id || appOptions.projectId,
            };
            console.log('[Firebase] Loaded credentials from GOOGLE_APPLICATION_CREDENTIALS path');
            if (serviceAccount.client_email) {
                console.log('[Firebase] Service account:', serviceAccount.client_email);
            }
            loadedServiceAccount = serviceAccount;
        }
        else {
            console.log('[Firebase] Using application default credentials');
            appOptions = {
                ...appOptions,
                credential: admin.credential.applicationDefault(),
            };
        }
    }
    else {
        console.log('[Firebase] Using application default credentials');
        appOptions = {
            ...appOptions,
            credential: admin.credential.applicationDefault(),
        };
    }
}
catch (error) {
    console.error('[Firebase] Failed to load credentials:', error.message);
    throw error;
}
// Initialize Firebase Admin
if (loadedServiceAccount &&
    loadedServiceAccount.project_id &&
    loadedServiceAccount.project_id === appOptions.projectId) {
    console.log('[Firebase] Using loaded service account for Firebase Admin');
    admin.initializeApp({
        ...appOptions,
        credential: admin.credential.cert(loadedServiceAccount),
    });
}
else {
    if (loadedServiceAccount && loadedServiceAccount.project_id !== appOptions.projectId) {
        console.warn(`[Firebase] Service account project (${loadedServiceAccount.project_id}) does not match target project (${appOptions.projectId}). Falling back to application default credentials.`);
    }
    admin.initializeApp({
        ...appOptions,
        credential: admin.credential.applicationDefault(),
    });
}
// Get Firestore instance
exports.db = (0, firestore_1.getFirestore)();
// Set Firestore settings
exports.db.settings({
    ignoreUndefinedProperties: true,
});
// Collections
exports.Collections = {
    USERS: 'users',
    EVENTS: 'events',
    SWIPES: 'swipes',
    MATCHES: 'matches',
    PAIR_MATCHES: 'pair_matches',
    GROUP_CHATS: 'group_chats',
    EVENT_PARTICIPANTS: 'event_participants',
    GROUPS: 'groups',
    MESSAGES: 'messages',
    NOTIFICATIONS: 'notifications',
    REPORTS: 'reports',
    SUBSCRIPTIONS: 'subscriptions',
    OTP_CODES: 'otp_codes',
    ANALYTICS: 'analytics',
};
// Storage buckets
exports.Buckets = {
    PROFILE_PHOTOS: 'profile-photos',
    EVENT_PHOTOS: 'event-photos',
    CHAT_MEDIA: 'chat-media',
};
exports.default = admin;
//# sourceMappingURL=firebase.js.map