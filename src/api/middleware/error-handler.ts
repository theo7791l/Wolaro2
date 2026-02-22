import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  logger.error('API Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  const status = err.status || 500;
  const message = err.message || 'Internal server error';

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}
