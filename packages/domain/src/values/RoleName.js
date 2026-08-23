/**
 * System roles defined by the MediDesk architecture.
 *
 * Core separation of authority:
 * - OWNER: Business Authority (business admin, user admin, clinical/pharmacy/billing access control)
 * - DEVELOPER: Technical Authority (system administration, diagnostics, updates, configuration, support access)
 *   NOTE: DEVELOPER does NOT receive clinical, pharmacy, financial, or patient data access.
 * - DOCTOR: Clinical Authority (consultation, prescription, diagnosis)
 * - STAFF: Operational Authority (registration, billing, dispensing, inventory)
 */
export const RoleName = {
    OWNER: 'OWNER',
    DOCTOR: 'DOCTOR',
    STAFF: 'STAFF',
    DEVELOPER: 'DEVELOPER'
};
//# sourceMappingURL=RoleName.js.map