import { describe, it, expect } from 'vitest';
import {
  CreateOrganizationSchema,
  CreateUserSchema,
  LoginRequestSchema,
  validateSchema
} from '@medidesk/validation';
import { RoleName } from '@medidesk/domain';

describe('Validation Schemas & Boundary Enforcement', () => {
  it('should validate valid organization input', () => {
    const validData = {
      name: 'City Care Hospital',
      code: 'CITY_CARE',
      currency: 'INR',
      timezone: 'Asia/Kolkata'
    };

    const result = validateSchema(CreateOrganizationSchema, validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('City Care Hospital');
      expect(result.data.code).toBe('CITY_CARE');
    }
  });

  it('should reject invalid organization codes', () => {
    const invalidData = {
      name: 'Clinic',
      code: 'invalid code with spaces!'
    };

    const result = validateSchema(CreateOrganizationSchema, invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors['code']).toBeDefined();
    }
  });

  it('should enforce password strength in user creation', () => {
    const weakUser = {
      organizationId: 'org-1',
      username: 'doctor_smith',
      email: 'doctor@hospital.com',
      fullName: 'Dr. Smith',
      password: 'weak', // too short, no uppercase, no numbers
      roles: [RoleName.DOCTOR]
    };

    const result = validateSchema(CreateUserSchema, weakUser);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors['password']).toBeDefined();
    }

    const strongUser = {
      ...weakUser,
      password: 'SecurePassword123!'
    };

    const validResult = validateSchema(CreateUserSchema, strongUser);
    expect(validResult.success).toBe(true);
  });

  it('should validate login request inputs', () => {
    const validLogin = {
      username: 'admin',
      password: 'password123'
    };

    const result = validateSchema(LoginRequestSchema, validLogin);
    expect(result.success).toBe(true);
  });
});
