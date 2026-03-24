export function createBlankSectionFeature(sectionId) {
    let host = null;

    return {
        id: sectionId,
        mount(context) {
            host = context.mount;
            host.dataset.activeSection = sectionId;
        },
        resume(context) {
            host = context.mount;
            host.dataset.activeSection = sectionId;
        },
        suspend() {},
        unmount() {
            host = null;
        },
    };
}
