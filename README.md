# Page Pulse - Production-Grade URL Audit Service

A robust, production-ready URL audit API with caching, rate limiting, structured logging, and comprehensive test coverage.

## Features

- **URL Auditing**: Validate URLs and return detailed page metrics (status, headers, load time, size, links)
- **Input Validation**: Comprehensive validation of URLs with security checks
- **Request Timeouts**: Configurable per-request timeouts to prevent hanging requests
- **Concurrency Limits**: Control maximum concurrent requests to prevent resource exhaustion
- **Intelligent Caching**: Time-windowed cache with configurable TTL to reduce redundant audits
- **Rate Limiting**: Per-client rate limiting with configurable limits and windows
- **Structured Logging**: Request IDs, structured output, comprehensive audit trail
- **Error Handling**: Detailed, meaningful error responses with proper HTTP status codes
- **CI/CD**: Automated testing and deployment on every push

## API Contract

### Audit Endpoint

**POST** `/api/audit`

#### Request

```json
{
  "url": "https://example.com",
  "timeout": 30,
  "followRedirects": true
}
```

**Fields:**
- `url` (required, string): The URL to audit. Must be a valid HTTP/HTTPS URL.
- `timeout` (optional, integer): Request timeout in seconds. Default: 30, Max: 60
- `followRedirects` (optional, boolean): Follow HTTP redirects. Default: true

#### Success Response (200)

```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "url": "https://example.com",
  "cached": false,
  "timestamp": "2024-01-15T10:30:00Z",
  "audit": {
    "status": 200,
    "statusText": "OK",
    "contentType": "text/html; charset=utf-8",
    "contentLength": 15234,
    "loadTime": 234,
    "headers": {
      "server": "nginx/1.21.0",
      "cache-control": "max-age=3600"
    },
    "links": {
      "total": 42,
      "internal": 35,
      "external": 7,
      "broken": 0
    },
    "ssl": {
      "valid": true,
      "issuer": "Let's Encrypt",
      "expiresAt": "2025-01-15T10:30:00Z"
    }
  }
}
```

#### Error Responses

**400 Bad Request** - Invalid input

```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "error": "INVALID_URL",
  "message": "URL must be a valid HTTP/HTTPS URL",
  "details": {
    "provided": "not-a-url"
  }
}
```

**429 Too Many Requests** - Rate limit exceeded

```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Rate limit exceeded. Max 100 requests per hour.",
  "details": {
    "limit": 100,
    "window": "1h",
    "retryAfter": 3600
  }
}
```

**504 Gateway Timeout** - Request timeout

```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "error": "REQUEST_TIMEOUT",
  "message": "Request timed out after 30 seconds",
  "details": {
    "timeout": 30
  }
}
```

**503 Service Unavailable** - Concurrency limit reached

```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "error": "CONCURRENCY_LIMIT_EXCEEDED",
  "message": "Service is at capacity. Please retry after a short delay.",
  "details": {
    "limit": 50
  }
}
```

### Health Endpoint

**GET** `/health`

**Response (200):**

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "uptime": 3600,
  "cache": {
    "size": 12,
    "maxSize": 1000
  }
}
```

## Environment Variables

```bash
# Server
PORT=3000
NODE_ENV=production

# Timeouts (in seconds)
REQUEST_TIMEOUT_DEFAULT=30
REQUEST_TIMEOUT_MAX=60

# Concurrency
MAX_CONCURRENT_REQUESTS=50

# Caching
CACHE_TTL_SECONDS=3600
CACHE_MAX_SIZE=1000

# Rate Limiting (per hour, per IP)
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW_MS=3600000

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
```

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Testing

```bash
npm test
npm run test:coverage
```

## Production Deployment

```bash
npm install --production
npm run build
npm start
```

## Architecture

### Components

1. **API Server** - Express.js with structured request/response handling
2. **Audit Service** - Core URL auditing logic with timeout and error handling
3. **Cache Layer** - In-memory cache with TTL support
4. **Rate Limiter** - Per-IP rate limiting with sliding window
5. **Logger** - Structured logging with request IDs
6. **Validator** - Input validation with security checks

### Error Handling Strategy

- All errors include a unique `requestId` for tracing
- Meaningful error codes and messages for client handling
- Structured error details for debugging
- Proper HTTP status codes for different error scenarios

### Caching Strategy

- Time-based TTL (configurable, default 1 hour)
- Size-limited LRU eviction
- Keyed by URL + audit parameters
- Indicated in response with `cached` flag

### Rate Limiting Strategy

- Per-IP rate limiting
- Sliding window counter
- Retry-After header in 429 responses
- Configurable limits and windows

## CI/CD Pipeline

Automated testing and deployment on every push:

1. Run test suite (unit + integration)
2. Generate coverage report
3. Build Docker image
4. Deploy to staging
5. Deploy to production on main branch

See `.github/workflows` for details.

## License

MIT
