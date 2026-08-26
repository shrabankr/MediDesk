import { Medicine, CreateMedicineDTO, UpdateMedicineDTO, Manufacturer, CreateManufacturerDTO } from '../entities/Medicine.js';

export interface IMedicineRepository {
  create(dto: CreateMedicineDTO): Promise<Medicine>;
  findById(id: string, organizationId: string): Promise<Medicine | null>;
  search(organizationId: string, query: string, limit?: number): Promise<Medicine[]>;
  update(id: string, organizationId: string, dto: UpdateMedicineDTO): Promise<Medicine>;
  list(organizationId: string, limit?: number, offset?: number): Promise<Medicine[]>;

  // Manufacturer sub-repository
  createManufacturer(dto: CreateManufacturerDTO): Promise<Manufacturer>;
  findManufacturerById(id: string, organizationId: string): Promise<Manufacturer | null>;
  listManufacturers(organizationId: string): Promise<Manufacturer[]>;
}
