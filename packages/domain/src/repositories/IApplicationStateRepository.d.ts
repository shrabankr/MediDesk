export interface IApplicationStateRepository {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    isInitialized(): Promise<boolean>;
    setInitialized(initialOwnerId: string): Promise<void>;
}
//# sourceMappingURL=IApplicationStateRepository.d.ts.map