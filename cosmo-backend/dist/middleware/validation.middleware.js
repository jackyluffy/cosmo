"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequest = validateRequest;
const logger_1 = require("../utils/logger");
function validateRequest(schema, property = 'body') {
    return (req, res, next) => {
        const { error, value } = schema.validate(req[property], {
            abortEarly: false,
            stripUnknown: true,
            convert: true,
        });
        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
            }));
            logger_1.logger.warn('Validation error:', { errors, path: req.path });
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                errors,
            });
        }
        // Replace request property with validated value
        req[property] = value;
        next();
    };
}
//# sourceMappingURL=validation.middleware.js.map