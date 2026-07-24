import { Request, Response, NextFunction } from 'express';
import { Logger, LogContext } from './logger';
import { RateLimiter, RateLimitInfo } from './rateLimiter';

declare global {
  namespace Express {
    interface Request {
      context?: LogContext;
      rateLimitInfo?: RateLimitInfo;
    }
  }
}

export function requestContextMiddleware(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction) => {
    req.context = logger.createContext();
    next();
  };
}

export function rateLimitMiddleware(rateLimiter: RateLimiter) {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIp =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
    const info = rateLimiter.check(clientIp);
    req.rateLimitInfo = info;

    res.set({
      'X-RateLimit-Limit': info.limit.toString(),
      'X-RateLimit-Remaining': info.remaining.toString(),
      'X-RateLimit-Reset': Math.ceil(info.resetAt / 1000).toString(),
    });

    if (info.remaining < 0) {
      res.set('Retry-After', Math.ceil((info.resetAt - Date.now()) / 1000).toString());
      return res.status(429).json({
        requestId: req.context?.requestId,
        error: 'RATE_LIMIT_EXCEEDED',
        message: `Rate limit exceeded. Max ${info.limit} requests per hour.`,
        details: {
          limit: info.limit,
          window: '1h',
          retryAfter: Math.ceil((info.resetAt - Date.now()) / 1000),
        },
      });
    }

    next();
  };
}

export function errorHandler(logger: Logger) {
  return (err: any, req: Request, res: Response, next: NextFunction) => {
    const requestId = req.context?.requestId || 'unknown';
    logger.error('Unhandled error', {
      requestId,
      error: err.message,
      stack: err.stack,
    });

    res.status(500).json({
      requestId,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    });
  };
}
