# Doctor Directory & Availability Schedule Architecture

**Status:** CURRENT (Phase 3 Verified)

---

## 1. Doctor Entity & Decoupling

- **Doctor Profile**: Contains professional profile attributes:
  - `displayName`: e.g. "Dr. Suresh Sen"
  - `qualification`: e.g. "MBBS, MD (Medicine)"
  - `specialization`: e.g. "Internal Medicine"
  - `registrationNumber`: MCI / State medical council number
  - `mobile`: Optional doctor contact
  - `consultationFee`: Standard consultation charge (INR)
  - `status`: `ACTIVE` | `INACTIVE`
- **Decoupled Login**: A Doctor profile can exist independently or optionally associate with a user account (`user_id`). Not every doctor profile requires system login credentials.

---

## 2. Weekly Availability Schedule

- Day-of-week slots (0=Sunday to 6=Saturday).
- Attributes per slot: `startTime` (HH:MM), `endTime` (HH:MM), `slotDurationMinutes` (default 15m), `isActive` (boolean).
- Constraints: `startTime < endTime` strictly enforced by Zod schema and repository queries.

---

## 3. Booking Guards

1. **Active Status Guard**: Inactive doctors cannot be booked for new appointments (`DoctorInactiveError`).
2. **Schedule Guard**: Appointments scheduled on non-working days or outside active schedule windows are rejected (`OutsideDoctorScheduleError`).
3. **Historical Integrity**: Inactive doctors remain permanently linked to historical appointments for clinical audit records.
