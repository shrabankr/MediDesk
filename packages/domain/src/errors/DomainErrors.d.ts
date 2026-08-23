export declare class DomainError extends Error {
    constructor(message: string);
}
export declare class EntityNotFoundError extends DomainError {
    constructor(entityName: string, id: string | number);
}
export declare class AuthorizationError extends DomainError {
    constructor(message?: string);
}
export declare class ValidationError extends DomainError {
    readonly errors: Record<string, string[]>;
    constructor(message: string, errors?: Record<string, string[]>);
}
export declare class SystemNotInitializedError extends DomainError {
    constructor(message?: string);
}
//# sourceMappingURL=DomainErrors.d.ts.map