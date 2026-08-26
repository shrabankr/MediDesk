import { TaxRule, CreateTaxRuleDTO } from '../entities/TaxRule.js';

export interface ITaxRuleRepository {
  create(dto: CreateTaxRuleDTO): Promise<TaxRule>;
  findById(id: string, organizationId: string): Promise<TaxRule | null>;
  list(organizationId: string): Promise<TaxRule[]>;
  update(id: string, organizationId: string, isActive: boolean): Promise<TaxRule>;
}
