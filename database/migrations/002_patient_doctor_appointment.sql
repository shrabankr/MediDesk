-- MediDesk Phase 3: Patient, Doctor & Appointment Schema Migration
-- Migration: 002_patient_doctor_appointment.sql

-- 1. Patients Table
CREATE TABLE IF NOT EXISTS patients (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    patient_number TEXT NOT NULL,
    full_name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    date_of_birth TEXT,
    age INTEGER,
    sex TEXT NOT NULL,
    mobile TEXT,
    normalized_mobile TEXT,
    alternate_mobile TEXT,
    address TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    merged_into_patient_id TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    updated_by TEXT,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
    FOREIGN KEY (merged_into_patient_id) REFERENCES patients(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(organization_id, patient_number)
);

CREATE INDEX IF NOT EXISTS idx_patients_org_number ON patients(organization_id, patient_number);
CREATE INDEX IF NOT EXISTS idx_patients_norm_name ON patients(normalized_name);
CREATE INDEX IF NOT EXISTS idx_patients_norm_mobile ON patients(normalized_mobile);
CREATE INDEX IF NOT EXISTS idx_patients_status ON patients(status);

-- 2. Doctors Table
CREATE TABLE IF NOT EXISTS doctors (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT UNIQUE,
    display_name TEXT NOT NULL,
    qualification TEXT NOT NULL,
    specialization TEXT NOT NULL,
    registration_number TEXT,
    mobile TEXT,
    consultation_fee REAL NOT NULL DEFAULT 0.0,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    updated_by TEXT,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_doctors_org ON doctors(organization_id);
CREATE INDEX IF NOT EXISTS idx_doctors_status ON doctors(status);
CREATE INDEX IF NOT EXISTS idx_doctors_user ON doctors(user_id);

-- 3. Doctor Schedules Table
CREATE TABLE IF NOT EXISTS doctor_schedules (
    id TEXT PRIMARY KEY,
    doctor_id TEXT NOT NULL,
    day_of_week INTEGER NOT NULL, -- 0=Sunday, 1=Monday, ..., 6=Saturday
    start_time TEXT NOT NULL,      -- HH:MM (e.g. '09:00')
    end_time TEXT NOT NULL,        -- HH:MM (e.g. '13:00')
    slot_duration_minutes INTEGER NOT NULL DEFAULT 15,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_schedules_doctor_day ON doctor_schedules(doctor_id, day_of_week);

-- 4. Appointments Table
CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    doctor_id TEXT NOT NULL,
    appointment_date TEXT NOT NULL, -- YYYY-MM-DD
    start_time TEXT NOT NULL,       -- HH:MM
    end_time TEXT NOT NULL,         -- HH:MM
    duration_minutes INTEGER NOT NULL DEFAULT 15,
    status TEXT NOT NULL DEFAULT 'SCHEDULED', -- SCHEDULED, CHECKED_IN, WAITING, IN_CONSULTATION, COMPLETED, CANCELLED, NO_SHOW
    queue_number INTEGER NOT NULL DEFAULT 1,
    visit_purpose TEXT,
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    updated_by TEXT,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_appointments_org_date ON appointments(organization_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date ON appointments(doctor_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

-- ============================================================
-- SEED PHASE 3 PERMISSIONS
-- ============================================================

INSERT OR IGNORE INTO permissions (id, code, name, category, description) VALUES
-- Doctor Management Permissions
('perm-doc-r', 'doctor.read', 'Read Doctors', 'Clinical', 'View doctor directory and profiles'),
('perm-doc-c', 'doctor.create', 'Create Doctor', 'Administration', 'Add new doctor profiles'),
('perm-doc-u', 'doctor.update', 'Update Doctor', 'Administration', 'Update doctor details and schedules'),
('perm-doc-d', 'doctor.deactivate', 'Deactivate Doctor', 'Administration', 'Deactivate doctor profiles'),

-- Appointment & Queue Permissions
('perm-apt-r', 'appointment.read', 'Read Appointments', 'Operations', 'View appointment schedule and calendar'),
('perm-apt-c', 'appointment.create', 'Create Appointment', 'Operations', 'Schedule patient appointments'),
('perm-apt-u', 'appointment.update', 'Update Appointment', 'Operations', 'Modify appointment details'),
('perm-apt-x', 'appointment.cancel', 'Cancel Appointment', 'Operations', 'Cancel patient appointments'),
('perm-apt-in', 'appointment.checkin', 'Check-in Appointment', 'Operations', 'Check-in patients upon arrival'),
('perm-apt-q', 'appointment.queue.manage', 'Manage Waiting Queue', 'Operations', 'Manage daily patient consultation queue');

-- Role Permissions: OWNER
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
('role-owner', 'perm-doc-r'),
('role-owner', 'perm-doc-c'),
('role-owner', 'perm-doc-u'),
('role-owner', 'perm-doc-d'),
('role-owner', 'perm-apt-r'),
('role-owner', 'perm-apt-c'),
('role-owner', 'perm-apt-u'),
('role-owner', 'perm-apt-x'),
('role-owner', 'perm-apt-in'),
('role-owner', 'perm-apt-q');

-- Role Permissions: DOCTOR
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
('role-doctor', 'perm-doc-r'),
('role-doctor', 'perm-apt-r'),
('role-doctor', 'perm-apt-u'),
('role-doctor', 'perm-apt-q');

-- Role Permissions: STAFF
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
('role-staff', 'perm-doc-r'),
('role-staff', 'perm-apt-r'),
('role-staff', 'perm-apt-c'),
('role-staff', 'perm-apt-u'),
('role-staff', 'perm-apt-x'),
('role-staff', 'perm-apt-in'),
('role-staff', 'perm-apt-q');

-- DEVELOPER intentionally has 0 Phase 3 business permissions.
