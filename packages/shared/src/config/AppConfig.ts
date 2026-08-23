import os from 'os';
import path from 'path';

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

export function getDefaultDataDirectory(appName = 'MediDesk', env: Environment = 'production'): string {
  if (env === 'test') {
    return path.join(os.tmpdir(), `${appName.toLowerCase()}-test-${process.pid}`);
  }

  const platform = process.platform;
  const homeDir = os.homedir();

  if (platform === 'win32') {
    const appData = process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
    return path.join(appData, appName);
  } else if (platform === 'darwin') {
    return path.join(homeDir, 'Library', 'Application Support', appName);
  } else {
    // Linux / Unix
    const xdgDataHome = process.env.XDG_DATA_HOME || path.join(homeDir, '.local', 'share');
    return path.join(xdgDataHome, appName);
  }
}

export function loadConfig(overrides?: Partial<AppConfig>): AppConfig {
  const envNode = (process.env.NODE_ENV || 'development').toLowerCase();
  const env: Environment = envNode === 'production' ? 'production' : envNode === 'test' ? 'test' : 'development';

  const appName = 'MediDesk';
  const customDataDir = process.env.MEDIDESK_DATA_DIR;
  const baseDataDir = customDataDir || getDefaultDataDirectory(appName, env);

  const dataDir = path.join(baseDataDir, 'data');
  const backupDir = path.join(baseDataDir, 'backups');
  const databasePath = path.join(dataDir, 'medidesk.sqlite');

  const rawLogLevel = (process.env.MEDIDESK_LOG_LEVEL || (env === 'development' ? 'DEBUG' : 'INFO')).toUpperCase();
  const logLevel = (['DEBUG', 'INFO', 'WARN', 'ERROR'].includes(rawLogLevel) ? rawLogLevel : 'INFO') as
    | 'DEBUG'
    | 'INFO'
    | 'WARN'
    | 'ERROR';

  const config: AppConfig = {
    env,
    appName,
    version: '1.0.0',
    dataDir,
    databasePath,
    backupDir,
    logLevel,
    isDevelopment: env === 'development',
    isTest: env === 'test',
    isProduction: env === 'production',
    ...overrides
  };

  return config;
}
