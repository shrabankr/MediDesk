import { z } from 'zod';

export const DocumentTypeEnum = z.enum(['PRESCRIPTION', 'INVOICE', 'RECEIPT', 'CLINICAL_SUMMARY']);
export const DeliveryChannelEnum = z.enum(['PRINT', 'PDF', 'WHATSAPP', 'EMAIL']);

export const DocumentDispatchRequestSchema = z.object({
  documentType: DocumentTypeEnum,
  resourceId: z.string().min(1, 'Resource ID is required'),
  channel: DeliveryChannelEnum,
  recipient: z.object({
    name: z.string().min(1),
    phone: z.string().regex(/^\+?[1-9]\d{9,14}$/, 'Invalid phone number').optional(),
    email: z.string().email('Invalid email address').optional()
  }),
  userConsentConfirmed: z.literal(true, {
    errorMap: () => ({ message: 'Explicit patient/user consent must be confirmed before dispatch' })
  }),
  formatOptions: z.object({
    paperSize: z.enum(['A4', 'A5', '58mm', '80mm']).default('A4'),
    includeClinicHeader: z.boolean().default(true),
    includeDigitalSignature: z.boolean().default(true)
  }).optional()
});
