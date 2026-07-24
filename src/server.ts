import express, { Express, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from './logger';
import { Cache } from './cache';
import { RateLimiter } from './rateLimiter';
import { AuditService, AuditRequest, AuditResponse } from './auditService';
import {
  requestContextMiddleware,
  rateLimitMiddleware,
  errorHandler,
} from './middleware';

const app: Express = express();
const port = process.env.PORT || 3000;

const logger = new Logger();
const cache = new Cache<any>(1000, 60000);
const rateLimiter = new RateLimiter({
  maxRequests: 100,
  windowMs: 3600000,
});
const auditService = new AuditService(cache, logger, {
  maxConcurrentRequests: 50,
  requestTimeoutDefault: 30,
  requestTimeoutMax: 60,
  cacheTtlSeconds: 3600,
});

app.use(express.json());
app.use(requestContextMiddleware(logger));
app.use(rateLimitMiddleware(rateLimiter));

app.get('/health', (req: Request, res: Response) => {
  const context = req.context || {};
  logger.info('Health check', context);
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    requestId: context.requestId,
  });
});

app.post('/audit', async (req: Request, res: Response, next) => {
  try {
    const { url, timeout, followRedirects } = req.body;
    const requestId = uuidv4();
    const context = req.context || {};

    if (!url) {
      logger.warn('Missing URL in audit request', { ...context, requestId });
      return res.status(400).json({
        requestId,
        error: 'MISSING_URL',
        message: 'URL is required',
      });
    }

    const auditRequest: AuditRequest = {
      url,
      timeout,
      followRedirects,
    };

    const result = await auditService.audit(auditRequest, requestId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get('/stats', (req: Request, res: Response) => {
  const context = req.context || {};
  const cacheStats = cache.getStats();
  const concurrencyStats = auditService.getConcurrencyStats();

  logger.info('Stats retrieved', context);

  res.json({
    requestId: context.requestId,
    cache: cacheStats,
    concurrency: concurrencyStats,
    timestamp: new Date().toISOString(),
  });
});

app.use(errorHandler(logger));

app.listen(port, () => {
  logger.info(`Page Pulse server running on port ${port}`, {});
});

export default app;
