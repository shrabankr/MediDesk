-- MediDesk Phase 4: Clinical Consultation, Medical Records & Versioned Prescriptions
-- Migration: 003_clinical_consultation_prescription.sql

-- 1. Clinical Visits Table
CREATE TABLE IF NOT EXISTS clinical_visits (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    doctor_id TEXT NOT NULL,
    appointment_id TEXT,
    visit_date_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'OPEN', -- OPEN, IN_PROGRESS, COMPLETED, CANCELLED
    chief_complaint TEXT,
    history_of_present_illness TEXT,
    examination_notes TEXT,
    clinical_assessment TEXT,
    completed_at DATETIME,
    has_corrections INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    updated_by TEXT,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE RESTRICT,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_visits_org ON clinical_visits(organization_id);
CREATE INDEX IF NOT EXISTS idx_visits_patient ON clinical_visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_doctor ON clinical_visits(doctor_id);
CREATE INDEX IF NOT EXISTS idx_visits_appointment ON clinical_visits(appointment_id);
CREATE INDEX IF NOT EXISTS idx_visits_status ON clinical_visits(status);
CREATE INDEX IF NOT EXISTS idx_visits_date ON clinical_visits(visit_date_time);

-- 2. Vitals Table
CREATE TABLE IF NOT EXISTS vitals (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    clinical_visit_id TEXT,
    temperature REAL,
    temperature_unit TEXT NOT NULL DEFAULT 'FAHRENHEIT', -- CELSIUS, FAHRENHEIT
    pulse_rate INTEGER, -- bpm
    respiratory_rate INTEGER, -- breaths/min
    systolic_bp INTEGER, -- mmHg
    diastolic_bp INTEGER, -- mmHg
    oxygen_saturation_spo2 REAL, -- %
    weight_kg REAL, -- kg
    height_cm REAL, -- cm
    bmi REAL, -- calculated
    notes TEXT,
    recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    recorded_by TEXT,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT,
    FOREIGN KEY (clinical_visit_id) REFERENCES clinical_visits(id) ON DELETE CASCADE,
    FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_vitals_org ON vitals(organization_id);
CREATE INDEX IF NOT EXISTS idx_vitals_patient ON vitals(patient_id);
CREATE INDEX IF NOT EXISTS idx_vitals_visit ON vitals(clinical_visit_id);
CREATE INDEX IF NOT EXISTS idx_vitals_recorded_at ON vitals(recorded_at);

-- 3. Allergies & Clinical Alerts Table
CREATE TABLE IF NOT EXISTS allergies (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'KNOWN', -- KNOWN, DENIED, UNKNOWN
    allergen_name TEXT, -- e.g. Penicillin, Sulfa, Peanuts
    category TEXT NOT NULL DEFAULT 'DRUG', -- DRUG, FOOD, ENVIRONMENTAL, OTHER
    severity TEXT NOT NULL DEFAULT 'MODERATE', -- MILD, MODERATE, SEVERE, LIFE_THREATENING
    reaction TEXT, -- e.g. Skin Rash, Anaphylaxis, Swelling
    notes TEXT,
    recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    recorded_by TEXT,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT,
    FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_allergies_org ON allergies(organization_id);
CREATE INDEX IF NOT EXISTS idx_allergies_patient ON allergies(patient_id);
CREATE INDEX IF NOT EXISTS idx_allergies_status ON allergies(status);
CREATE INDEX IF NOT EXISTS idx_allergies_category ON allergies(category);

-- 4. Medical History Table
CREATE TABLE IF NOT EXISTS medical_history (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'PAST_MEDICAL', -- PAST_MEDICAL, PAST_SURGICAL, FAMILY, SOCIAL, MEDICATION_HISTORY
    description TEXT NOT NULL,
    diagnosed_date TEXT, -- e.g. 2021, 2021-05, 5 years ago
    is_active INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    recorded_by TEXT,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT,
    FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_history_org ON medical_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_history_patient ON medical_history(patient_id);
CREATE INDEX IF NOT EXISTS idx_history_category ON medical_history(category);

-- 5. Diagnoses Table
CREATE TABLE IF NOT EXISTS diagnoses (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    clinical_visit_id TEXT,
    doctor_id TEXT NOT NULL,
    diagnosis_text TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'PRIMARY', -- PRIMARY, SECONDARY, PROVISIONAL, DIFFERENTIAL
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, RESOLVED, RULED_OUT
    code_system TEXT, -- e.g. ICD-10
    code_value TEXT, -- e.g. J06.9
    notes TEXT,
    recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    recorded_by TEXT,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT,
    FOREIGN KEY (clinical_visit_id) REFERENCES clinical_visits(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE RESTRICT,
    FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_diagnoses_org ON diagnoses(organization_id);
CREATE INDEX IF NOT EXISTS idx_diagnoses_patient ON diagnoses(patient_id);
CREATE INDEX IF NOT EXISTS idx_diagnoses_visit ON diagnoses(clinical_visit_id);
CREATE INDEX IF NOT EXISTS idx_diagnoses_doctor ON diagnoses(doctor_id);
CREATE INDEX IF NOT EXISTS idx_diagnoses_type ON diagnoses(type);

-- 6. Prescriptions Table
CREATE TABLE IF NOT EXISTS prescriptions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    doctor_id TEXT NOT NULL,
    clinical_visit_id TEXT,
    status TEXT NOT NULL DEFAULT 'DRAFT', -- DRAFT, SIGNED, CANCELLED, SUPERSEDED
    current_version_number INTEGER NOT NULL DEFAULT 1,
    signed_at DATETIME,
    signed_by TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    updated_by TEXT,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE RESTRICT,
    FOREIGN KEY (clinical_visit_id) REFERENCES clinical_visits(id) ON DELETE SET NULL,
    FOREIGN KEY (signed_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_org ON prescriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor ON prescriptions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_visit ON prescriptions(clinical_visit_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON prescriptions(status);

-- 7. Prescription Versions Table
CREATE TABLE IF NOT EXISTS prescription_versions (
    id TEXT PRIMARY KEY,
    prescription_id TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, SUPERSEDED, CANCELLED
    reason_for_change TEXT,
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(prescription_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_rx_versions_rx ON prescription_versions(prescription_id);

-- 8. Prescription Items Table
CREATE TABLE IF NOT EXISTS prescription_items (
    id TEXT PRIMARY KEY,
    prescription_version_id TEXT NOT NULL,
    medicine_name TEXT NOT NULL,
    generic_name TEXT,
    strength TEXT, -- e.g. 500 mg, 10 ml
    dosage_form TEXT NOT NULL DEFAULT 'TABLET', -- TABLET, CAPSULE, SYRUP, INJECTION, DROPS, OINTMENT, INHALER, OTHER
    route TEXT NOT NULL DEFAULT 'ORAL', -- ORAL, TOPICAL, INTRAVENOUS, INTRAMUSCULAR, INHALATION, OPHTHALMIC, OTHER
    frequency TEXT NOT NULL, -- e.g. 1-0-1, 1-1-1, Once daily, PRN
    duration_value INTEGER, -- e.g. 5
    duration_unit TEXT NOT NULL DEFAULT 'DAYS', -- DAYS, WEEKS, MONTHS
    instructions TEXT, -- e.g. After meals, With warm water
    quantity INTEGER, -- Total count / bottles
    is_substitution_allowed INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (prescription_version_id) REFERENCES prescription_versions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rx_items_version ON prescription_items(prescription_version_id);
CREATE INDEX IF NOT EXISTS idx_rx_items_medicine ON prescription_items(medicine_name);

-- 9. Follow-Ups Table
CREATE TABLE IF NOT EXISTS follow_ups (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    doctor_id TEXT NOT NULL,
    clinical_visit_id TEXT,
    follow_up_date DATE NOT NULL,
    instructions TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, COMPLETED, CANCELLED
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    updated_by TEXT,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE RESTRICT,
    FOREIGN KEY (clinical_visit_id) REFERENCES clinical_visits(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_followups_org ON follow_ups(organization_id);
CREATE INDEX IF NOT EXISTS idx_followups_patient ON follow_ups(patient_id);
CREATE INDEX IF NOT EXISTS idx_followups_doctor ON follow_ups(doctor_id);
CREATE INDEX IF NOT EXISTS idx_followups_date ON follow_ups(follow_up_date);
CREATE INDEX IF NOT EXISTS idx_followups_status ON follow_ups(status);

-- 10. Clinical Corrections Table
CREATE TABLE IF NOT EXISTS clinical_corrections (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    resource_type TEXT NOT NULL, -- CLINICAL_VISIT, PRESCRIPTION
    resource_id TEXT NOT NULL,
    prior_state_json TEXT NOT NULL,
    corrected_state_json TEXT NOT NULL,
    reason TEXT NOT NULL,
    requested_by TEXT NOT NULL,
    approved_by TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
    FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_corrections_org ON clinical_corrections(organization_id);
CREATE INDEX IF NOT EXISTS idx_corrections_resource ON clinical_corrections(resource_type, resource_id);

-- Seed Phase 4 Permissions
INSERT OR IGNORE INTO permissions (id, code, description) VALUES
    ('perm-clinical-read', 'clinical.read', 'View clinical encounters and medical records'),
    ('perm-clinical-create', 'clinical.create', 'Open new clinical encounters'),
    ('perm-clinical-update', 'clinical.update', 'Modify in-progress clinical encounters'),
    ('perm-clinical-complete', 'clinical.complete', 'Complete and lock clinical encounters'),
    ('perm-clinical-correct', 'clinical.correct', 'Submit audited corrections to completed clinical records'),
    ('perm-vitals-read', 'vitals.read', 'View patient vitals telemetry'),
    ('perm-vitals-create', 'vitals.create', 'Record patient vitals telemetry'),
    ('perm-vitals-update', 'vitals.update', 'Modify recorded patient vitals telemetry'),
    ('perm-diagnosis-read', 'diagnosis.read', 'View patient clinical diagnoses'),
    ('perm-diagnosis-create', 'diagnosis.create', 'Record clinical diagnoses'),
    ('perm-diagnosis-update', 'diagnosis.update', 'Modify clinical diagnoses'),
    ('perm-history-read', 'history.read', 'View patient medical and surgical history'),
    ('perm-history-create', 'history.create', 'Record patient medical and surgical history'),
    ('perm-history-update', 'history.update', 'Modify patient medical and surgical history'),
    ('perm-allergy-read', 'allergy.read', 'View patient allergies and alerts'),
    ('perm-allergy-create', 'allergy.create', 'Record patient allergies and alerts'),
    ('perm-allergy-update', 'allergy.update', 'Modify patient allergies and alerts'),
    ('perm-prescription-read', 'prescription.read', 'View patient prescriptions'),
    ('perm-prescription-create', 'prescription.create', 'Author draft prescriptions'),
    ('perm-prescription-update', 'prescription.update', 'Modify draft prescriptions'),
    ('perm-prescription-sign', 'prescription.sign', 'Sign and finalize prescriptions'),
    ('perm-prescription-cancel', 'prescription.cancel', 'Cancel prescriptions'),
    ('perm-followup-read', 'followup.read', 'View follow-up reminders'),
    ('perm-followup-create', 'followup.create', 'Schedule patient follow-ups'),
    ('perm-followup-update', 'followup.update', 'Modify patient follow-ups');

-- Map Phase 4 Permissions to Foundational Roles
-- OWNER has all clinical business permissions
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'role-owner', id FROM permissions WHERE code LIKE 'clinical.%' OR code LIKE 'vitals.%' OR code LIKE 'diagnosis.%' OR code LIKE 'history.%' OR code LIKE 'allergy.%' OR code LIKE 'prescription.%' OR code LIKE 'followup.%';

-- DOCTOR has clinical authoring permissions
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'role-doctor', id FROM permissions WHERE code LIKE 'clinical.%' OR code LIKE 'vitals.%' OR code LIKE 'diagnosis.%' OR code LIKE 'history.%' OR code LIKE 'allergy.%' OR code LIKE 'prescription.%' OR code LIKE 'followup.%';

-- STAFF default permissions (Vitals recording, allergy reading, follow-up management)
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'role-staff', id FROM permissions WHERE code IN ('vitals.read', 'vitals.create', 'vitals.update', 'allergy.read', 'followup.read', 'followup.create', 'followup.update');

-- DEVELOPER is strictly DENIED all Phase 4 clinical permissions (zero insertions for role-developer).
