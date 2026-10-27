export function createVoiceLane() {
    let tail = Promise.resolve();
    return (job) => {
        const run = tail.then(job);
        tail = run.catch(noop);
        return run;
    };
}
function noop() { }
