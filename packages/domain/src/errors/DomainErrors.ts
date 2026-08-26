export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class EntityNotFoundError extends DomainError {
  constructor(entityName: string, id: string | number) {
    super(`${entityName} with identifier "${id}" was not found.`);
    this.name = 'EntityNotFoundError';
  }
}

export class AuthorizationError extends DomainError {
  constructor(message = 'User is not authorized to perform this operation.') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class ValidationError extends DomainError {
  public readonly errors: Record<string, string[]>;

  constructor(message: string, errors: Record<string, string[]> = {}) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

export class SystemNotInitializedError extends DomainError {
  constructor(message = 'MediDesk has not been initialized. Please complete initial setup.') {
    super(message);
    this.name = 'SystemNotInitializedError';
  }
}

export class AuthenticationError extends DomainError {
  constructor(message = 'Invalid username or password.') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AccountLockedError extends DomainError {
  constructor(message = 'Account is locked due to multiple failed login attempts. Please contact your Clinic Administrator.') {
    super(message);
    this.name = 'AccountLockedError';
  }
}

export class AccountDisabledError extends DomainError {
  constructor(message = 'Account has been disabled. Please contact your Clinic Administrator.') {
    super(message);
    this.name = 'AccountDisabledError';
  }
}

export class LastActiveOwnerProtectionError extends DomainError {
  constructor(message = 'Operation denied: Organization must always retain at least one active Owner account.') {
    super(message);
    this.name = 'LastActiveOwnerProtectionError';
  }
}

// Phase 3 Domain Errors
export class PatientNotFoundError extends DomainError {
  constructor(identifier: string) {
    super(`Patient "${identifier}" was not found.`);
    this.name = 'PatientNotFoundError';
  }
}

export class DuplicatePatientWarningError extends DomainError {
  public readonly duplicates: unknown[];

  constructor(message: string, duplicates: unknown[] = []) {
    super(message);
    this.name = 'DuplicatePatientWarningError';
    this.duplicates = duplicates;
  }
}

export class DoctorNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Doctor with ID "${id}" was not found.`);
    this.name = 'DoctorNotFoundError';
  }
}

export class DoctorInactiveError extends DomainError {
  constructor(doctorName: string) {
    super(`Doctor "${doctorName}" is currently INACTIVE and cannot receive new appointments.`);
    this.name = 'DoctorInactiveError';
  }
}

export class AppointmentConflictError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'AppointmentConflictError';
  }
}

export class OutsideDoctorScheduleError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'OutsideDoctorScheduleError';
  }
}

export class AppointmentNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Appointment with ID "${id}" was not found.`);
    this.name = 'AppointmentNotFoundError';
  }
}

export class InvalidAppointmentTransitionError extends DomainError {
  constructor(currentStatus: string, targetStatus: string) {
    super(`Invalid appointment status transition from "${currentStatus}" to "${targetStatus}".`);
    this.name = 'InvalidAppointmentTransitionError';
  }
}

export class ClinicalVisitNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Clinical visit with ID "${id}" was not found.`);
    this.name = 'ClinicalVisitNotFoundError';
  }
}

export class VisitCompletedLockedError extends DomainError {
  constructor(visitId: string) {
    super(`Clinical visit "${visitId}" is COMPLETED and locked. Modifications require an authorized clinical correction workflow.`);
    this.name = 'VisitCompletedLockedError';
  }
}

export class InvalidVisitTransitionError extends DomainError {
  constructor(currentStatus: string, targetStatus: string) {
    super(`Invalid clinical visit status transition from "${currentStatus}" to "${targetStatus}".`);
    this.name = 'InvalidVisitTransitionError';
  }
}

export class PrescriptionNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Prescription with ID "${id}" was not found.`);
    this.name = 'PrescriptionNotFoundError';
  }
}

export class PrescriptionSignedLockedError extends DomainError {
  constructor(prescriptionId: string) {
    super(`Prescription "${prescriptionId}" is SIGNED and locked. Modifications require an authorized revision workflow.`);
    this.name = 'PrescriptionSignedLockedError';
  }
}

export class InvalidPrescriptionTransitionError extends DomainError {
  constructor(currentStatus: string, targetStatus: string) {
    super(`Invalid prescription status transition from "${currentStatus}" to "${targetStatus}".`);
    this.name = 'InvalidPrescriptionTransitionError';
  }
}

export class DrugAllergyWarningError extends DomainError {
  public readonly allergenName: string;
  public readonly medicineName: string;

  constructor(medicineName: string, allergenName: string) {
    super(`Prescribed medication "${medicineName}" matches a recorded patient allergy "${allergenName}". Clinician review required.`);
    this.name = 'DrugAllergyWarningError';
    this.medicineName = medicineName;
    this.allergenName = allergenName;
  }
}

export class ClinicalCorrectionRequiredError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'ClinicalCorrectionRequiredError';
  }
}

// Phase 5 Pharmacy Domain Errors
export class MedicineNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Medicine with ID "${id}" was not found.`);
    this.name = 'MedicineNotFoundError';
  }
}

export class MedicineProductNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Medicine product/SKU with ID "${id}" was not found.`);
    this.name = 'MedicineProductNotFoundError';
  }
}

export class SupplierNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Supplier with ID "${id}" was not found.`);
    this.name = 'SupplierNotFoundError';
  }
}

export class BatchNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Inventory batch with ID "${id}" was not found.`);
    this.name = 'BatchNotFoundError';
  }
}

export class ExpiredBatchSaleError extends DomainError {
  public readonly batchNumber: string;
  public readonly expiryDate: string;

  constructor(batchNumber: string, expiryDate: string) {
    super(`Cannot sell batch "${batchNumber}" because it expired on "${expiryDate}". Sale of expired stock is forbidden.`);
    this.name = 'ExpiredBatchSaleError';
    this.batchNumber = batchNumber;
    this.expiryDate = expiryDate;
  }
}

export class InsufficientStockError extends DomainError {
  public readonly requested: number;
  public readonly available: number;

  constructor(productName: string, requested: number, available: number) {
    super(`Insufficient stock for "${productName}". Requested: ${requested}, Available: ${available}.`);
    this.name = 'InsufficientStockError';
    this.requested = requested;
    this.available = available;
  }
}

export class NegativeStockError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'NegativeStockError';
  }
}

export class SaleNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Sale with ID/Bill "${id}" was not found.`);
    this.name = 'SaleNotFoundError';
  }
}

export class PurchaseNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Purchase invoice with ID/Number "${id}" was not found.`);
    this.name = 'PurchaseNotFoundError';
  }
}

export class InvalidStockAdjustmentError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidStockAdjustmentError';
  }
}

export class SaleReturnError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'SaleReturnError';
  }
}

export class LicenseExpiredError extends DomainError {
  constructor(message = 'The MediDesk license/trial has expired. New data creation is locked, but historical records remain accessible.') {
    super(message);
    this.name = 'LicenseExpiredError';
  }
}

export class InvalidLicenseSignatureError extends DomainError {
  constructor(message = 'The cryptographic license key signature is invalid or tampered.') {
    super(message);
    this.name = 'InvalidLicenseSignatureError';
  }
}

export class CorruptBackupError extends DomainError {
  constructor(message = 'Backup verification failed: checksum mismatch or corrupt database header.') {
    super(message);
    this.name = 'CorruptBackupError';
  }
}

export class RestoreFailedError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'RestoreFailedError';
  }
}

