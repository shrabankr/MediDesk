export const Result = {
    ok(data) {
        return { success: true, data };
    },
    err(error) {
        return { success: false, error };
    }
};
//# sourceMappingURL=Result.js.map