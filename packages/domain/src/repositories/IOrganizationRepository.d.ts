import { Organization, CreateOrganizationDTO } from '../entities/Organization.js';
export interface IOrganizationRepository {
    findById(id: string): Promise<Organization | null>;
    findByCode(code: string): Promise<Organization | null>;
    getFirst(): Promise<Organization | null>;
    create(org: CreateOrganizationDTO): Promise<Organization>;
    update(id: string, org: Partial<Omit<Organization, 'id' | 'createdAt'>>): Promise<Organization>;
}
//# sourceMappingURL=IOrganizationRepository.d.ts.map