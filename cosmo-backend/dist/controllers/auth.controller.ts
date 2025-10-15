import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { ApiResponse, AuthRequest, VerifyOTPRequest } from '../types';
import { Regex } from '../config/constants';
import { db, Collections } from '../config/firebase';

export class AuthController {
  /**
   * Request OTP
   * POST /auth/otp/request
   */
  static async requestOTP(req: Request, res: Response) {
    const identifier = req.body.phone || req.body.email;

    try {
      const { phone, email }: AuthRequest = req.body;
      console.log(`[OTP Request] Received request for ${identifier}`);

      // Validate input
      if (!phone && !email) {
        console.log('[OTP Request] Missing phone or email');
        return res.status(400).json({
          success: false,
          error: 'Phone number or email is required',
        } as ApiResponse);
      }

      if (phone && !Regex.PHONE.test(phone)) {
        console.log(`[OTP Request] Invalid phone format: ${phone}`);
        return res.status(400).json({
          success: false,
          error: 'Invalid phone number format',
        } as ApiResponse);
      }

      if (email && !Regex.EMAIL.test(email)) {
        console.log(`[OTP Request] Invalid email format: ${email}`);
        return res.status(400).json({
          success: false,
          error: 'Invalid email format',
        } as ApiResponse);
      }

      const type = phone ? 'phone' : 'email';
      console.log(`[OTP Request] Type: ${type}`);

      // Use real Firebase and Twilio
      const otp = await AuthService.storeOTP(identifier, type);
      console.log(`[OTP Request] OTP generated successfully for ${identifier}`);

      // Send OTP
      if (phone) {
        await AuthService.sendSMS(phone, otp);
        console.log(`[OTP Request] SMS sent to ${phone}`);
      } else {
        await AuthService.sendEmail(email!, otp);
        console.log(`[OTP Request] Email sent to ${email}`);
      }

      return res.status(200).json({
        success: true,
        message: `Verification code sent to ${identifier}`,
      } as ApiResponse);
    } catch (error: any) {
      console.error(`[OTP Request] Error for ${identifier}:`, error);
      console.error(`[OTP Request] Error stack:`, error.stack);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to send verification code',
      } as ApiResponse);
    }
  }

  /**
   * Verify OTP and login/signup
   * POST /auth/otp/verify
   */
  static async verifyOTP(req: Request, res: Response) {
    const identifier = req.body.phone || req.body.email;

    try {
      const { phone, email, code }: VerifyOTPRequest = req.body;
      console.log(`[OTP Verify] Received verification request for ${identifier}`);

      // Validate input
      if (!code || !Regex.OTP.test(code)) {
        console.log(`[OTP Verify] Invalid code format: ${code}`);
        return res.status(400).json({
          success: false,
          error: 'Invalid verification code',
        } as ApiResponse);
      }

      if (!phone && !email) {
        console.log('[OTP Verify] Missing phone or email');
        return res.status(400).json({
          success: false,
          error: 'Phone number or email is required',
        } as ApiResponse);
      }

      const type = phone ? 'phone' : 'email';
      console.log(`[OTP Verify] Verifying ${type}: ${identifier} with code: ${code}`);

      // Use real Firebase auth
      await AuthService.verifyOTP(identifier, code);
      console.log(`[OTP Verify] OTP verified successfully for ${identifier}`);

      // Create or get user
      const user = await AuthService.createOrGetUser(identifier, type, 'phone');
      console.log(`[OTP Verify] User obtained/created: ${user.id}`);

      // Generate JWT token
      const token = AuthService.generateToken(user.id);
      console.log(`[OTP Verify] JWT token generated for user: ${user.id}`);

      // Check if profile is complete
      const isProfileComplete = user.profile &&
        user.profile.name &&
        user.profile.age &&
        user.profile.gender &&
        user.profile.photos.length > 0;

      console.log(`[OTP Verify] Profile complete: ${isProfileComplete}`);

      return res.status(200).json({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            phone: user.phone,
            email: user.email,
            profile: user.profile,
            subscription: user.subscription,
            isProfileComplete,
          },
        },
        message: 'Successfully authenticated',
      } as ApiResponse);
    } catch (error: any) {
      console.error(`[OTP Verify] Error for ${identifier}:`, error);
      console.error(`[OTP Verify] Error stack:`, error.stack);
      return res.status(400).json({
        success: false,
        error: error.message || 'Failed to verify code',
      } as ApiResponse);
    }
  }

  /**
   * Validate token
   * POST /auth/validate
   */
  static async validateToken(req: Request, res: Response) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return res.status(401).json({
          success: false,
          error: 'No token provided',
        } as ApiResponse);
      }

      const { userId } = AuthService.verifyToken(token);

      return res.status(200).json({
        success: true,
        data: { userId },
      } as ApiResponse);
    } catch (error: any) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
      } as ApiResponse);
    }
  }

  /**
   * Logout (client-side token removal)
   * POST /auth/logout
   */
  static async logout(req: Request, res: Response) {
    // In a JWT-based system, logout is handled client-side
    // We can optionally blacklist the token here if needed
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    } as ApiResponse);
  }

  /**
   * Refresh JWT token
   * POST /auth/refresh
   */
  static async refreshToken(req: Request, res: Response) {
    try {
      // TODO: Implement token refresh logic
      return res.status(200).json({
        success: true,
        message: 'Token refresh not implemented yet',
      } as ApiResponse);
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message || 'Internal server error',
      } as ApiResponse);
    }
  }

  /**
   * Google OAuth login
   * POST /auth/google
   */
  static async googleAuth(req: Request, res: Response) {
    try {
      const { idToken } = req.body;

      if (!idToken) {
        return res.status(400).json({
          success: false,
          error: 'Google ID token is required',
        } as ApiResponse);
      }

      // Verify Google token
      const { email, name, providerId } = await AuthService.verifyGoogleToken(idToken);

      // Create or get user
      const user = await AuthService.createOrGetUser(email, 'email', 'google', providerId);

      // Update name if provided and profile doesn't exist
      if (name && !user.profile?.name) {
        await db.collection(Collections.USERS).doc(user.id).update({
          'profile.name': name,
        });
      }

      // Generate JWT token
      const token = AuthService.generateToken(user.id);

      // Check if profile is complete
      const isProfileComplete = user.profile &&
        user.profile.name &&
        user.profile.age &&
        user.profile.gender &&
        user.profile.photos.length > 0;

      return res.status(200).json({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            profile: user.profile,
            subscription: user.subscription,
            isProfileComplete,
          },
        },
        message: 'Successfully authenticated with Google',
      } as ApiResponse);
    } catch (error: any) {
      console.error('Google auth error:', error);
      return res.status(400).json({
        success: false,
        error: error.message || 'Failed to authenticate with Google',
      } as ApiResponse);
    }
  }

  /**
   * Apple OAuth login
   * POST /auth/apple
   */
  static async appleAuth(req: Request, res: Response) {
    try {
      const { identityToken, user: appleUser } = req.body;

      if (!identityToken) {
        return res.status(400).json({
          success: false,
          error: 'Apple identity token is required',
        } as ApiResponse);
      }

      // Verify Apple token
      const { email, providerId } = await AuthService.verifyAppleToken(identityToken);

      // Create or get user
      const user = await AuthService.createOrGetUser(email, 'email', 'apple', providerId);

      // Update name if provided from Apple and profile doesn't exist
      if (appleUser?.fullName && !user.profile?.name) {
        const fullName = `${appleUser.fullName.givenName || ''} ${appleUser.fullName.familyName || ''}`.trim();
        if (fullName) {
          await db.collection(Collections.USERS).doc(user.id).update({
            'profile.name': fullName,
          });
        }
      }

      // Generate JWT token
      const token = AuthService.generateToken(user.id);

      // Check if profile is complete
      const isProfileComplete = user.profile &&
        user.profile.name &&
        user.profile.age &&
        user.profile.gender &&
        user.profile.photos.length > 0;

      return res.status(200).json({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            profile: user.profile,
            subscription: user.subscription,
            isProfileComplete,
          },
        },
        message: 'Successfully authenticated with Apple',
      } as ApiResponse);
    } catch (error: any) {
      console.error('Apple auth error:', error);
      return res.status(400).json({
        success: false,
        error: error.message || 'Failed to authenticate with Apple',
      } as ApiResponse);
    }
  }
}