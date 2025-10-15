"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.swipeRoutes = void 0;
const express_1 = require("express");
const validation_middleware_1 = require("../middleware/validation.middleware");
const swipe_controller_1 = require("../controllers/swipe.controller");
const joi_1 = __importDefault(require("joi"));
const router = (0, express_1.Router)();
// Validation schemas
const swipeSchema = joi_1.default.object({
    direction: joi_1.default.string().valid('like', 'skip').required(),
});
// Routes
router.get('/deck', swipe_controller_1.SwipeController.getDeck);
router.post('/:targetId', (0, validation_middleware_1.validateRequest)(swipeSchema), swipe_controller_1.SwipeController.swipe);
router.get('/matches', swipe_controller_1.SwipeController.getMatches);
router.delete('/matches/:matchId', swipe_controller_1.SwipeController.unmatch);
exports.swipeRoutes = router;
//# sourceMappingURL=swipe.routes.js.map