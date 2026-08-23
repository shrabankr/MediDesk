export interface ApplicationState {
  key: string;
  value: string;
  updatedAt: Date;
}

export const ApplicationStateKeys = {
  INITIALIZED: 'system.initialized',
  INITIALIZED_AT: 'system.initialized_at',
  INITIAL_OWNER_ID: 'system.initial_owner_id',
  SCHEMA_VERSION: 'system.schema_version',
  INSTALLATION_ID: 'system.installation_id'
} as const;
