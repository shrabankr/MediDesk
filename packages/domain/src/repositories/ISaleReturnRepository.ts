import { SaleReturn, CreateSaleReturnDTO } from '../entities/Sale.js';

export interface ISaleReturnRepository {
  create(dto: CreateSaleReturnDTO & { returnNumber: string; refundAmount: number }): Promise<SaleReturn>;
  findById(id: string, organizationId: string): Promise<SaleReturn | null>;
  findBySale(saleId: string, organizationId: string): Promise<SaleReturn[]>;
  list(organizationId: string, limit?: number, offset?: number): Promise<SaleReturn[]>;
}
