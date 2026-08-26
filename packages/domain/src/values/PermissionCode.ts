/**
 * Granular permission codes for the MediDesk RBAC system.
 */
export const PermissionCode = {
  // System & Diagnostics (Technical / Developer)
  SYSTEM_DIAGNOSTICS: 'system.diagnostics',
  SYSTEM_CONFIG_READ: 'system.config.read',
  SYSTEM_CONFIG_UPDATE: 'system.config.update',
  SYSTEM_MIGRATE: 'system.migrate',
  SYSTEM_BACKUP_LOCAL: 'system.backup.local',

  // Administration (Owner)
  ORG_MANAGE: 'org.manage',
  USER_CREATE: 'user.create',
  USER_READ: 'user.read',
  USER_UPDATE: 'user.update',
  USER_DISABLE: 'user.disable',
  ROLE_ASSIGN: 'role.assign',
  AUDIT_READ: 'audit.read',

  // Patient Management (Phase 3)
  PATIENT_READ: 'patient.read',
  PATIENT_CREATE: 'patient.create',
  PATIENT_UPDATE: 'patient.update',

  // Doctor Management (Phase 3)
  DOCTOR_READ: 'doctor.read',
  DOCTOR_CREATE: 'doctor.create',
  DOCTOR_UPDATE: 'doctor.update',
  DOCTOR_DEACTIVATE: 'doctor.deactivate',

  // Appointment & Waiting Queue Management (Phase 3)
  APPOINTMENT_READ: 'appointment.read',
  APPOINTMENT_CREATE: 'appointment.create',
  APPOINTMENT_UPDATE: 'appointment.update',
  APPOINTMENT_CANCEL: 'appointment.cancel',
  APPOINTMENT_CHECKIN: 'appointment.checkin',
  APPOINTMENT_QUEUE_MANAGE: 'appointment.queue.manage',

  // Clinical Consultation & Encounters (Phase 4)
  CLINICAL_READ: 'clinical.read',
  CLINICAL_CREATE: 'clinical.create',
  CLINICAL_UPDATE: 'clinical.update',
  CLINICAL_COMPLETE: 'clinical.complete',
  CLINICAL_CORRECT: 'clinical.correct',

  // Vitals Telemetry (Phase 4)
  VITALS_READ: 'vitals.read',
  VITALS_CREATE: 'vitals.create',
  VITALS_UPDATE: 'vitals.update',

  // Clinical Diagnoses (Phase 4)
  DIAGNOSIS_READ: 'diagnosis.read',
  DIAGNOSIS_CREATE: 'diagnosis.create',
  DIAGNOSIS_UPDATE: 'diagnosis.update',

  // Medical & Surgical History (Phase 4)
  HISTORY_READ: 'history.read',
  HISTORY_CREATE: 'history.create',
  HISTORY_UPDATE: 'history.update',

  // Allergies & Alerts (Phase 4)
  ALLERGY_READ: 'allergy.read',
  ALLERGY_CREATE: 'allergy.create',
  ALLERGY_UPDATE: 'allergy.update',

  // Versioned Prescriptions (Phase 4)
  PRESCRIPTION_READ: 'prescription.read',
  PRESCRIPTION_CREATE: 'prescription.create',
  PRESCRIPTION_UPDATE: 'prescription.update',
  PRESCRIPTION_SIGN: 'prescription.sign',
  PRESCRIPTION_CANCEL: 'prescription.cancel',
  PRESCRIPTION_PRINT: 'prescription.print',

  // Follow-Up Management (Phase 4)
  FOLLOWUP_READ: 'followup.read',
  FOLLOWUP_CREATE: 'followup.create',
  FOLLOWUP_UPDATE: 'followup.update',

  // Pharmacy & Operations (Phase 5)
  MEDICINE_READ: 'medicine.read',
  MEDICINE_CREATE: 'medicine.create',
  MEDICINE_UPDATE: 'medicine.update',
  MEDICINE_DEACTIVATE: 'medicine.deactivate',
  SUPPLIER_READ: 'supplier.read',
  SUPPLIER_CREATE: 'supplier.create',
  SUPPLIER_UPDATE: 'supplier.update',
  PURCHASE_READ: 'purchase.read',
  PURCHASE_CREATE: 'purchase.create',
  PURCHASE_CANCEL: 'purchase.cancel',
  INVENTORY_READ: 'inventory.read',
  INVENTORY_ADJUST: 'inventory.adjust',
  BATCH_READ: 'batch.read',
  SALE_READ: 'sale.read',
  SALE_CREATE: 'sale.create',
  SALE_CANCEL: 'sale.cancel',
  SALE_RETURN: 'sale.return',
  REPORT_READ: 'report.read',
  REPORT_PHARMACY_READ: 'report.pharmacy.read',

  // System Utilities, Licensing & Backup (Phase 6)
  SYSTEM_BACKUP_CREATE: 'system.backup.create',
  SYSTEM_BACKUP_READ: 'system.backup.read',
  SYSTEM_RESTORE_EXECUTE: 'system.restore.execute',
  SYSTEM_LICENSE_READ: 'system.license.read',
  SYSTEM_LICENSE_ACTIVATE: 'system.license.activate',
  PRINTER_MANAGE: 'printer.manage'
} as const;

export type PermissionCode = (typeof PermissionCode)[keyof typeof PermissionCode];
