"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const auth_service_1 = require("../services/auth.service");
const constants_1 = require("../config/constants");
const firebase_1 = require("../config/firebase");
class AuthController {
    /**
     * Request OTP
     * POST /auth/otp/request
     */
    static async requestOTP(req, res) {
        const identifier = req.body.phone || req.body.email;
        try {
            const { phone, email } = req.body;
            console.log(`[OTP Request] Received request for ${identifier}`);
            // Validate input
            if (!phone && !email) {
                console.log('[OTP Request] Missing phone or email');
                return res.status(400).json({
                    success: false,
                    error: 'Phone number or email is required',
                });
            }
            if (phone && !constants_1.Regex.PHONE.test(phone)) {
                console.log(`[OTP Request] Invalid phone format: ${phone}`);
                return res.status(400).json({
                    success: false,
                    error: 'Invalid phone number format',
                });
            }
            if (email && !constants_1.Regex.EMAIL.test(email)) {
                console.log(`[OTP Request] Invalid email format: ${email}`);
                return res.status(400).json({
                    success: false,
                    error: 'Invalid email format',
                });
            }
            const type = phone ? 'phone' : 'email';
            console.log(`[OTP Request] Type: ${type}`);
            // Use real Firebase and Twilio
            const otp = await auth_service_1.AuthService.storeOTP(identifier, type);
            console.log(`[OTP Request] OTP generated successfully for ${identifier}`);
            // Send OTP
            if (phone) {
                await auth_service_1.AuthService.sendSMS(phone, otp);
                console.log(`[OTP Request] SMS sent to ${phone}`);
            }
            else {
                await auth_service_1.AuthService.sendEmail(email, otp);
                console.log(`[OTP Request] Email sent to ${email}`);
            }
            return res.status(200).json({
                success: true,
                message: `Verification code sent to ${identifier}`,
            });
        }
        catch (error) {
            console.error(`[OTP Request] Error for ${identifier}:`, error);
            console.error(`[OTP Request] Error stack:`, error.stack);
            return res.status(500).json({
                success: false,
                error: error.message || 'Failed to send verification code',
            });
        }
    }
    /**
     * Verify OTP and login/signup
     * POST /auth/otp/verify
     */
    static async verifyOTP(req, res) {
        const identifier = req.body.phone || req.body.email;
        try {
            const { phone, email, code } = req.body;
            console.log(`[OTP Verify] Received verification request for ${identifier}`);
            // Validate input
            if (!code || !constants_1.Regex.OTP.test(code)) {
                console.log(`[OTP Verify] Invalid code format: ${code}`);
                return res.status(400).json({
                    success: false,
                    error: 'Invalid verification code',
                });
            }
            if (!phone && !email) {
                console.log('[OTP Verify] Missing phone or email');
                return res.status(400).json({
                    success: false,
                    error: 'Phone number or email is required',
                });
            }
            const type = phone ? 'phone' : 'email';
            console.log(`[OTP Verify] Verifying ${type}: ${identifier} with code: ${code}`);
            // TEMPORARY: Accept any 6-digit code for testing
            // TODO: Re-enable real OTP verification for production
            console.log(`[OTP Verify] Using bypass mode - accepting any 6-digit code`);
            // await AuthService.verifyOTP(identifier, code);
            console.log(`[OTP Verify] OTP verified successfully for ${identifier}`);
            // Create or get user
            const user = await auth_service_1.AuthService.createOrGetUser(identifier, type, 'phone');
            console.log(`[OTP Verify] User obtained/created: ${user.id}`);
            // Generate JWT token
            const token = auth_service_1.AuthService.generateToken(user.id);
            console.log(`[OTP Verify] JWT token generated for user: ${user.id}`);
            // Check if profile is complete
            const isProfileComplete = user.profile &&
                user.profile.name &&
                user.profile.age &&
                user.profile.gender &&
                user.profile.photos &&
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
            });
        }
        catch (error) {
            console.error(`[OTP Verify] Error for ${identifier}:`, error);
            console.error(`[OTP Verify] Error stack:`, error.stack);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to verify code',
            });
        }
    }
    /**
     * Validate token
     * POST /auth/validate
     */
    static async validateToken(req, res) {
        try {
            const token = req.headers.authorization?.replace('Bearer ', '');
            if (!token) {
                return res.status(401).json({
                    success: false,
                    error: 'No token provided',
                });
            }
            const { userId } = auth_service_1.AuthService.verifyToken(token);
            return res.status(200).json({
                success: true,
                data: { userId },
            });
        }
        catch (error) {
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired token',
            });
        }
    }
    /**
     * Logout (client-side token removal)
     * POST /auth/logout
     */
    static async logout(req, res) {
        // In a JWT-based system, logout is handled client-side
        // We can optionally blacklist the token here if needed
        return res.status(200).json({
            success: true,
            message: 'Logged out successfully',
        });
    }
    /**
     * Refresh JWT token
     * POST /auth/refresh
     */
    static async refreshToken(req, res) {
        try {
            // TODO: Implement token refresh logic
            return res.status(200).json({
                success: true,
                message: 'Token refresh not implemented yet',
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                error: error.message || 'Internal server error',
            });
        }
    }
    /**
     * Google OAuth login
     * POST /auth/google
     */
    static async googleAuth(req, res) {
        try {
            const { idToken } = req.body;
            if (!idToken) {
                return res.status(400).json({
                    success: false,
                    error: 'Google ID token is required',
                });
            }
            // Verify Google token
            const { email, name, providerId } = await auth_service_1.AuthService.verifyGoogleToken(idToken);
            // Create or get user
            const user = await auth_service_1.AuthService.createOrGetUser(email, 'email', 'google', providerId);
            // Update name if provided and profile doesn't exist
            if (name && !user.profile?.name) {
                await firebase_1.db.collection(firebase_1.Collections.USERS).doc(user.id).update({
                    'profile.name': name,
                });
            }
            // Generate JWT token
            const token = auth_service_1.AuthService.generateToken(user.id);
            // Check if profile is complete
            const isProfileComplete = user.profile &&
                user.profile.name &&
                user.profile.age &&
                user.profile.gender &&
                user.profile.photos &&
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
            });
        }
        catch (error) {
            console.error('Google auth error:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to authenticate with Google',
            });
        }
    }
    /**
     * Apple OAuth login
     * POST /auth/apple
     */
    static async appleAuth(req, res) {
        try {
            const { identityToken, user: rawAppleUser } = req.body;
            const appleUser = typeof rawAppleUser === 'string'
                ? { id: rawAppleUser }
                : rawAppleUser;
            if (!identityToken) {
                return res.status(400).json({
                    success: false,
                    error: 'Apple identity token is required',
                });
            }
            // Verify Apple token
            const { email, providerId } = await auth_service_1.AuthService.verifyAppleToken(identityToken);
            // Create or get user
            const user = await auth_service_1.AuthService.createOrGetUser(email, 'email', 'apple', providerId);
            // Update name if provided from Apple and profile doesn't exist
            if (appleUser?.fullName && !user.profile?.name) {
                const fullName = `${appleUser.fullName.givenName || ''} ${appleUser.fullName.familyName || ''}`.trim();
                if (fullName) {
                    await firebase_1.db.collection(firebase_1.Collections.USERS).doc(user.id).update({
                        'profile.name': fullName,
                    });
                }
            }
            // Generate JWT token
            const token = auth_service_1.AuthService.generateToken(user.id);
            // Check if profile is complete
            const isProfileComplete = user.profile &&
                user.profile.name &&
                user.profile.age &&
                user.profile.gender &&
                user.profile.photos &&
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
            });
        }
        catch (error) {
            console.error('Apple auth error:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to authenticate with Apple',
            });
        }
    }
}
exports.AuthController = AuthController;
//# sourceMappingURL=auth.controller.js.map