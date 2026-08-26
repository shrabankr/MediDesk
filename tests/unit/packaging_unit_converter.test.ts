import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PackagingUnitService } from '@medidesk/application';
import { IPackagingUnitRepository, IMedicineProductRepository } from '@medidesk/domain';
import { IAuditService } from '@medidesk/audit';

describe('Phase 8A & 8B: PackagingUnitService & Base Unit Conversions', () => {
  let service: PackagingUnitService;
  let mockPackagingRepo: Partial<IPackagingUnitRepository>;
  let mockProductRepo: Partial<IMedicineProductRepository>;
  let mockAuditService: Partial<IAuditService>;

  const mockProduct = {
    id: 'prod-pcm-500',
    organizationId: 'org-1',
    medicineId: 'med-pcm',
    brandName: 'Dolo 650',
    strength: '650mg',
    dosageForm: 'TABLET' as any,
    packSize: '15 Tablets / Strip',
    packQuantity: 15,
    unitOfMeasure: 'TABLET',
    taxRatePercent: 12,
    minStockLevel: 10,
    maxStockLevel: 1000,
    reorderQuantity: 50,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockPackagingUnits = [
    {
      id: 'pkg-tablet',
      organizationId: 'org-1',
      productId: 'prod-pcm-500',
      unitName: 'TABLET',
      conversionFactor: 1,
      salePricePaise: 200, // ₹2.00 per tablet
      mrpPaise: 250, // ₹2.50 per tablet
      isDefaultSaleUnit: false,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'pkg-strip',
      organizationId: 'org-1',
      productId: 'prod-pcm-500',
      unitName: 'STRIP',
      conversionFactor: 15, // 15 tablets per strip
      salePricePaise: 2800, // ₹28.00 per strip
      mrpPaise: 3500, // ₹35.00 per strip
      isDefaultSaleUnit: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'pkg-box',
      organizationId: 'org-1',
      productId: 'prod-pcm-500',
      unitName: 'BOX',
      conversionFactor: 150, // 10 strips = 150 tablets
      salePricePaise: 26000, // ₹260.00 per box
      mrpPaise: 35000, // ₹350.00 per box
      isDefaultSaleUnit: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  beforeEach(() => {
    mockPackagingRepo = {
      create: vi.fn().mockImplementation(async (dto) => ({
        id: 'pkg-new',
        ...dto,
        createdAt: new Date(),
        updatedAt: new Date()
      })),
      findByProduct: vi.fn().mockResolvedValue(mockPackagingUnits),
      findByUnitName: vi.fn().mockResolvedValue(null),
      findById: vi.fn().mockResolvedValue(mockPackagingUnits[1]),
      update: vi.fn().mockImplementation(async (id, dto) => ({
        ...mockPackagingUnits[1],
        ...dto,
        id
      })),
      delete: vi.fn().mockResolvedValue(true)
    };

    mockProductRepo = {
      findById: vi.fn().mockResolvedValue(mockProduct)
    };

    mockAuditService = {
      logEvent: vi.fn().mockResolvedValue(undefined as any)
    };

    service = new PackagingUnitService(
      mockPackagingRepo as IPackagingUnitRepository,
      mockProductRepo as IMedicineProductRepository,
      mockAuditService as IAuditService
    );
  });

  describe('Conversion Arithmetic & Integer Paise Math', () => {
    it('correctly converts Box quantity to base units and integer prices', async () => {
      const result = await service.convertPackageToBaseUnits('prod-pcm-500', 'BOX', 3, 'org-1');

      expect(result.packageQuantity).toBe(3);
      expect(result.totalBaseUnits).toBe(450); // 3 * 150 tablets
      expect(result.calculatedPricePaise).toBe(78000); // 3 * 26000 paise (₹780.00)
      expect(result.calculatedMrpPaise).toBe(105000); // 3 * 35000 paise (₹1050.00)
    });

    it('correctly converts Strip quantity to base units and integer prices', async () => {
      const result = await service.convertPackageToBaseUnits('prod-pcm-500', 'STRIP', 2, 'org-1');

      expect(result.packageQuantity).toBe(2);
      expect(result.totalBaseUnits).toBe(30); // 2 * 15 tablets
      expect(result.calculatedPricePaise).toBe(5600); // 2 * 2800 paise (₹56.00)
      expect(result.calculatedMrpPaise).toBe(7000); // 2 * 3500 paise (₹70.00)
    });

    it('performs deterministic Half-Up rounding for base unit prices', () => {
      // ₹28.00 (2800 paise) for 15 tablets -> 2800 / 15 = 186.666... -> Half-up: 187 paise
      const baseUnitPrice = service.calculateBaseUnitPricePaise(2800, 15);
      expect(baseUnitPrice).toBe(187);

      // ₹30.00 (3000 paise) for 15 tablets -> 3000 / 15 = 200 paise
      const exactUnitPrice = service.calculateBaseUnitPricePaise(3000, 15);
      expect(exactUnitPrice).toBe(200);
    });

    it('rejects fractional or negative package quantities', async () => {
      await expect(
        service.convertPackageToBaseUnits('prod-pcm-500', 'BOX', 2.5, 'org-1')
      ).rejects.toThrow('Package quantity must be a positive integer');

      await expect(
        service.convertPackageToBaseUnits('prod-pcm-500', 'BOX', -1, 'org-1')
      ).rejects.toThrow('Package quantity must be a positive integer');
    });

    it('throws when requested packaging unit does not exist', async () => {
      await expect(
        service.convertPackageToBaseUnits('prod-pcm-500', 'CARTON', 1, 'org-1')
      ).rejects.toThrow("Packaging unit 'CARTON' not found");
    });
  });

  describe('Validation & Invariants', () => {
    it('creates a new packaging unit and records an audit event', async () => {
      const created = await service.createPackagingUnit(
        {
          organizationId: 'org-1',
          productId: 'prod-pcm-500',
          unitName: 'CARTON',
          conversionFactor: 1500, // 10 boxes = 1500 tablets
          salePricePaise: 250000, // ₹2,500.00
          mrpPaise: 350000,
          isDefaultSaleUnit: false
        },
        'user-owner-1'
      );

      expect(created.unitName).toBe('CARTON');
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PACKAGING_UNIT_CREATED'
        })
      );
    });

    it('rejects conversion factor less than 1', async () => {
      await expect(
        service.createPackagingUnit(
          {
            organizationId: 'org-1',
            productId: 'prod-pcm-500',
            unitName: 'VIAL',
            conversionFactor: 0,
            salePricePaise: 1000,
            mrpPaise: 1200
          },
          'user-owner-1'
        )
      ).rejects.toThrow();
    });

    it('rejects duplicate packaging unit names for the same product', async () => {
      mockPackagingRepo.findByUnitName = vi.fn().mockResolvedValue(mockPackagingUnits[0]);

      await expect(
        service.createPackagingUnit(
          {
            organizationId: 'org-1',
            productId: 'prod-pcm-500',
            unitName: 'TABLET',
            conversionFactor: 1,
            salePricePaise: 200,
            mrpPaise: 250
          },
          'user-owner-1'
        )
      ).rejects.toThrow("Packaging unit 'TABLET' already exists");
    });
  });
});
