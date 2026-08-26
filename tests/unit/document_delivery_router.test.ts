import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DocumentDeliveryService, IDeliveryProvider } from '@medidesk/application';
import { PrintService } from '@medidesk/printing';
import { IAuditService } from '@medidesk/audit';

describe('Phase 8F: DocumentDeliveryService & Privacy Consent Gates', () => {
  let service: DocumentDeliveryService;
  let mockPrintService: Partial<PrintService>;
  let mockAuditService: Partial<IAuditService>;
  let mockWhatsAppProvider: IDeliveryProvider;
  let mockEmailProvider: IDeliveryProvider;

  beforeEach(() => {
    mockPrintService = {
      printPrescription: vi.fn().mockResolvedValue({ success: true, jobId: 'print-job-1' }),
      printInvoice: vi.fn().mockResolvedValue({ success: true, jobId: 'print-job-2' })
    };

    mockAuditService = {
      logEvent: vi.fn().mockResolvedValue(undefined as any)
    };

    mockWhatsAppProvider = {
      send: vi.fn().mockResolvedValue({ success: true, messageId: 'wa-msg-101' })
    };

    mockEmailProvider = {
      send: vi.fn().mockResolvedValue({ success: true, messageId: 'email-msg-202' })
    };

    service = new DocumentDeliveryService(
      mockPrintService as PrintService,
      mockAuditService as IAuditService,
      mockWhatsAppProvider,
      mockEmailProvider
    );
  });

  describe('Privacy Consent Invariant', () => {
    it('blocks dispatch when userConsentConfirmed is false', async () => {
      await expect(
        service.dispatchDocument(
          {
            documentType: 'PRESCRIPTION',
            resourceId: 'rx-101',
            channel: 'WHATSAPP',
            recipient: { name: 'John Doe', phone: '+919876543210' },
            userConsentConfirmed: false
          },
          'user-doctor-1',
          'org-1'
        )
      ).rejects.toThrow('Explicit patient/user consent must be confirmed');
    });
  });

  describe('Multi-Channel Dispatch Routing & Audit', () => {
    it('dispatches to WhatsApp with verified phone number and logs audit event', async () => {
      const result = await service.dispatchDocument(
        {
          documentType: 'PRESCRIPTION',
          resourceId: 'rx-101',
          channel: 'WHATSAPP',
          recipient: { name: 'John Doe', phone: '+919876543210' },
          userConsentConfirmed: true
        },
        'user-doctor-1',
        'org-1'
      );

      expect(result.success).toBe(true);
      expect(result.channel).toBe('WHATSAPP');
      expect(result.referenceId).toBe('wa-msg-101');
      expect(mockWhatsAppProvider.send).toHaveBeenCalled();
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DOCUMENT_DISPATCHED',
          resource: 'rx-101'
        })
      );
    });

    it('dispatches to Email with valid address', async () => {
      const result = await service.dispatchDocument(
        {
          documentType: 'INVOICE',
          resourceId: 'inv-808',
          channel: 'EMAIL',
          recipient: { name: 'Jane Doe', email: 'jane.doe@example.com' },
          userConsentConfirmed: true
        },
        'user-staff-1',
        'org-1'
      );

      expect(result.success).toBe(true);
      expect(result.channel).toBe('EMAIL');
      expect(result.referenceId).toBe('email-msg-202');
    });

    it('operates 100% offline for local PDF exports', async () => {
      const result = await service.dispatchDocument(
        {
          documentType: 'CLINICAL_SUMMARY',
          resourceId: 'visit-909',
          channel: 'PDF',
          recipient: { name: 'Local Export' },
          userConsentConfirmed: true
        },
        'user-doctor-1',
        'org-1'
      );

      expect(result.success).toBe(true);
      expect(result.channel).toBe('PDF');
    });
  });
});
