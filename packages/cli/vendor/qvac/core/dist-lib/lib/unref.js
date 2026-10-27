export function unref(timer) {
    if (typeof timer !== 'number') {
        timer.unref?.();
    }
}
