import { v4 as uuidv4 } from 'uuid';

export interface LogContext {
  requestId: string;
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  requestId?: string;
  [key: string]: any;
}

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

type LogLevel = keyof typeof LOG_LEVELS;

export class Logger {
  private logLevel: LogLevel;
  private format: 'json' | 'text';

  constructor(
    logLevel: LogLevel = 'info',
    format: 'json' | 'text' = 'json'
  ) {
    this.logLevel = logLevel;
    this.format = format;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.logLevel];
  }

  private formatOutput(entry: LogEntry): string {
    if (this.format === 'json') {
      return JSON.stringify(entry);
    }
    const { timestamp, level, message, requestId, ...rest } = entry;
    const requestIdStr = requestId ? ` [${requestId}]` : '';
    const extraStr = Object.keys(rest).length
      ? ` ${JSON.stringify(rest)}`
      : '';
    return `${timestamp} ${level.toUpperCase()}${requestIdStr}: ${message}${extraStr}`;
  }

  private log(
    level: LogLevel,
    message: string,
    context?: LogContext | Record<string, any>
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(context && { ...context }),
    };

    const output = this.formatOutput(entry);
    const logFn = level === 'error' ? console.error : console.log;
    logFn(output);
  }

  debug(message: string, context?: LogContext | Record<string, any>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext | Record<string, any>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext | Record<string, any>): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: LogContext | Record<string, any>): void {
    this.log('error', message, context);
  }

  createContext(): LogContext {
    return { requestId: uuidv4() };
  }
}

const logLevel = (process.env.LOG_LEVEL || 'info') as LogLevel;
const logFormat = (process.env.LOG_FORMAT || 'json') as 'json' | 'text';
export const logger = new Logger(logLevel, logFormat);
