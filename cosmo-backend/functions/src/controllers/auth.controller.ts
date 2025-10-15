import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { ApiResponse, AuthRequest, VerifyOTPRequest } from '../types';
import { Regex } from '../config/constants';

export class AuthController {
  /**
   * Request OTP
   * POST /auth/otp/request
   */
  static async requestOTP(req: Request, res: Response) {
    try {
      const { phone, email }: AuthRequest = req.body;

      // Validate input
      if (!phone && !email) {
        return res.status(400).json({
          success: false,
          error: 'Phone number or email is required',
        } as ApiResponse);
      }

      if (phone && !Regex.PHONE.test(phone)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid phone number format',
        } as ApiResponse);
      }

      if (email && !Regex.EMAIL.test(email)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid email format',
        } as ApiResponse);
      }

      // Generate and store OTP
      const identifier = phone || email!;
      const type = phone ? 'phone' : 'email';
      const otp = await AuthService.storeOTP(identifier, type);

      // Send OTP
      if (phone) {
        await AuthService.sendSMS(phone, otp);
      } else {
        await AuthService.sendEmail(email!, otp);
      }

      return res.status(200).json({
        success: true,
        message: `Verification code sent to ${identifier}`,
      } as ApiResponse);
    } catch (error: any) {
      console.error('Request OTP error:', error);
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
    try {
      const { phone, email, code }: VerifyOTPRequest = req.body;

      // Validate input
      if (!code || !Regex.OTP.test(code)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid verification code',
        } as ApiResponse);
      }

      if (!phone && !email) {
        return res.status(400).json({
          success: false,
          error: 'Phone number or email is required',
        } as ApiResponse);
      }

      const identifier = phone || email!;
      const type = phone ? 'phone' : 'email';

      // Verify OTP
      await AuthService.verifyOTP(identifier, code);

      // Create or get user
      const user = await AuthService.createOrGetUser(identifier, type);

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
      console.error('Verify OTP error:', error);
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
}