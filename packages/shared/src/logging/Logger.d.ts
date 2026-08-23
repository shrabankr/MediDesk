export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    context: string;
    message: string;
    meta?: Record<string, unknown>;
}
export declare class Logger {
    private minLevel;
    private context;
    constructor(context: string, minLevel?: LogLevel);
    debug(message: string, meta?: Record<string, unknown>): void;
    info(message: string, meta?: Record<string, unknown>): void;
    warn(message: string, meta?: Record<string, unknown>): void;
    error(message: string, error?: Error | unknown, meta?: Record<string, unknown>): void;
    private log;
    sanitize(data: unknown): unknown;
}
//# sourceMappingURL=Logger.d.ts.map