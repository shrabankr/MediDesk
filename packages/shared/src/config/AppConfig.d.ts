export type Environment = 'development' | 'test' | 'production';
export interface AppConfig {
    env: Environment;
    appName: string;
    version: string;
    dataDir: string;
    databasePath: string;
    backupDir: string;
    logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
    isDevelopment: boolean;
    isTest: boolean;
    isProduction: boolean;
}
export declare function getDefaultDataDirectory(appName?: string, env?: Environment): string;
export declare function loadConfig(overrides?: Partial<AppConfig>): AppConfig;
//# sourceMappingURL=AppConfig.d.ts.map