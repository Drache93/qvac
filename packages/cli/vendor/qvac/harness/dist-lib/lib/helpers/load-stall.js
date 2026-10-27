export function createLoadStall(ms, stalled) {
    let timer = null;
    let rejectStall = null;
    const promise = new Promise((_, reject) => {
        rejectStall = reject;
    });
    const arm = () => {
        if (timer !== null) {
            clearTimeout(timer);
        }
        timer = setTimeout(() => {
            rejectStall?.(stalled());
        }, ms);
    };
    arm();
    return {
        bump: arm,
        clear: () => {
            if (timer !== null) {
                clearTimeout(timer);
            }
            timer = null;
        },
        promise
    };
}
