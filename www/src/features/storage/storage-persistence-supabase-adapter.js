export function createStoragePersistenceSupabaseAdapter({ client = null } = {}) {
    return {
        client,
        async load() {
            throw new Error('Supabase storage persistence is not wired in this phase.');
        },
        async save() {
            throw new Error('Supabase storage persistence is not wired in this phase.');
        },
    };
}
