import { Supplier, CreateSupplierDTO, UpdateSupplierDTO } from '../entities/Supplier.js';

export interface ISupplierRepository {
  create(dto: CreateSupplierDTO): Promise<Supplier>;
  findById(id: string, organizationId: string): Promise<Supplier | null>;
  search(organizationId: string, query: string, limit?: number): Promise<Supplier[]>;
  update(id: string, organizationId: string, dto: UpdateSupplierDTO): Promise<Supplier>;
  list(organizationId: string, limit?: number, offset?: number): Promise<Supplier[]>;
}
