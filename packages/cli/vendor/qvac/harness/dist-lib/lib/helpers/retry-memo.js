export function retryMemo(load) {
    let memo = null;
    return Object.assign(() => {
        memo ??= Promise.resolve()
            .then(load)
            .catch((err) => {
            memo = null;
            throw err;
        });
        return memo;
    }, { peek: () => memo });
}
