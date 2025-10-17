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
exports.AuthService = void 0;
const jwt = __importStar(require("jsonwebtoken"));
const firebase_1 = require("../config/firebase");
const constants_1 = require("../config/constants");
const crypto = __importStar(require("crypto"));
const firestore_1 = require("firebase-admin/firestore");
const google_auth_library_1 = require("google-auth-library");
const apple_signin_auth_1 = __importDefault(require("apple-signin-auth"));
class AuthService {
    /**
     * Generate a 6-digit OTP code
     */
    static generateOTP() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }
    /**
     * Generate JWT token
     */
    static generateToken(userId) {
        return jwt.sign({ userId, timestamp: Date.now() }, constants_1.Constants.JWT_SECRET, { expiresIn: constants_1.Constants.JWT_EXPIRES_IN });
    }
    /**
     * Verify JWT token
     */
    static verifyToken(token) {
        try {
            const decoded = jwt.verify(token, constants_1.Constants.JWT_SECRET);
            return { userId: decoded.userId };
        }
        catch (error) {
            throw new Error('Invalid or expired token');
        }
    }
    /**
     * Store OTP in Firestore
     */
    static async storeOTP(identifier, type) {
        const otp = this.generateOTP();
        // DEV MODE: Skip Firestore storage when Twilio is not configured
        if (!constants_1.Constants.TWILIO_ACCOUNT_SID) {
            console.log(`[DEV] Generated OTP for ${identifier}: ${otp} (not stored in Firestore)`);
            return otp;
        }
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + constants_1.Constants.OTP_EXPIRY_MINUTES);
        const otpData = {
            code: otp,
            identifier,
            type,
            expiresAt: firestore_1.Timestamp.fromDate(expiresAt),
            attempts: 0,
            verified: false,
            createdAt: firestore_1.Timestamp.now(),
        };
        // Use identifier as document ID for easy lookup
        const docId = crypto.createHash('md5').update(identifier).digest('hex');
        await firebase_1.db.collection(firebase_1.Collections.OTP_CODES).doc(docId).set(otpData);
        return otp;
    }
    /**
     * Verify OTP code
     */
    static async verifyOTP(identifier, code) {
        // DEV MODE: Accept any 6-digit code when Twilio is not configured
        if (!constants_1.Constants.TWILIO_ACCOUNT_SID) {
            console.log(`[DEV] Accepting any OTP code for ${identifier} (no Firestore validation)`);
            return true;
        }
        const docId = crypto.createHash('md5').update(identifier).digest('hex');
        const otpDoc = await firebase_1.db.collection(firebase_1.Collections.OTP_CODES).doc(docId).get();
        if (!otpDoc.exists) {
            throw new Error('OTP not found or expired');
        }
        const otpData = otpDoc.data();
        // Check if already verified
        if (otpData.verified) {
            throw new Error('OTP already used');
        }
        // Check expiry
        if (otpData.expiresAt.toDate() < new Date()) {
            throw new Error('OTP expired');
        }
        // Check attempts
        if (otpData.attempts >= 3) {
            throw new Error('Too many failed attempts');
        }
        // Verify code
        if (otpData.code !== code) {
            await otpDoc.ref.update({
                attempts: otpData.attempts + 1,
            });
            throw new Error('Invalid OTP');
        }
        // Mark as verified
        await otpDoc.ref.update({
            verified: true,
            verifiedAt: firestore_1.Timestamp.now(),
        });
        return true;
    }
    /**
     * Create or get user
     */
    static async createOrGetUser(identifier, type, authProvider = 'phone', providerId) {
        // Search for existing user
        const usersRef = firebase_1.db.collection(firebase_1.Collections.USERS);
        const field = type === 'phone' ? 'phone' : 'email';
        const query = await usersRef.where(field, '==', identifier).limit(1).get();
        if (!query.empty) {
            const doc = query.docs[0];
            console.log(`[AUTH] Found existing user ${doc.id} for ${identifier}`);
            return { id: doc.id, ...doc.data() };
        }
        // Create new user
        console.log(`[AUTH] Creating new user for ${identifier}`);
        const newUser = {
            [field]: identifier,
            authProvider,
            providerId,
            createdAt: firestore_1.Timestamp.now(),
            updatedAt: firestore_1.Timestamp.now(),
            isActive: true,
            isVerified: authProvider !== 'phone', // OAuth users are auto-verified
            subscription: {
                status: 'trial',
                trialEventUsed: false,
                createdAt: firestore_1.Timestamp.now(),
            },
            preferences: {
                notifications: {
                    push: true,
                    email: true,
                    sms: true,
                },
                privacy: {
                    showProfile: true,
                    showLocation: true,
                },
            },
        };
        const userDoc = await usersRef.add(newUser);
        console.log(`[AUTH] Created new user with ID: ${userDoc.id}`);
        return { id: userDoc.id, ...newUser };
    }
    /**
     * Send OTP via SMS (Twilio)
     */
    static async sendSMS(phone, otp) {
        if (!constants_1.Constants.TWILIO_ACCOUNT_SID) {
            console.log(`[DEV] SMS OTP to ${phone}: ${otp}`);
            return;
        }
        try {
            console.log(`[SMS] Sending OTP to ${phone}...`);
            const client = require('twilio')(constants_1.Constants.TWILIO_ACCOUNT_SID, constants_1.Constants.TWILIO_AUTH_TOKEN);
            const message = await client.messages.create({
                body: `Your Cosmo verification code is: ${otp}. Valid for ${constants_1.Constants.OTP_EXPIRY_MINUTES} minutes.`,
                from: constants_1.Constants.TWILIO_PHONE_NUMBER,
                to: phone,
            });
            console.log(`[SMS] Message sent successfully: ${message.sid}`);
        }
        catch (error) {
            console.error('[SMS] Failed to send SMS:', error);
            console.error('[SMS] Error details:', error.message);
            throw new Error('Failed to send verification code');
        }
    }
    /**
     * Send OTP via Email (SendGrid)
     */
    static async sendEmail(email, otp) {
        if (!constants_1.Constants.SENDGRID_API_KEY) {
            console.log(`[DEV] Email OTP to ${email}: ${otp}`);
            return;
        }
        try {
            const sgMail = require('@sendgrid/mail');
            sgMail.setApiKey(constants_1.Constants.SENDGRID_API_KEY);
            const msg = {
                to: email,
                from: constants_1.Constants.SENDGRID_FROM_EMAIL,
                subject: 'Your Cosmo Verification Code',
                html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #FF6B6B;">Welcome to Cosmo!</h2>
            <p>Your verification code is:</p>
            <h1 style="color: #FF6B6B; font-size: 36px; letter-spacing: 5px;">${otp}</h1>
            <p>This code will expire in ${constants_1.Constants.OTP_EXPIRY_MINUTES} minutes.</p>
            <p>If you didn't request this code, please ignore this email.</p>
          </div>
        `,
            };
            await sgMail.send(msg);
        }
        catch (error) {
            console.error('Failed to send email:', error);
            throw new Error('Failed to send verification code');
        }
    }
    /**
     * Verify Google ID token
     */
    static async verifyGoogleToken(idToken) {
        try {
            const client = new google_auth_library_1.OAuth2Client();
            // Accept both Web and iOS client IDs
            const audiences = [
                process.env.GOOGLE_CLIENT_ID, // Web client ID
                process.env.GOOGLE_IOS_CLIENT_ID, // iOS client ID
            ].filter(Boolean);
            console.log('[GOOGLE AUTH] Expected audiences:', audiences);
            // First decode without verification to see the actual audience
            const decodedToken = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64').toString());
            console.log('[GOOGLE AUTH] Token audience (aud):', decodedToken.aud);
            console.log('[GOOGLE AUTH] Token issuer (iss):', decodedToken.iss);
            const ticket = await client.verifyIdToken({
                idToken,
                audience: audiences,
            });
            const payload = ticket.getPayload();
            if (!payload || !payload.email) {
                throw new Error('Invalid Google token');
            }
            return {
                email: payload.email,
                name: payload.name,
                providerId: payload.sub,
            };
        }
        catch (error) {
            console.error('Google token verification failed:', error);
            throw new Error('Failed to verify Google token');
        }
    }
    /**
     * Verify Apple ID token
     */
    static async verifyAppleToken(identityToken) {
        try {
            const appleData = await apple_signin_auth_1.default.verifyIdToken(identityToken, {
                audience: process.env.APPLE_CLIENT_ID || '',
                ignoreExpiration: false,
            });
            if (!appleData.email) {
                throw new Error('Invalid Apple token');
            }
            return {
                email: appleData.email,
                name: undefined, // Apple may not provide name
                providerId: appleData.sub,
            };
        }
        catch (error) {
            console.error('Apple token verification failed:', error);
            throw new Error('Failed to verify Apple token');
        }
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=auth.service.js.map