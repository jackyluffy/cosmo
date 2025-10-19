import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { logger } from '../utils/logger';

export function validateRequest(schema: Joi.Schema, property: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalValue = req[property];

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

      logger.warn('Validation error:', { errors, path: req.path });

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors,
      });
    }

    // Replace request property with validated value
    req[property] = value;
    const originalKey =
      property === 'body'
        ? '_originalBody'
        : property === 'query'
        ? '_originalQuery'
        : '_originalParams';
    (req as any)[originalKey] = originalValue;
    next();
  };
}
