export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const LOG_LEVEL_PRIORITIES: Record<LogLevel, number> = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40
};

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'secret',
  'token',
  'privatekey',
  'authorization',
  'developertoken',
  'licensekey',
  'creditcard'
]);

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  meta?: Record<string, unknown>;
}

export class Logger {
  private minLevel: LogLevel;
  private context: string;

  constructor(context: string, minLevel: LogLevel = 'INFO') {
    this.context = context;
    this.minLevel = minLevel;
  }

  public debug(message: string, meta?: Record<string, unknown>): void {
    this.log('DEBUG', message, meta);
  }

  public info(message: string, meta?: Record<string, unknown>): void {
    this.log('INFO', message, meta);
  }

  public warn(message: string, meta?: Record<string, unknown>): void {
    this.log('WARN', message, meta);
  }

  public error(message: string, error?: Error | unknown, meta?: Record<string, unknown>): void {
    const errorMeta: Record<string, unknown> = { ...(meta ?? {}) };
    if (error instanceof Error) {
      errorMeta.errorMessage = error.message;
      errorMeta.stack = error.stack;
    } else if (error !== undefined) {
      errorMeta.error = error;
    }
    this.log('ERROR', message, errorMeta);
  }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (LOG_LEVEL_PRIORITIES[level] < LOG_LEVEL_PRIORITIES[this.minLevel]) {
      return;
    }

    const sanitizedMeta = meta ? this.sanitize(meta) : undefined;
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context: this.context,
      message,
      ...(sanitizedMeta ? { meta: sanitizedMeta as Record<string, unknown> } : {})
    };

    const formatted = `[${entry.timestamp}] [${entry.level}] [${entry.context}] ${entry.message}`;

    switch (level) {
      case 'DEBUG':
        console.debug(formatted, entry.meta ?? '');
        break;
      case 'INFO':
        console.info(formatted, entry.meta ?? '');
        break;
      case 'WARN':
        console.warn(formatted, entry.meta ?? '');
        break;
      case 'ERROR':
        console.error(formatted, entry.meta ?? '');
        break;
    }
  }

  public sanitize(data: unknown): unknown {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data === 'string') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitize(item));
    }

    if (typeof data === 'object') {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        if (SENSITIVE_KEYS.has(key.toLowerCase())) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = this.sanitize(value);
        }
      }
      return sanitized;
    }

    return data;
  }
}
