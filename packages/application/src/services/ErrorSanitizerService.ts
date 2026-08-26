export interface SanitizedErrorResponse {
  userMessage: string;
  code: string;
  technicalDetails?: {
    category: string;
    correlationId: string;
    timestamp: string;
  };
}

export class ErrorSanitizerService {
  /**
   * Sanitizes an error to produce safe user-facing and technical outputs.
   */
  static sanitize(
    error: any,
    correlationId: string = `corr-${Date.now()}`
  ): SanitizedErrorResponse {
    const rawMessage = error instanceof Error ? error.message : String(error);
    const code = error?.code || 'OPERATION_FAILED';

    let userMessage = 'An unexpected error occurred. Please try again or contact support.';
    let category = 'GENERAL_ERROR';

    // 1. SQLite lock / concurrency
    if (rawMessage.includes('SQLITE_BUSY') || rawMessage.includes('database is locked')) {
      userMessage = 'The system is currently processing another transaction. Please wait a moment and try again.';
      category = 'DATABASE_BUSY';
    }
    // 2. Insufficient inventory stock
    else if (rawMessage.includes('Insufficient stock') || rawMessage.includes('INSUFFICIENT_STOCK')) {
      userMessage = 'Insufficient inventory stock available for the requested batch/product.';
      category = 'INVENTORY_STOCK';
    }
    // 3. Expired batch sale attempt
    else if (rawMessage.includes('expired') || rawMessage.includes('EXPIRED_BATCH')) {
      userMessage = 'Cannot dispense medicine: The selected batch has expired and cannot be sold.';
      category = 'SAFETY_EXPIRED_BATCH';
    }
    // 4. Duplicate entity
    else if (rawMessage.includes('UNIQUE constraint failed') || rawMessage.includes('already exists')) {
      userMessage = 'A record with these details already exists in the system.';
      category = 'DUPLICATE_ENTITY';
    }
    // 5. Network / LAN disconnected
    else if (rawMessage.includes('ECONNREFUSED') || rawMessage.includes('LAN server') || rawMessage.includes('DISCONNECTED')) {
      userMessage = 'Unable to communicate with the main clinic server. Please check network connection.';
      category = 'NETWORK_LAN';
    }
    // 6. License expired / read only
    else if (rawMessage.includes('license') && (rawMessage.includes('expired') || rawMessage.includes('read-only'))) {
      userMessage = 'The clinic license has expired. The application is operating in read-only mode.';
      category = 'LICENSING';
    }
    // 7. Validation errors
    else if (rawMessage.includes('Validation failed') || rawMessage.includes('ZodError')) {
      userMessage = 'Please verify that all required fields are filled out correctly.';
      category = 'VALIDATION';
    }
    // 8. Disk space low
    else if (rawMessage.includes('ENOSPC') || rawMessage.includes('disk space')) {
      userMessage = 'Disk storage space is critically low. Please free up disk space.';
      category = 'DISK_SPACE';
    } else if (rawMessage && !rawMessage.includes('SELECT') && !rawMessage.includes('INSERT') && !rawMessage.includes('UPDATE')) {
      // Safe domain error message
      userMessage = rawMessage;
    }

    return {
      userMessage,
      code,
      technicalDetails: {
        category,
        correlationId,
        timestamp: new Date().toISOString()
      }
    };
  }
}
