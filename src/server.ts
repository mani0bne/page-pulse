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

app.get('/', (req: Request, res: Response) => {
  const context = req.context || {};
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Page Pulse - URL Auditing Service</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 40px 20px;
          flex: 1;
        }
        header {
          text-align: center;
          color: white;
          margin-bottom: 50px;
        }
        h1 {
          font-size: 3em;
          margin-bottom: 10px;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
        }
        .tagline {
          font-size: 1.2em;
          opacity: 0.95;
        }
        .endpoints {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
          margin-bottom: 40px;
        }
        .endpoint-card {
          background: white;
          border-radius: 8px;
          padding: 25px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.2);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .endpoint-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 15px 40px rgba(0,0,0,0.3);
        }
        .endpoint-card h3 {
          color: #667eea;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .method {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-weight: bold;
          font-size: 0.9em;
        }
        .method.get { background: #61affe; color: white; }
        .method.post { background: #49cc90; color: white; }
        .endpoint-card p {
          color: #666;
          line-height: 1.6;
          margin-bottom: 15px;
        }
        code {
          background: #f5f5f5;
          padding: 8px 12px;
          border-radius: 4px;
          font-family: 'Courier New', monospace;
          color: #333;
          display: block;
          overflow-x: auto;
          margin: 10px 0;
          font-size: 0.9em;
        }
        .features {
          background: white;
          border-radius: 8px;
          padding: 30px;
          margin-bottom: 40px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        .features h2 {
          color: #667eea;
          margin-bottom: 20px;
        }
        .feature-list {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
        }
        .feature-list li {
          list-style: none;
          padding-left: 25px;
          position: relative;
          color: #555;
        }
        .feature-list li:before {
          content: "✓";
          position: absolute;
          left: 0;
          color: #49cc90;
          font-weight: bold;
        }
        .cta-button {
          display: inline-block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 12px 30px;
          border-radius: 6px;
          text-decoration: none;
          font-weight: bold;
          transition: transform 0.2s ease;
          border: none;
          cursor: pointer;
          font-size: 1em;
        }
        .cta-button:hover {
          transform: scale(1.05);
        }
        footer {
          text-align: center;
          color: white;
          padding: 30px 20px;
          border-top: 1px solid rgba(255,255,255,0.1);
          margin-top: auto;
        }
        footer a {
          color: #ffd700;
          text-decoration: none;
          font-weight: bold;
        }
        footer a:hover {
          text-decoration: underline;
        }
        .stats {
          background: white;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        .stat-item {
          display: inline-block;
          margin-right: 30px;
          color: #666;
        }
        .stat-value {
          font-weight: bold;
          color: #667eea;
          font-size: 1.3em;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <header>
          <h1>���� Page Pulse</h1>
          <p class="tagline">Advanced URL Auditing & Monitoring Service</p>
        </header>

        <div class="stats">
          <div class="stat-item">Status: <span class="stat-value">✅ Online</span></div>
          <div class="stat-item">Uptime: <span class="stat-value">100%</span></div>
          <div class="stat-item">Response: <span class="stat-value">< 500ms</span></div>
        </div>

        <div class="features">
          <h2>✨ Features</h2>
          <ul class="feature-list">
            <li>URL Auditing & Analysis</li>
            <li>Rate Limiting (100/hr)</li>
            <li>Smart Caching with TTL</li>
            <li>Concurrency Control</li>
            <li>Link Analysis</li>
            <li>SSL Detection</li>
            <li>Request Tracing</li>
            <li>Error Handling</li>
          </ul>
        </div>

        <div class="endpoints">
          <div class="endpoint-card">
            <h3><span class="method get">GET</span> /health</h3>
            <p>Check service health status</p>
            <code>curl http://localhost:3000/health</code>
            <a href="/health" class="cta-button" style="font-size: 0.9em; padding: 8px 16px;">Try it</a>
          </div>

          <div class="endpoint-card">
            <h3><span class="method post">POST</span> /audit</h3>
            <p>Audit a URL with comprehensive analysis</p>
            <code>POST /audit\\n{"url": "https://example.com"}</code>
            <button class="cta-button" onclick="alert('See API docs in README')" style="font-size: 0.9em; padding: 8px 16px;">Learn More</button>
          </div>

          <div class="endpoint-card">
            <h3><span class="method get">GET</span> /stats</h3>
            <p>Get service statistics and metrics</p>
            <code>curl http://localhost:3000/stats</code>
            <a href="/stats" class="cta-button" style="font-size: 0.9em; padding: 8px 16px;">Try it</a>
          </div>
        </div>
      </div>

      <footer>
        <p>Built for <a href="https://digitalheroesco.com" target="_blank">Digital Heroes Training Task</a> | Page Pulse v1.0</p>
        <p style="margin-top: 10px; font-size: 0.9em; opacity: 0.9;">© 2024 Manihas Netha N • <a href="https://github.com/mani0bne/page-pulse" target="_blank">GitHub</a></p>
      </footer>
    </body>
    </html>
  `;
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(htmlContent);
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
  logger.info(`Visit http://localhost:${port}/ to see the dashboard`, {});
});

export default app;
