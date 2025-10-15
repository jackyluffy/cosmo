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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Buckets = exports.Collections = exports.db = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
// Initialize Firebase Admin
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // Use service account key file if specified
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID || process.env.PROJECT_ID || 'cosmo-production-473621',
    });
}
else {
    // Use Application Default Credentials (ADC) in Cloud Run
    admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || process.env.PROJECT_ID || 'cosmo-production-473621',
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