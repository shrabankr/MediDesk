import { MedicineProduct, CreateMedicineProductDTO, UpdateMedicineProductDTO } from '../entities/Medicine.js';

export interface IMedicineProductRepository {
  create(dto: CreateMedicineProductDTO): Promise<MedicineProduct>;
  findById(id: string, organizationId: string): Promise<MedicineProduct | null>;
  findByBarcode(barcode: string, organizationId: string): Promise<MedicineProduct | null>;
  search(organizationId: string, query: string, limit?: number): Promise<MedicineProduct[]>;
  findByMedicineId(medicineId: string, organizationId: string): Promise<MedicineProduct[]>;
  update(id: string, organizationId: string, dto: UpdateMedicineProductDTO): Promise<MedicineProduct>;
  list(organizationId: string, limit?: number, offset?: number): Promise<MedicineProduct[]>;
}
