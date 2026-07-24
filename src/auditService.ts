import axios, { AxiosError } from 'axios';
import { Logger } from './logger';
import { Validator, ValidationError } from './validator';
import { Cache } from './cache';

export interface AuditRequest {
  url: string;
  timeout?: number;
  followRedirects?: boolean;
}

export interface LinkAnalysis {
  total: number;
  internal: number;
  external: number;
  broken: number;
}

export interface SSLInfo {
  valid: boolean;
  issuer?: string;
  expiresAt?: string;
}

export interface AuditResult {
  status: number;
  statusText: string;
  contentType?: string;
  contentLength?: number;
  loadTime: number;
  headers: Record<string, string>;
  links?: LinkAnalysis;
  ssl?: SSLInfo;
}

export interface AuditResponse {
  requestId: string;
  url: string;
  cached: boolean;
  timestamp: string;
  audit: AuditResult;
}

interface ConcurrencyManager {
  current: number;
  max: number;
  waiting: (() => void)[];
}

export class AuditService {
  private cache: Cache<AuditResult>;
  private logger: Logger;
  private concurrencyManager: ConcurrencyManager;
  private requestTimeoutDefault: number;
  private requestTimeoutMax: number;
  private cacheTtlSeconds: number;

  constructor(
    cache: Cache<AuditResult>,
    logger: Logger,
    options: {
      maxConcurrentRequests?: number;
      requestTimeoutDefault?: number;
      requestTimeoutMax?: number;
      cacheTtlSeconds?: number;
    } = {}
  ) {
    this.cache = cache;
    this.logger = logger;
    this.concurrencyManager = {
      current: 0,
      max: options.maxConcurrentRequests || 50,
      waiting: [],
    };
    this.requestTimeoutDefault = options.requestTimeoutDefault || 30;
    this.requestTimeoutMax = options.requestTimeoutMax || 60;
    this.cacheTtlSeconds = options.cacheTtlSeconds || 3600;
  }

  async audit(
    request: AuditRequest,
    requestId: string
  ): Promise<AuditResponse> {
    const startTime = Date.now();

    try {
      Validator.validateUrl(request.url);
      const timeout = Validator.validateTimeout(request.timeout, {
        default: this.requestTimeoutDefault,
        max: this.requestTimeoutMax,
      });
      const followRedirects = Validator.validateFollowRedirects(
        request.followRedirects
      );

      const cacheKey = this.getCacheKey(request);
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.logger.info('Cache hit for audit', {
          requestId,
          url: request.url,
        });
        return {
          requestId,
          url: request.url,
          cached: true,
          timestamp: new Date().toISOString(),
          audit: cached,
        };
      }

      await this.acquireConcurrencySlot();

      try {
        const result = await this.performAudit(
          request.url,
          timeout,
          followRedirects,
          requestId
        );

        this.cache.set(cacheKey, result, this.cacheTtlSeconds);

        this.logger.info('Audit completed successfully', {
          requestId,
          url: request.url,
          status: result.status,
          loadTime: result.loadTime,
        });

        return {
          requestId,
          url: request.url,
          cached: false,
          timestamp: new Date().toISOString(),
          audit: result,
        };
      } finally {
        this.releaseConcurrencySlot();
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Audit failed', {
        requestId,
        url: request.url,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });
      throw error;
    }
  }

  private async performAudit(
    url: string,
    timeoutSeconds: number,
    followRedirects: boolean,
    requestId: string
  ): Promise<AuditResult> {
    const startTime = Date.now();

    try {
      const response = await axios.get(url, {
        timeout: timeoutSeconds * 1000,
        maxRedirects: followRedirects ? 5 : 0,
        validateStatus: () => true,
        headers: {
          'User-Agent':
            'Page-Pulse/1.0 (+https://github.com/mani0bne/page-pulse)',
        },
      });

      const loadTime = Date.now() - startTime;
      const contentLengthHeader = response.headers['content-length'];
      const contentLength = typeof contentLengthHeader === 'string' 
        ? parseInt(contentLengthHeader, 10)
        : 0;

      return {
        status: response.status,
        statusText: response.statusText || 'OK',
        contentType: String(response.headers['content-type'] || ''),
        contentLength,
        loadTime,
        headers: this.extractRelevantHeaders(response.headers as Record<string, any>),
        links: this.analyzeLinks(response.data),
        ssl: this.extractSSLInfo(response),
      };
    } catch (error) {
      const loadTime = Date.now() - startTime;

      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
          throw new Error(`REQUEST_TIMEOUT:Request timed out after ${timeoutSeconds} seconds`);
        }
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
          throw new Error(`UNREACHABLE_URL:Could not reach the specified URL`);
        }
      }

      throw new Error(
        `AUDIT_FAILED:${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private extractRelevantHeaders(
    headers: Record<string, any>
  ): Record<string, string> {
    const relevant = [
      'server',
      'cache-control',
      'content-type',
      'content-length',
      'x-powered-by',
      'strict-transport-security',
      'x-frame-options',
    ];

    const result: Record<string, string> = {};
    for (const key of relevant) {
      if (key in headers) {
        result[key] = String(headers[key]);
      }
    }
    return result;
  }

  private analyzeLinks(data: any): LinkAnalysis {
    if (typeof data !== 'string') {
      return { total: 0, internal: 0, external: 0, broken: 0 };
    }

    const hrefRegex = /href=["']([^"']+)["']/gi;
    const matches = data.matchAll(hrefRegex);

    let total = 0;
    let internal = 0;
    let external = 0;

    for (const match of matches) {
      const href = match[1];
      total++;

      if (href.startsWith('http://') || href.startsWith('https://')) {
        external++;
      } else if (href.startsWith('/') || href.startsWith('#')) {
        internal++;
      } else {
        internal++;
      }
    }

    return {
      total,
      internal,
      external,
      broken: 0,
    };
  }

  private extractSSLInfo(response: any): SSLInfo | undefined {
    const url = response.config?.url || '';
    if (url.startsWith('https://')) {
      return {
        valid: true,
      };
    }
    return undefined;
  }

  private getCacheKey(request: AuditRequest): string {
    return `audit:${request.url}:${request.followRedirects ? 'follow' : 'nofollow'}`;
  }

  private async acquireConcurrencySlot(): Promise<void> {
    if (this.concurrencyManager.current >= this.concurrencyManager.max) {
      return new Promise((resolve) => {
        this.concurrencyManager.waiting.push(resolve);
      });
    }
    this.concurrencyManager.current++;
  }

  private releaseConcurrencySlot(): void {
    this.concurrencyManager.current--;
    const next = this.concurrencyManager.waiting.shift();
    if (next) {
      this.concurrencyManager.current++;
      next();
    }
  }

  getConcurrencyStats() {
    return {
      current: this.concurrencyManager.current,
      max: this.concurrencyManager.max,
      waiting: this.concurrencyManager.waiting.length,
    };
  }
}
