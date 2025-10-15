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
  if (!req.user?.profile?.name ||
      !req.user?.profile?.age ||
      !req.user?.profile?.gender ||
      req.user?.profile?.photos?.length === 0) {
    return res.status(403).json({
      success: false,
      error: 'Please complete your profile first',
    });
  }
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