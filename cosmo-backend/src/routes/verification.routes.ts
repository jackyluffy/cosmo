import { Router } from 'express';
import { VerificationController } from '../controllers/verification.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const verificationController = new VerificationController();

// All routes require authentication
router.use(authenticate);

// Verify selfie against profile photos
router.post('/verify-selfie', verificationController.verifySelfie.bind(verificationController));

// Get verification status
router.get('/status', verificationController.getVerificationStatus.bind(verificationController));

export default router;
