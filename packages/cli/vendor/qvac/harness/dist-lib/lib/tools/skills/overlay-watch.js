import Localdrive from 'localdrive';
import watch from 'watch-drive';
export function watchSkillsOverlay(overlayDir, onChange, opts = {}) {
    const debounceMs = opts.debounceMs ?? 200;
    const createStream = opts.createStream ?? defaultStream;
    const stream = createStream(overlayDir);
    let stopped = false;
    let timer = null;
    const schedule = () => {
        if (stopped)
            return;
        if (timer) {
            clearTimeout(timer);
        }
        timer = setTimeout(() => {
            timer = null;
            if (!stopped) {
                onChange();
            }
        }, debounceMs);
    };
    void (async () => {
        try {
            for await (const batch of stream) {
                if (batch?.diff && batch.diff.length > 0) {
                    schedule();
                }
            }
        }
        catch {
        }
    })();
    return {
        stop() {
            if (stopped)
                return;
            stopped = true;
            if (timer) {
                clearTimeout(timer);
            }
            timer = null;
            stream.destroy?.();
        }
    };
}
function defaultStream(overlayDir) {
    return watch(new Localdrive(overlayDir), '/');
}
