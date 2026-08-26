import { z } from 'zod';

export const createSupplierSchema = z.object({
  id: z.string().min(1).optional(),
  organizationId: z.string().min(1, 'Organization ID is required'),
  name: z.string().min(1, 'Supplier name is required').max(200),
  contactPerson: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  gstin: z.string().max(30).optional(),
  drugLicenseNumber: z.string().max(100).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  pincode: z.string().max(20).optional(),
  createdBy: z.string().min(1).optional()
});

export const updateSupplierSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  contactPerson: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  gstin: z.string().max(30).optional(),
  drugLicenseNumber: z.string().max(100).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  pincode: z.string().max(20).optional(),
  isActive: z.boolean().optional(),
  updatedBy: z.string().min(1).optional()
});
