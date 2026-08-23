export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class EntityNotFoundError extends DomainError {
  constructor(entityName: string, id: string | number) {
    super(`${entityName} with identifier "${id}" was not found.`);
    this.name = 'EntityNotFoundError';
  }
}

export class AuthorizationError extends DomainError {
  constructor(message = 'User is not authorized to perform this operation.') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class ValidationError extends DomainError {
  public readonly errors: Record<string, string[]>;

  constructor(message: string, errors: Record<string, string[]> = {}) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

export class SystemNotInitializedError extends DomainError {
  constructor(message = 'MediDesk has not been initialized. Please complete initial setup.') {
    super(message);
    this.name = 'SystemNotInitializedError';
  }
}
