import { User } from '../types';
export declare class AuthService {
    /**
     * Generate a 6-digit OTP code
     */
    static generateOTP(): string;
    /**
     * Generate JWT token
     */
    static generateToken(userId: string): string;
    /**
     * Verify JWT token
     */
    static verifyToken(token: string): {
        userId: string;
    };
    /**
     * Store OTP in Firestore
     */
    static storeOTP(identifier: string, type: 'phone' | 'email'): Promise<string>;
    /**
     * Verify OTP code
     */
    static verifyOTP(identifier: string, code: string): Promise<boolean>;
    /**
     * Create or get user
     */
    static createOrGetUser(identifier: string, type: 'phone' | 'email'): Promise<User>;
    /**
     * Send OTP via SMS (Twilio)
     */
    static sendSMS(phone: string, otp: string): Promise<void>;
    /**
     * Send OTP via Email (SendGrid)
     */
    static sendEmail(email: string, otp: string): Promise<void>;
}
//# sourceMappingURL=auth.service.d.ts.map