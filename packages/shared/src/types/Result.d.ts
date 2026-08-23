export type Result<T, E = Error> = {
    success: true;
    data: T;
} | {
    success: false;
    error: E;
};
export declare const Result: {
    ok<T>(data: T): Result<T, never>;
    err<E>(error: E): Result<never, E>;
};
//# sourceMappingURL=Result.d.ts.map