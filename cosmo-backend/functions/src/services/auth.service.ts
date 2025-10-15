import * as jwt from 'jsonwebtoken';
import { db, Collections } from '../config/firebase';
import { Constants } from '../config/constants';
import { User, OTPCode } from '../types';
import * as crypto from 'crypto';
import { Timestamp } from 'firebase-admin/firestore';

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
  static async createOrGetUser(identifier: string, type: 'phone' | 'email'): Promise<User> {
    // Search for existing user
    const usersRef = db.collection(Collections.USERS);
    const field = type === 'phone' ? 'phone' : 'email';
    const query = await usersRef.where(field, '==', identifier).limit(1).get();

    if (!query.empty) {
      const doc = query.docs[0];
      return { id: doc.id, ...doc.data() } as User;
    }

    // Create new user
    const newUser: Partial<User> = {
      [field]: identifier,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      isActive: true,
      isVerified: false,
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
      const client = require('twilio')(
        Constants.TWILIO_ACCOUNT_SID,
        Constants.TWILIO_AUTH_TOKEN
      );

      await client.messages.create({
        body: `Your Cosmo verification code is: ${otp}. Valid for ${Constants.OTP_EXPIRY_MINUTES} minutes.`,
        from: Constants.TWILIO_PHONE_NUMBER,
        to: phone,
      });
    } catch (error) {
      console.error('Failed to send SMS:', error);
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
}