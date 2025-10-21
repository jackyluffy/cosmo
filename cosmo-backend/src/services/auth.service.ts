import * as jwt from 'jsonwebtoken';
import { db, Collections } from '../config/firebase';
import { Constants } from '../config/constants';
import { User, OTPCode } from '../types';
import * as crypto from 'crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { OAuth2Client } from 'google-auth-library';
import appleSignin from 'apple-signin-auth';

export class AuthService {
  /**
   * Generate a 6-digit OTP code
   */
  static generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Generate JWT token
   */
  static generateToken(userId: string): string {
    return jwt.sign(
      { userId, timestamp: Date.now() },
      Constants.JWT_SECRET,
      { expiresIn: Constants.JWT_EXPIRES_IN }
    );
  }

  /**
   * Verify JWT token
   */
  static verifyToken(token: string): { userId: string } {
    try {
      const decoded = jwt.verify(token, Constants.JWT_SECRET) as any;
      return { userId: decoded.userId };
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Store OTP in Firestore
   */
  static async storeOTP(identifier: string, type: 'phone' | 'email'): Promise<string> {
    const otp = this.generateOTP();

    // DEV MODE: Skip Firestore storage when Twilio is not configured
    if (!Constants.TWILIO_ACCOUNT_SID) {
      console.log(`[DEV] Generated OTP for ${identifier}: ${otp} (not stored in Firestore)`);
      return otp;
    }

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + Constants.OTP_EXPIRY_MINUTES);

    const otpData: OTPCode = {
      code: otp,
      identifier,
      type,
      expiresAt: Timestamp.fromDate(expiresAt),
      attempts: 0,
      verified: false,
      createdAt: Timestamp.now(),
    };

    // Use identifier as document ID for easy lookup
    const docId = crypto.createHash('md5').update(identifier).digest('hex');
    await db.collection(Collections.OTP_CODES).doc(docId).set(otpData);

    return otp;
  }

  /**
   * Verify OTP code
   */
  static async verifyOTP(identifier: string, code: string): Promise<boolean> {
    // DEV MODE: Accept any 6-digit code when Twilio is not configured
    if (!Constants.TWILIO_ACCOUNT_SID) {
      console.log(`[DEV] Accepting any OTP code for ${identifier} (no Firestore validation)`);
      return true;
    }

    const docId = crypto.createHash('md5').update(identifier).digest('hex');
    const otpDoc = await db.collection(Collections.OTP_CODES).doc(docId).get();

    if (!otpDoc.exists) {
      throw new Error('OTP not found or expired');
    }

    const otpData = otpDoc.data() as OTPCode;

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
      verifiedAt: Timestamp.now(),
    });

    return true;
  }

  /**
   * Create or get user
   */
  static async createOrGetUser(identifier: string, type: 'phone' | 'email', authProvider: 'phone' | 'google' | 'facebook' | 'apple' = 'phone', providerId?: string): Promise<User> {
    // Search for existing user
    const usersRef = db.collection(Collections.USERS);
    const field = type === 'phone' ? 'phone' : 'email';
    const query = await usersRef.where(field, '==', identifier).limit(1).get();

    if (!query.empty) {
      const doc = query.docs[0];
      console.log(`[AUTH] Found existing user ${doc.id} for ${identifier}`);
      return { id: doc.id, ...doc.data() } as User;
    }

    // Create new user
    console.log(`[AUTH] Creating new user for ${identifier}`);
    const newUser: Partial<User> = {
      [field]: identifier,
      authProvider,
      providerId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      isActive: true,
      isVerified: authProvider !== 'phone', // OAuth users are auto-verified
      subscription: {
        status: 'trial',
        trialEventUsed: false,
        createdAt: Timestamp.now(),
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
    return { id: userDoc.id, ...newUser } as User;
  }

  /**
   * Send OTP via SMS (Twilio)
   */
  static async sendSMS(phone: string, otp: string): Promise<void> {
    if (!Constants.TWILIO_ACCOUNT_SID) {
      console.log(`[DEV] SMS OTP to ${phone}: ${otp}`);
      return;
    }

    try {
      console.log(`[SMS] Sending OTP to ${phone}...`);
      const client = require('twilio')(
        Constants.TWILIO_ACCOUNT_SID,
        Constants.TWILIO_AUTH_TOKEN
      );

      const message = await client.messages.create({
        body: `Your Cosmo verification code is: ${otp}. Valid for ${Constants.OTP_EXPIRY_MINUTES} minutes.`,
        from: Constants.TWILIO_PHONE_NUMBER,
        to: phone,
      });

      console.log(`[SMS] Message sent successfully: ${message.sid}`);
    } catch (error: any) {
      console.error('[SMS] Failed to send SMS:', error);
      console.error('[SMS] Error details:', error.message);
      throw new Error('Failed to send verification code');
    }
  }

  /**
   * Send OTP via Email (SendGrid)
   */
  static async sendEmail(email: string, otp: string): Promise<void> {
    if (!Constants.SENDGRID_API_KEY) {
      console.log(`[DEV] Email OTP to ${email}: ${otp}`);
      return;
    }

    try {
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(Constants.SENDGRID_API_KEY);

      const msg = {
        to: email,
        from: Constants.SENDGRID_FROM_EMAIL,
        subject: 'Your Cosmo Verification Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #FF6B6B;">Welcome to Cosmo!</h2>
            <p>Your verification code is:</p>
            <h1 style="color: #FF6B6B; font-size: 36px; letter-spacing: 5px;">${otp}</h1>
            <p>This code will expire in ${Constants.OTP_EXPIRY_MINUTES} minutes.</p>
            <p>If you didn't request this code, please ignore this email.</p>
          </div>
        `,
      };

      await sgMail.send(msg);
    } catch (error) {
      console.error('Failed to send email:', error);
      throw new Error('Failed to send verification code');
    }
  }

  /**
   * Verify Google ID token
   */
  static async verifyGoogleToken(idToken: string): Promise<{ email: string; name?: string; providerId: string }> {
    try {
      const client = new OAuth2Client();
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
    } catch (error) {
      console.error('Google token verification failed:', error);
      throw new Error('Failed to verify Google token');
    }
  }

  /**
   * Verify Apple ID token
   */
  static async verifyAppleToken(identityToken: string): Promise<{ email: string; name?: string; providerId: string }> {
    try {
      // TEMPORARY: Bypass Apple token verification for testing
      // TODO: Re-enable real Apple token verification for production
      console.log('[Apple Auth] Using bypass mode - skipping token verification');

      // Decode the JWT to extract email without verification
      const tokenParts = identityToken.split('.');
      if (tokenParts.length === 3) {
        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
        const email = payload.email || `apple_${payload.sub}@privaterelay.appleid.com`;

        console.log('[Apple Auth] Extracted email from token:', email);

        return {
          email: email,
          name: undefined,
          providerId: payload.sub || `apple_${Date.now()}`,
        };
      }

      // Fallback if token parsing fails
      console.log('[Apple Auth] Token parsing failed, using fallback email');
      return {
        email: `apple_user_${Date.now()}@test.com`,
        name: undefined,
        providerId: `apple_${Date.now()}`,
      };
    } catch (error) {
      console.error('Apple token verification failed:', error);
      // Return a test user instead of throwing
      return {
        email: `apple_user_${Date.now()}@test.com`,
        name: undefined,
        providerId: `apple_${Date.now()}`,
      };
    }
  }
}