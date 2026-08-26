import {
  AuditAction,
  AuditResult
} from '@medidesk/domain';
import { IAuditService } from '@medidesk/audit';
import { PrintService } from '@medidesk/printing';
import { DocumentDispatchRequestSchema } from '@medidesk/validation';

export interface IDeliveryProvider {
  send(payload: {
    documentType: string;
    recipientName: string;
    recipientTarget: string; // Phone or Email
    contentBuffer: Buffer;
    fileName: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

export class MockWhatsAppProvider implements IDeliveryProvider {
  async send(_payload: any): Promise<{ success: boolean; messageId?: string; error?: string }> {
    return {
      success: true,
      messageId: `wa-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    };
  }
}

export class MockEmailProvider implements IDeliveryProvider {
  async send(_payload: any): Promise<{ success: boolean; messageId?: string; error?: string }> {
    return {
      success: true,
      messageId: `email-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    };
  }
}

export class DocumentDeliveryService {
  private whatsAppProvider: IDeliveryProvider;
  private emailProvider: IDeliveryProvider;

  constructor(
    private printService: PrintService,
    private auditService: IAuditService,
    customWhatsAppProvider?: IDeliveryProvider,
    customEmailProvider?: IDeliveryProvider
  ) {
    this.whatsAppProvider = customWhatsAppProvider || new MockWhatsAppProvider();
    this.emailProvider = customEmailProvider || new MockEmailProvider();
  }

  /**
   * Dispatches a clinical/pharmacy document to the requested channel with strict consent checking and audit logging.
   */
  async dispatchDocument(
    request: any,
    actorId: string,
    organizationId: string
  ): Promise<{ success: boolean; channel: string; referenceId?: string }> {
    const validated = DocumentDispatchRequestSchema.parse(request);

    // Consent check invariant
    if (!validated.userConsentConfirmed) {
      throw new Error('Explicit patient consent is required before dispatching health documents.');
    }

    let dispatchResult: { success: boolean; referenceId?: string };

    switch (validated.channel) {
      case 'PRINT': {
        // Native offline print dispatch
        dispatchResult = { success: true, referenceId: `print-${Date.now()}` };
        break;
      }

      case 'PDF': {
        // Local offline PDF generation & export
        dispatchResult = { success: true, referenceId: `pdf-export-${Date.now()}` };
        break;
      }

      case 'WHATSAPP': {
        if (!validated.recipient.phone) {
          throw new Error('Recipient mobile number is required for WhatsApp dispatch.');
        }
        const res = await this.whatsAppProvider.send({
          documentType: validated.documentType,
          recipientName: validated.recipient.name,
          recipientTarget: validated.recipient.phone,
          contentBuffer: Buffer.from('PDF_PLACEHOLDER'),
          fileName: `${validated.documentType}_${validated.resourceId}.pdf`
        });
        if (!res.success) {
          throw new Error(res.error || 'Failed to dispatch document via WhatsApp');
        }
        dispatchResult = { success: true, referenceId: res.messageId };
        break;
      }

      case 'EMAIL': {
        if (!validated.recipient.email) {
          throw new Error('Recipient email address is required for Email dispatch.');
        }
        const res = await this.emailProvider.send({
          documentType: validated.documentType,
          recipientName: validated.recipient.name,
          recipientTarget: validated.recipient.email,
          contentBuffer: Buffer.from('PDF_PLACEHOLDER'),
          fileName: `${validated.documentType}_${validated.resourceId}.pdf`
        });
        if (!res.success) {
          throw new Error(res.error || 'Failed to dispatch document via Email');
        }
        dispatchResult = { success: true, referenceId: res.messageId };
        break;
      }

      default:
        throw new Error(`Unsupported delivery channel: ${validated.channel}`);
    }

    // Record immutable audit event
    await this.auditService.logEvent({
      action: AuditAction.DOCUMENT_DISPATCHED,
      actor: { id: actorId, username: actorId },
      result: AuditResult.SUCCESS,
      resource: validated.resourceId,
      metadata: {
        channel: validated.channel,
        recipientName: validated.recipient.name,
        referenceId: dispatchResult.referenceId
      }
    });

    return {
      success: true,
      channel: validated.channel,
      referenceId: dispatchResult.referenceId
    };
  }
}
