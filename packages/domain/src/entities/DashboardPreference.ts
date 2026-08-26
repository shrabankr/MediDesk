export interface UserDashboardPreference {
  id: string;
  userId: string;
  organizationId: string;
  widgetLayout: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SaveDashboardPreferenceDTO {
  userId: string;
  organizationId: string;
  widgetLayout: Record<string, any>;
}
