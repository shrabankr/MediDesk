import { AuditEvent, CreateAuditEventDTO } from '../entities/AuditEvent.js';
export interface IAuditRepository {
    insert(event: CreateAuditEventDTO): Promise<AuditEvent>;
    listRecent(limit?: number): Promise<AuditEvent[]>;
    count(): Promise<number>;
}
//# sourceMappingURL=IAuditRepository.d.ts.map