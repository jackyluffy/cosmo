"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const verification_controller_1 = require("../controllers/verification.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
const verificationController = new verification_controller_1.VerificationController();
// All routes require authentication
router.use(auth_middleware_1.authenticate);
// Verify selfie against profile photos
router.post('/verify-selfie', verificationController.verifySelfie.bind(verificationController));
// Get verification status
router.get('/status', verificationController.getVerificationStatus.bind(verificationController));
exports.default = router;
//# sourceMappingURL=verification.routes.js.map