export interface TaxRule {
  id: string;
  organizationId: string;
  taxName: string;
  ratePercent: number;
  cgstPercent: number;
  sgstPercent: number;
  igstPercent: number;
  isActive: boolean;
  createdAt: Date;
  createdBy?: string;
}

export interface CreateTaxRuleDTO {
  id?: string;
  organizationId: string;
  taxName: string;
  ratePercent: number;
  cgstPercent?: number;
  sgstPercent?: number;
  igstPercent?: number;
  createdBy?: string;
}
