export interface Organization {
  id: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  email?: string;
  currency: string;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateOrganizationDTO = Omit<Organization, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string;
};
