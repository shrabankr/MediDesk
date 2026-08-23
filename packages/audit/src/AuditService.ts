import {
  AuditEvent,
  CreateAuditEventDTO,
  IAuditRepository,
  AuditAction,
  AuditResult
} from '@medidesk/domain';
import { Logger } from '@medidesk/shared';

const SENSITIVE_AUDIT_KEYS = new Set([
  'password',
  'passwordhash',
  'secret',
  'token',
  'privatekey',
  'developertoken',
  'creditcard'
]);

export interface IAuditService {
  logEvent(dto: CreateAuditEventDTO): Promise<AuditEvent>;
  logSystemInitialized(actorId: string, actorUsername: string, metadata?: Record<string, unknown>): Promise<AuditEvent>;
  getRecentEvents(limit?: number): Promise<AuditEvent[]>;
}

export class AuditService implements IAuditService {
  private repository: IAuditRepository;
  private logger: Logger;

  constructor(repository: IAuditRepository) {
    this.repository = repository;
    this.logger = new Logger('AuditService');
  }

  private sanitizeMetadata(data: unknown): unknown {
    if (data === null || data === undefined) return data;
    if (typeof data === 'string') return data;
    if (Array.isArray(data)) return data.map((item) => this.sanitizeMetadata(item));
    if (typeof data === 'object') {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
        if (SENSITIVE_AUDIT_KEYS.has(k.toLowerCase())) {
          result[k] = '[REDACTED]';
        } else {
          result[k] = this.sanitizeMetadata(v);
        }
      }
      return result;
    }
    return data;
  }

  public async logEvent(dto: CreateAuditEventDTO): Promise<AuditEvent> {
    const sanitizedMeta = dto.metadata
      ? (this.sanitizeMetadata(dto.metadata) as Record<string, unknown>)
      : undefined;

    const eventToSave: CreateAuditEventDTO = {
      ...dto,
      metadata: sanitizedMeta
    };

    try {
      const saved = await this.repository.insert(eventToSave);
      this.logger.info(`Audit logged: [${saved.action}] by [${saved.actor.username}] - Result: ${saved.result}`);
      return saved;
    } catch (error) {
      this.logger.error('Failed to persist audit event', error);
      throw error;
    }
  }

  public async logSystemInitialized(
    actorId: string,
    actorUsername: string,
    metadata?: Record<string, unknown>
  ): Promise<AuditEvent> {
    return this.logEvent({
      action: AuditAction.SYSTEM_INITIALIZED,
      actor: {
        id: actorId,
        username: actorUsername,
        role: 'DEVELOPER'
      },
      target: 'System',
      result: AuditResult.SUCCESS,
      reason: 'First-time setup completed successfully',
      metadata
    });
  }

  public async getRecentEvents(limit = 50): Promise<AuditEvent[]> {
    return this.repository.listRecent(limit);
  }
}
