const LOG_LEVEL_PRIORITIES = {
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
export class Logger {
    minLevel;
    context;
    constructor(context, minLevel = 'INFO') {
        this.context = context;
        this.minLevel = minLevel;
    }
    debug(message, meta) {
        this.log('DEBUG', message, meta);
    }
    info(message, meta) {
        this.log('INFO', message, meta);
    }
    warn(message, meta) {
        this.log('WARN', message, meta);
    }
    error(message, error, meta) {
        const errorMeta = { ...(meta ?? {}) };
        if (error instanceof Error) {
            errorMeta.errorMessage = error.message;
            errorMeta.stack = error.stack;
        }
        else if (error !== undefined) {
            errorMeta.error = error;
        }
        this.log('ERROR', message, errorMeta);
    }
    log(level, message, meta) {
        if (LOG_LEVEL_PRIORITIES[level] < LOG_LEVEL_PRIORITIES[this.minLevel]) {
            return;
        }
        const sanitizedMeta = meta ? this.sanitize(meta) : undefined;
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            context: this.context,
            message,
            ...(sanitizedMeta ? { meta: sanitizedMeta } : {})
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
    sanitize(data) {
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
            const sanitized = {};
            for (const [key, value] of Object.entries(data)) {
                if (SENSITIVE_KEYS.has(key.toLowerCase())) {
                    sanitized[key] = '[REDACTED]';
                }
                else {
                    sanitized[key] = this.sanitize(value);
                }
            }
            return sanitized;
        }
        return data;
    }
}
//# sourceMappingURL=Logger.js.map