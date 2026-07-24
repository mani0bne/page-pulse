export interface ValidateUrlOptions {
  maxUrlLength?: number;
}

export class ValidationError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class Validator {
  private static readonly DEFAULT_MAX_URL_LENGTH = 2048;
  private static readonly URL_REGEX = /^https?:\/\/.+/i;
  private static readonly BLOCKED_DOMAINS = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
  ];

  static validateUrl(
    url: string,
    options: ValidateUrlOptions = {}
  ): void {
    const maxLength = options.maxUrlLength || this.DEFAULT_MAX_URL_LENGTH;

    if (!url || typeof url !== 'string') {
      throw new ValidationError(
        'INVALID_URL',
        'URL must be a non-empty string',
        { provided: typeof url }
      );
    }

    if (url.length > maxLength) {
      throw new ValidationError(
        'URL_TOO_LONG',
        `URL must be less than ${maxLength} characters`,
        { provided: url.length, max: maxLength }
      );
    }

    if (!this.URL_REGEX.test(url)) {
      throw new ValidationError(
        'INVALID_URL',
        'URL must be a valid HTTP/HTTPS URL',
        { provided: url }
      );
    }

    try {
      const parsedUrl = new URL(url);
      const hostname = parsedUrl.hostname || '';

      if (this.BLOCKED_DOMAINS.includes(hostname.toLowerCase())) {
        throw new ValidationError(
          'BLOCKED_DOMAIN',
          'Auditing local/private domains is not allowed',
          { domain: hostname }
        );
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(
        'INVALID_URL',
        'URL is malformed',
        { provided: url }
      );
    }
  }

  static validateTimeout(
    timeout?: number,
    defaults?: { default: number; max: number }
  ): number {
    const { default: defaultTimeout = 30, max: maxTimeout = 60 } = defaults || {};

    if (timeout === undefined || timeout === null) {
      return defaultTimeout;
    }

    if (typeof timeout !== 'number' || timeout <= 0) {
      throw new ValidationError(
        'INVALID_TIMEOUT',
        'Timeout must be a positive number',
        { provided: timeout }
      );
    }

    if (timeout > maxTimeout) {
      throw new ValidationError(
        'TIMEOUT_EXCEEDED_MAX',
        `Timeout must not exceed ${maxTimeout} seconds`,
        { provided: timeout, max: maxTimeout }
      );
    }

    return timeout;
  }

  static validateFollowRedirects(value?: boolean): boolean {
    if (value === undefined || value === null) {
      return true;
    }

    if (typeof value !== 'boolean') {
      throw new ValidationError(
        'INVALID_FOLLOW_REDIRECTS',
        'followRedirects must be a boolean',
        { provided: typeof value }
      );
    }

    return value;
  }
}
