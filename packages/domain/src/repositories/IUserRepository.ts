import { User, CreateUserDTO } from '../entities/User.js';

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  listByOrganization(organizationId: string): Promise<User[]>;
  create(user: CreateUserDTO): Promise<User>;
  update(id: string, user: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User>;
  updatePassword(id: string, passwordHash: string): Promise<void>;
  updateLastLogin(id: string, date: Date): Promise<void>;
  recordFailedLogin(id: string): Promise<number>;
  resetFailedLogins(id: string): Promise<void>;
  countActiveOwners(organizationId: string): Promise<number>;
  count(): Promise<number>;
}
