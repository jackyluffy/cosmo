"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = void 0;
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const validation_middleware_1 = require("../middleware/validation.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const joi_1 = __importDefault(require("joi"));
const router = (0, express_1.Router)();
// Validation schemas
const requestOTPSchema = joi_1.default.object({
    phone: joi_1.default.string().pattern(/^\+?[1-9]\d{1,14}$/),
    email: joi_1.default.string().email(),
}).xor('phone', 'email');
const verifyOTPSchema = joi_1.default.object({
    phone: joi_1.default.string().pattern(/^\+?[1-9]\d{1,14}$/),
    email: joi_1.default.string().email(),
    code: joi_1.default.string().length(6).required(),
}).xor('phone', 'email');
// Routes
router.post('/otp/request', (0, validation_middleware_1.validateRequest)(requestOTPSchema), auth_controller_1.AuthController.requestOTP);
router.post('/otp/verify', (0, validation_middleware_1.validateRequest)(verifyOTPSchema), auth_controller_1.AuthController.verifyOTP);
router.post('/validate', auth_middleware_1.authenticate, auth_controller_1.AuthController.validateToken);
router.post('/logout', auth_middleware_1.authenticate, auth_controller_1.AuthController.logout);
router.post('/refresh', auth_controller_1.AuthController.refreshToken);
// OAuth validation schemas
const googleAuthSchema = joi_1.default.object({
    idToken: joi_1.default.string().required(),
});
const appleAuthSchema = joi_1.default.object({
    identityToken: joi_1.default.string().required(),
    user: joi_1.default.object().optional(),
});
// OAuth routes
router.post('/google', (0, validation_middleware_1.validateRequest)(googleAuthSchema), auth_controller_1.AuthController.googleAuth);
router.post('/apple', (0, validation_middleware_1.validateRequest)(appleAuthSchema), auth_controller_1.AuthController.appleAuth);
exports.authRoutes = router;
//# sourceMappingURL=auth.routes.js.map