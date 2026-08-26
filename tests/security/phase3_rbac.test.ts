import { describe, it, expect } from 'vitest';
import { RBACEngine } from '@medidesk/authorization';
import { RoleName, PermissionCode } from '@medidesk/domain';

describe('Phase 3 Security & RBAC Boundary Enforcement', () => {
  const rbac = new RBACEngine();

  describe('Developer Role Privilege Separation & Strict Data Denial', () => {
    const devRoles = [RoleName.DEVELOPER];

    it('denies DEVELOPER all Patient permissions by default', () => {
      expect(rbac.evaluatePermission(devRoles, PermissionCode.PATIENT_CREATE)).toBe(false);
      expect(rbac.evaluatePermission(devRoles, PermissionCode.PATIENT_READ)).toBe(false);
      expect(rbac.evaluatePermission(devRoles, PermissionCode.PATIENT_UPDATE)).toBe(false);
    });

    it('denies DEVELOPER all Doctor permissions by default', () => {
      expect(rbac.evaluatePermission(devRoles, PermissionCode.DOCTOR_CREATE)).toBe(false);
      expect(rbac.evaluatePermission(devRoles, PermissionCode.DOCTOR_READ)).toBe(false);
      expect(rbac.evaluatePermission(devRoles, PermissionCode.DOCTOR_UPDATE)).toBe(false);
      expect(rbac.evaluatePermission(devRoles, PermissionCode.DOCTOR_DEACTIVATE)).toBe(false);
    });

    it('denies DEVELOPER all Appointment & Queue permissions by default', () => {
      expect(rbac.evaluatePermission(devRoles, PermissionCode.APPOINTMENT_CREATE)).toBe(false);
      expect(rbac.evaluatePermission(devRoles, PermissionCode.APPOINTMENT_READ)).toBe(false);
      expect(rbac.evaluatePermission(devRoles, PermissionCode.APPOINTMENT_UPDATE)).toBe(false);
      expect(rbac.evaluatePermission(devRoles, PermissionCode.APPOINTMENT_CHECKIN)).toBe(false);
      expect(rbac.evaluatePermission(devRoles, PermissionCode.APPOINTMENT_QUEUE_MANAGE)).toBe(false);
      expect(rbac.evaluatePermission(devRoles, PermissionCode.APPOINTMENT_CANCEL)).toBe(false);
    });
  });

  describe('Staff Role Operational Boundary', () => {
    const staffRoles = [RoleName.STAFF];

    it('allows STAFF to register, search, and update patients', () => {
      expect(rbac.evaluatePermission(staffRoles, PermissionCode.PATIENT_CREATE)).toBe(true);
      expect(rbac.evaluatePermission(staffRoles, PermissionCode.PATIENT_READ)).toBe(true);
      expect(rbac.evaluatePermission(staffRoles, PermissionCode.PATIENT_UPDATE)).toBe(true);
    });

    it('allows STAFF to view doctors but not create or deactivate doctor profiles', () => {
      expect(rbac.evaluatePermission(staffRoles, PermissionCode.DOCTOR_READ)).toBe(true);
      expect(rbac.evaluatePermission(staffRoles, PermissionCode.DOCTOR_CREATE)).toBe(false);
      expect(rbac.evaluatePermission(staffRoles, PermissionCode.DOCTOR_DEACTIVATE)).toBe(false);
    });

    it('allows STAFF to manage appointments, check-in, and waiting queue', () => {
      expect(rbac.evaluatePermission(staffRoles, PermissionCode.APPOINTMENT_CREATE)).toBe(true);
      expect(rbac.evaluatePermission(staffRoles, PermissionCode.APPOINTMENT_READ)).toBe(true);
      expect(rbac.evaluatePermission(staffRoles, PermissionCode.APPOINTMENT_UPDATE)).toBe(true);
      expect(rbac.evaluatePermission(staffRoles, PermissionCode.APPOINTMENT_CHECKIN)).toBe(true);
      expect(rbac.evaluatePermission(staffRoles, PermissionCode.APPOINTMENT_QUEUE_MANAGE)).toBe(true);
      expect(rbac.evaluatePermission(staffRoles, PermissionCode.APPOINTMENT_CANCEL)).toBe(true);
    });

    it('strictly denies STAFF administrative and developer privileges', () => {
      expect(rbac.evaluatePermission(staffRoles, PermissionCode.USER_CREATE)).toBe(false);
      expect(rbac.evaluatePermission(staffRoles, PermissionCode.USER_UPDATE)).toBe(false);
      expect(rbac.evaluatePermission(staffRoles, PermissionCode.ROLE_ASSIGN)).toBe(false);
      expect(rbac.evaluatePermission(staffRoles, PermissionCode.SYSTEM_CONFIG_UPDATE)).toBe(false);
    });
  });

  describe('Doctor Role Clinical & Queue Boundary', () => {
    const doctorRoles = [RoleName.DOCTOR];

    it('allows DOCTOR to read patients and manage appointment queue', () => {
      expect(rbac.evaluatePermission(doctorRoles, PermissionCode.PATIENT_READ)).toBe(true);
      expect(rbac.evaluatePermission(doctorRoles, PermissionCode.DOCTOR_READ)).toBe(true);
      expect(rbac.evaluatePermission(doctorRoles, PermissionCode.APPOINTMENT_READ)).toBe(true);
      expect(rbac.evaluatePermission(doctorRoles, PermissionCode.APPOINTMENT_QUEUE_MANAGE)).toBe(true);
    });

    it('denies DOCTOR administrative user management privileges', () => {
      expect(rbac.evaluatePermission(doctorRoles, PermissionCode.USER_CREATE)).toBe(false);
      expect(rbac.evaluatePermission(doctorRoles, PermissionCode.USER_DISABLE)).toBe(false);
    });
  });

  describe('Owner Full Business Authority', () => {
    const ownerRoles = [RoleName.OWNER];

    it('allows OWNER full authority over patients, doctors, and appointments', () => {
      expect(rbac.evaluatePermission(ownerRoles, PermissionCode.PATIENT_CREATE)).toBe(true);
      expect(rbac.evaluatePermission(ownerRoles, PermissionCode.PATIENT_READ)).toBe(true);
      expect(rbac.evaluatePermission(ownerRoles, PermissionCode.PATIENT_UPDATE)).toBe(true);
      expect(rbac.evaluatePermission(ownerRoles, PermissionCode.DOCTOR_CREATE)).toBe(true);
      expect(rbac.evaluatePermission(ownerRoles, PermissionCode.DOCTOR_READ)).toBe(true);
      expect(rbac.evaluatePermission(ownerRoles, PermissionCode.DOCTOR_UPDATE)).toBe(true);
      expect(rbac.evaluatePermission(ownerRoles, PermissionCode.DOCTOR_DEACTIVATE)).toBe(true);
      expect(rbac.evaluatePermission(ownerRoles, PermissionCode.APPOINTMENT_CREATE)).toBe(true);
      expect(rbac.evaluatePermission(ownerRoles, PermissionCode.APPOINTMENT_READ)).toBe(true);
      expect(rbac.evaluatePermission(ownerRoles, PermissionCode.APPOINTMENT_UPDATE)).toBe(true);
      expect(rbac.evaluatePermission(ownerRoles, PermissionCode.APPOINTMENT_CHECKIN)).toBe(true);
      expect(rbac.evaluatePermission(ownerRoles, PermissionCode.APPOINTMENT_QUEUE_MANAGE)).toBe(true);
      expect(rbac.evaluatePermission(ownerRoles, PermissionCode.APPOINTMENT_CANCEL)).toBe(true);
    });
  });
});
