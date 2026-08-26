export interface Supplier {
  id: string;
  organizationId: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  drugLicenseNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

export interface CreateSupplierDTO {
  id?: string;
  organizationId: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  drugLicenseNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  createdBy?: string;
}

export interface UpdateSupplierDTO {
  name?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  drugLicenseNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  isActive?: boolean;
  updatedBy?: string;
}
