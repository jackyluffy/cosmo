import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
export declare function validateRequest(schema: Joi.Schema, property?: 'body' | 'query' | 'params'): (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=validation.middleware.d.ts.map