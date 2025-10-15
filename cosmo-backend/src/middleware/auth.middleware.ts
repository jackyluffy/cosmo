import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { db, Collections } from '../config/firebase';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      user?: any;
    }
  }
}

/**
 * Verify JWT token middleware
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    // Verify token
    const { userId } = AuthService.verifyToken(token);

    // Get user from database
    const userDoc = await db.collection(Collections.USERS).doc(userId).get();

    if (!userDoc.exists) {
      return res.status(401).json({
        success: false,
        error: 'User not found',
      });
    }

    const userData = userDoc.data();

    if (!userData?.isActive) {
      return res.status(403).json({
        success: false,
        error: 'Account is deactivated',
      });
    }

    // Attach user to request
    req.userId = userId;
    req.user = { id: userId, ...userData };

    console.log('[Auth Middleware] User location:', {
      location: req.user?.profile?.location,
      locationType: req.user?.profile?.location?.constructor?.name,
      hasLatitude: req.user?.profile?.location?._latitude !== undefined,
      hasLat: req.user?.profile?.location?.lat !== undefined,
    });

    // Update last active
    userDoc.ref.update({
      lastActive: new Date(),
    });

    next();
  } catch (error: any) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
    });
  }
};

/**
 * Check if user has completed profile
 */
export const requireCompleteProfile = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // In dev mode, only check for basic profile info (not photos)
  const isDev = process.env.NODE_ENV === 'development';

  console.log('[requireCompleteProfile] isDev:', isDev);
  console.log('[requireCompleteProfile] user profile:', {
    name: req.user?.profile?.name,
    age: req.user?.profile?.age,
    gender: req.user?.profile?.gender,
    photosLength: req.user?.profile?.photos?.length,
  });

  if (!req.user?.profile?.name ||
      !req.user?.profile?.age ||
      !req.user?.profile?.gender ||
      (!isDev && req.user?.profile?.photos?.length === 0)) {
    console.log('[requireCompleteProfile] Profile incomplete - returning 403');
    return res.status(403).json({
      success: false,
      error: 'Please complete your profile first',
    });
  }
  console.log('[requireCompleteProfile] Profile complete - allowing access');
  next();
};

/**
 * Check if user has active subscription
 */
export const requireActiveSubscription = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const subscription = req.user?.subscription;

  if (!subscription ||
      (subscription.status !== 'active' && subscription.status !== 'trial')) {
    return res.status(403).json({
      success: false,
      error: 'Active subscription required',
    });
  }

  // Check if trial user has already used their free event
  if (subscription.status === 'trial' && subscription.trialEventUsed) {
    return res.status(403).json({
      success: false,
      error: 'Trial event already used. Please upgrade to continue.',
    });
  }

  next();
};

/**
 * Check if user is admin
 */
export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user?.roles?.includes('admin')) {
    res.status(403).json({
      success: false,
      error: 'Admin access required',
    });
    return;
  }
  next();
};