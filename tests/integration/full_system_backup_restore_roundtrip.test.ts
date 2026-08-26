import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  SqliteDatabase,
  MigrationRunner,
  SqlitePatientRepository,
  SqliteDoctorRepository,
  SqliteClinicalVisitRepository,
  SqlitePrescriptionRepository,
  SqliteMedicineRepository,
  SqliteMedicineProductRepository,
  SqliteInventoryBatchRepository,
  SqliteSaleRepository,
  SqliteAuditRepository,
  SqliteBackupLogRepository
} from '@medidesk/database';
import { AuditService } from '@medidesk/audit';
import { RBACEngine } from '@medidesk/authorization';
import { BackupService } from '@medidesk/backup';
import {
  SessionUser,
  RoleName,
  AuditAction,
  AuditResult
} from '@medidesk/domain';

describe('Phase 6 Section 15: Complete Database Backup & Restore Round-Trip Verification', () => {
  let testDir: string;
  let backupDir: string;
  let db: SqliteDatabase;
  let backupService: BackupService;
  let testDbPath: string;

  const orgId = 'org-roundtrip-test';

  const ownerUser: SessionUser = {
    id: 'user-owner-rt',
    organizationId: orgId,
    organizationName: 'Roundtrip Clinic',
    username: 'owner_rt',
    email: 'owner@rt.com',
    fullName: 'Dr. Owner Roundtrip',
    roles: [RoleName.OWNER],
    permissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
    isLocked: false,
    failedLoginAttempts: 0
  };

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medidesk-roundtrip-test-'));
    backupDir = path.join(testDir, 'backups');
    fs.mkdirSync(backupDir, { recursive: true });

    testDbPath = path.join(testDir, 'clinic_roundtrip.sqlite');
    db = new SqliteDatabase({ databasePath: testDbPath });

    const migrationsDir = path.resolve(__dirname, '../../database/migrations');
    const runner = new MigrationRunner(db, migrationsDir);
    runner.runPendingMigrations();

    db.getRawDb().prepare(`INSERT INTO organizations (id, name, code) VALUES (?, 'Roundtrip Clinic', 'RTC')`).run(orgId);
    db.getRawDb().prepare(`INSERT INTO users (id, organization_id, username, email, full_name, password_hash, is_active) VALUES (?, ?, ?, ?, ?, 'hash', 1)`).run(
      ownerUser.id,
      orgId,
      ownerUser.username,
      ownerUser.email,
      ownerUser.fullName
    );

    const auditRepo = new SqliteAuditRepository(db);
    const auditService = new AuditService(auditRepo);
    const rbac = new RBACEngine();
    const backupRepo = new SqliteBackupLogRepository(db);

    backupService = new BackupService(testDbPath, backupDir, backupRepo, auditService, rbac);
  });

  afterEach(() => {
    try {
      db.close();
    } catch { /* already closed */ }
    if (fs.existsSync(testDir)) {
      try {
        fs.rmSync(testDir, { recursive: true, force: true });
      } catch { /* ignore */ }
    }
  });

  it('performs full round-trip verification across Patient, Consultation, Prescription, Medicine, Inventory, Sale, and Audit records', async () => {
    // 1. Initialize Repositories
    const patientRepo = new SqlitePatientRepository(db);
    const doctorRepo = new SqliteDoctorRepository(db);
    const visitRepo = new SqliteClinicalVisitRepository(db);
    const rxRepo = new SqlitePrescriptionRepository(db);
    const medicineRepo = new SqliteMedicineRepository(db);
    const productRepo = new SqliteMedicineProductRepository(db);
    const batchRepo = new SqliteInventoryBatchRepository(db);
    const saleRepo = new SqliteSaleRepository(db);
    const auditRepo = new SqliteAuditRepository(db);
    const auditService = new AuditService(auditRepo);

    // 2. Populate authoritative test data across all domains
    // A. Patient
    const patient = await patientRepo.create({
      organizationId: orgId,
      fullName: 'Vikram Malhotra',
      dateOfBirth: '1985-05-15',
      age: 41,
      sex: 'MALE',
      mobile: '9876543210',
      address: '74 MG Road, Bangalore'
    });

    // B. Doctor
    const doctor = await doctorRepo.create({
      organizationId: orgId,
      userId: ownerUser.id,
      displayName: 'Dr. Anand Sharma',
      qualification: 'MBBS, MD (Medicine)',
      registrationNumber: 'KMC-12345',
      specialization: 'Internal Medicine',
      consultationFee: 500
    });

    // C. Clinical Visit
    const visit = await visitRepo.create({
      organizationId: orgId,
      patientId: patient.id,
      doctorId: doctor.id,
      visitDateTime: new Date(),
      chiefComplaint: 'Persistent fever and productive cough',
      clinicalAssessment: 'Acute Bronchitis',
      examinationNotes: 'Chest examination shows coarse crepitations.',
      createdBy: ownerUser.id
    });

    // D. Versioned Prescription
    const rx = await rxRepo.create({
      organizationId: orgId,
      clinicalVisitId: visit.id,
      patientId: patient.id,
      doctorId: doctor.id,
      items: [
        {
          medicineName: 'Amoxicillin 500mg',
          dosageForm: 'CAPSULE',
          route: 'ORAL',
          frequency: '1-1-1',
          durationValue: 5,
          durationUnit: 'DAYS',
          quantity: 15,
          instructions: 'After meals',
          isSubstitutionAllowed: false
        }
      ],
      notes: 'Drink plenty of warm fluids.',
      createdBy: ownerUser.id
    });

    // E. Medicine Master & Product
    const med = await medicineRepo.create({
      organizationId: orgId,
      genericName: 'Amoxicillin Trihydrate',
      scheduleCategory: 'H',
      therapeuticClass: 'Antibiotic'
    });

    const product = await productRepo.create({
      organizationId: orgId,
      medicineId: med.id,
      brandName: 'Mox 500',
      strength: '500mg',
      dosageForm: 'CAPSULE',
      packSize: '10 Capsules / Strip',
      packQuantity: 10,
      unitOfMeasure: 'STRIP',
      hsnCode: '30041010',
      taxRatePercent: 12
    });

    // F. Inventory Batch
    const batch = await batchRepo.create({
      organizationId: orgId,
      productId: product.id,
      batchNumber: 'MOX-887',
      expiryDate: '2028-06-30',
      purchasePricePerUnit: 8,
      mrpPerUnit: 12,
      salePricePerUnit: 11,
      initialStockQuantity: 200
    });

    // G. Retail POS Sale Billing
    const sale = await saleRepo.create({
      organizationId: orgId,
      billNumber: 'BILL-RT-001',
      patientId: patient.id,
      customerName: patient.fullName,
      customerType: 'PATIENT',
      customerPhone: patient.mobile,
      items: [
        {
          productId: product.id,
          batchId: batch.id,
          quantity: 15,
          unitSalePrice: 11,
          discountAmount: 0
        }
      ],
      grossAmount: 165,
      discountAmount: 0,
      taxAmount: 19.8,
      roundOff: 0.2,
      netAmount: 185,
      paymentMode: 'CASH',
      createdBy: ownerUser.id
    });

    // H. Audit Event
    await auditService.logEvent({
      action: AuditAction.SALE_CREATED,
      actor: { id: ownerUser.id, username: ownerUser.fullName, role: ownerUser.roles[0] },
      resource: sale.id,
      result: AuditResult.SUCCESS,
      metadata: { billNumber: sale.billNumber, total: sale.netAmount }
    });

    // 3. Checkpoint WAL and create Backup Snapshot
    db.getRawDb().pragma('wal_checkpoint(TRUNCATE)');
    const backupMetadata = await backupService.createLocalBackup(backupDir, ownerUser);
    expect(backupMetadata.isVerified).toBe(true);
    expect(fs.existsSync(backupMetadata.filePath)).toBe(true);

    // Verify backup integrity
    const isVerified = await backupService.verifyBackup(backupMetadata.filePath, backupMetadata.sha256Checksum, ownerUser);
    expect(isVerified).toBe(true);

    // 4. Mutate / Corrupt Live Database state
    db.getRawDb().prepare(`DELETE FROM sale_items`).run();
    db.getRawDb().prepare(`DELETE FROM sales`).run();
    db.getRawDb().prepare(`DELETE FROM prescription_items`).run();
    db.getRawDb().prepare(`DELETE FROM prescription_versions`).run();
    db.getRawDb().prepare(`DELETE FROM prescriptions`).run();
    db.getRawDb().prepare(`DELETE FROM clinical_visits`).run();
    db.getRawDb().prepare(`DELETE FROM doctors`).run();
    db.getRawDb().prepare(`DELETE FROM patients`).run();
    db.getRawDb().prepare(`DELETE FROM stock_movements`).run();
    db.getRawDb().prepare(`DELETE FROM inventory_batches`).run();
    db.getRawDb().prepare(`DELETE FROM medicine_products`).run();
    db.getRawDb().prepare(`DELETE FROM medicines`).run();

    // Verify data is deleted
    const countPatients = (db.getRawDb().prepare('SELECT count(*) as c FROM patients').get() as any).c;
    expect(countPatients).toBe(0);

    // 5. Close active database handle
    db.close();

    // 6. Execute Restore from Snapshot
    await backupService.restoreBackup(backupMetadata.filePath, testDbPath, ownerUser);

    // 7. Reopen database and verify complete round-trip fidelity
    const restoredDb = new SqliteDatabase({ databasePath: testDbPath });

    const restoredPatientRepo = new SqlitePatientRepository(restoredDb);
    const restoredVisitRepo = new SqliteClinicalVisitRepository(restoredDb);
    const restoredRxRepo = new SqlitePrescriptionRepository(restoredDb);
    const restoredProductRepo = new SqliteMedicineProductRepository(restoredDb);
    const restoredBatchRepo = new SqliteInventoryBatchRepository(restoredDb);
    const restoredSaleRepo = new SqliteSaleRepository(restoredDb);
    const restoredAuditRepo = new SqliteAuditRepository(restoredDb);

    // Verify Patient
    const restoredPatient = await restoredPatientRepo.findById(patient.id);
    expect(restoredPatient).not.toBeNull();
    expect(restoredPatient?.fullName).toBe('Vikram Malhotra');
    expect(restoredPatient?.mobile).toBe('9876543210');

    // Verify Clinical Visit
    const restoredVisit = await restoredVisitRepo.findById(visit.id, orgId);
    expect(restoredVisit).not.toBeNull();
    expect(restoredVisit?.clinicalAssessment).toBe('Acute Bronchitis');

    // Verify Prescription
    const restoredRx = await restoredRxRepo.findById(rx.id, orgId);
    expect(restoredRx).not.toBeNull();
    expect(restoredRx?.currentVersion?.items.length).toBe(1);
    expect(restoredRx?.currentVersion?.items[0].medicineName).toBe('Amoxicillin 500mg');

    // Verify Medicine & Product
    const restoredProduct = await restoredProductRepo.findById(product.id, orgId);
    expect(restoredProduct).not.toBeNull();
    expect(restoredProduct?.brandName).toBe('Mox 500');

    // Verify Inventory Batch
    const restoredBatch = await restoredBatchRepo.findById(batch.id, orgId);
    expect(restoredBatch).not.toBeNull();
    expect(restoredBatch?.batchNumber).toBe('MOX-887');
    expect(restoredBatch?.currentStockQuantity).toBe(185);

    // Verify Sale
    const restoredSale = await restoredSaleRepo.findById(sale.id, orgId);
    expect(restoredSale).not.toBeNull();
    expect(restoredSale?.billNumber).toBe('BILL-RT-001');
    expect(restoredSale?.netAmount).toBe(185);

    // Verify Audit Trail
    const events = await restoredAuditRepo.listRecent(50);
    const saleAuditEvent = events.find(e => e.resource === sale.id);
    expect(saleAuditEvent).toBeDefined();
    expect(saleAuditEvent?.action).toBe(AuditAction.SALE_CREATED);

    restoredDb.close();
  });
});
