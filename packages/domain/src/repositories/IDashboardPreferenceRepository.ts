import { UserDashboardPreference, SaveDashboardPreferenceDTO } from '../entities/DashboardPreference.js';

export interface IDashboardPreferenceRepository {
  findByUser(userId: string): Promise<UserDashboardPreference | null>;
  save(dto: SaveDashboardPreferenceDTO): Promise<UserDashboardPreference>;
}
