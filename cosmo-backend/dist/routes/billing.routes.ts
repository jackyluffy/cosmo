import { Router } from 'express';
import { validateRequest } from '../middleware/validation.middleware';
import Joi from 'joi';

const router = Router();

// Billing Controller
const BillingController = {
  getSubscriptionStatus: async (req: any, res: any) => {
    try {
      const userId = req.user.uid;

      // TODO: Fetch subscription from Firestore
      res.json({
        success: true,
        subscription: {
          status: 'trial',
          trial_event_used: false,
          expires_at: null,
          plan: null,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },

  createCheckoutSession: async (req: any, res: any) => {
    try {
      const { plan, returnUrl } = req.body;
      const userId = req.user.uid;

      // TODO: Create Stripe checkout session
      const checkoutUrl = `https://checkout.stripe.com/pay/test_session_${Date.now()}`;

      res.json({
        success: true,
        checkoutUrl,
        sessionId: 'cs_test_' + Date.now(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },

  createCustomerPortal: async (req: any, res: any) => {
    try {
      const userId = req.user.uid;
      const { returnUrl } = req.body;

      // TODO: Create Stripe customer portal session
      const portalUrl = `https://billing.stripe.com/session/test_portal_${Date.now()}`;

      res.json({
        success: true,
        portalUrl,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },

  cancelSubscription: async (req: any, res: any) => {
    try {
      const userId = req.user.uid;

      // TODO: Cancel subscription in Stripe and update Firestore
      res.json({
        success: true,
        message: 'Subscription cancelled successfully',
        endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },

  getPaymentHistory: async (req: any, res: any) => {
    try {
      const userId = req.user.uid;
      const { limit = 10 } = req.query;

      // TODO: Fetch payment history from Stripe
      res.json({
        success: true,
        payments: [],
        hasMore: false,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
};

// Validation schemas
const createCheckoutSchema = Joi.object({
  plan: Joi.string().valid('basic', 'premium').required(),
  returnUrl: Joi.string().uri(),
});

const createPortalSchema = Joi.object({
  returnUrl: Joi.string().uri().required(),
});

const paymentHistorySchema = Joi.object({
  limit: Joi.number().min(1).max(100).default(10),
  starting_after: Joi.string(),
});

// Routes
router.get('/subscription', BillingController.getSubscriptionStatus);

router.post(
  '/checkout',
  validateRequest(createCheckoutSchema),
  BillingController.createCheckoutSession
);

router.post(
  '/portal',
  validateRequest(createPortalSchema),
  BillingController.createCustomerPortal
);

router.post('/cancel', BillingController.cancelSubscription);

router.get(
  '/history',
  validateRequest(paymentHistorySchema, 'query'),
  BillingController.getPaymentHistory
);

export const billingRoutes = router;