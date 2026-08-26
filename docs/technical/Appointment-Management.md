# Appointment Management & Live Waiting Queue Architecture

**Status:** CURRENT (Phase 3 Verified)

---

## 1. Appointment State Machine

```
                 +--------------+
                 |  SCHEDULED   |
                 +--------------+
                   /     |      \
                  /      |       \
                 v       v        v
        +-----------+ +-------+ +----------+
        |CHECKED_IN | |CANCEL | | NO_SHOW  |
        +-----------+ +-------+ +----------+
           /     \       (terminal) (terminal)
          /       \
         v         v
    +---------+  +-----------------+
    | WAITING |  | IN_CONSULTATION |
    +---------+  +-----------------+
         \               /      ^
          \             /       | (re-queue)
           \           v        |
            \    +-----------+  |
             +-->| COMPLETED |--+
                 +-----------+
                   (terminal)
```

### Transition Rules
- `SCHEDULED` $\rightarrow$ `CHECKED_IN`, `WAITING`, `CANCELLED`, `NO_SHOW`
- `CHECKED_IN` $\rightarrow$ `WAITING`, `IN_CONSULTATION`, `CANCELLED`
- `WAITING` $\rightarrow$ `IN_CONSULTATION`, `CANCELLED`
- `IN_CONSULTATION` $\rightarrow$ `COMPLETED`, `WAITING`
- `COMPLETED`, `CANCELLED`, `NO_SHOW` are terminal states and cannot be re-opened.
- Unauthorized transitions throw `InvalidAppointmentTransitionError`.

---

## 2. Double-Booking & Conflict Prevention

Conflict detection query evaluated on booking and reschedule:
```sql
SELECT id, start_time, end_time FROM appointments
WHERE doctor_id = ?
  AND appointment_date = ?
  AND status != 'CANCELLED'
  AND (start_time < :newEndTime AND end_time > :newStartTime)
  [AND id != :excludeId]
```
If any overlapping records exist, `AppointmentConflictError` is thrown with exact conflict timestamps.

---

## 3. Daily Waiting Queue

- Appointments are assigned a daily sequential token (`queue_number`: 1, 2, 3...) per organization and date.
- The queue view returns active appointments for a specific date, ordered by `queue_number ASC, start_time ASC`.
- Real-time operational metrics count: `total`, `scheduled`, `checkedIn`, `waiting`, `inConsultation`, `completed`, `cancelled`, and `noShow`.
