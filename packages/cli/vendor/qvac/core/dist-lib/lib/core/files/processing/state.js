export class FileRetries {
    _entries = new Map();
    _missing = new Set();
    blockedUntil(id, now) {
        const entry = this._entries.get(id);
        return entry && now < entry.at ? entry.at : null;
    }
    miss(id, now, retryMs) {
        const previous = this._entries.get(id);
        const delay = previous ? Math.min(previous.delay * 2, 600_000) : retryMs;
        const at = now + delay;
        this._entries.set(id, { at, delay });
        return at;
    }
    markMissing(id) {
        this._missing.add(id);
    }
    markFound(id) {
        this._missing.delete(id);
    }
    clear(id) {
        if (id !== undefined) {
            this._entries.delete(id);
            this._missing.delete(id);
        }
        else {
            this._entries.clear();
            this._missing.clear();
        }
    }
    reconnect(onRetry) {
        let deadline = null;
        for (const id of this._missing) {
            const entry = this._entries.get(id);
            if (!entry) {
                continue;
            }
            deadline ??= Date.now() + 250;
            entry.at = Math.min(entry.at, deadline);
            onRetry?.(id, entry.at);
        }
        return deadline;
    }
    get(id) {
        return this._entries.get(id);
    }
    rewind(id) {
        const entry = this._entries.get(id);
        if (entry) {
            entry.at = 0;
        }
    }
}
export class FileState {
    _documents = new Map();
    _artifacts = new Map();
    sourceRetries = new FileRetries();
    outputRetries = new FileRetries();
    document(id) {
        let entry = this._documents.get(id);
        if (!entry) {
            this._documents.set(id, (entry = {}));
        }
        return entry;
    }
    artifact(id) {
        let entry = this._artifacts.get(id);
        if (!entry) {
            this._artifacts.set(id, (entry = {}));
        }
        return entry;
    }
    forget(id) {
        const entry = this._documents.get(id);
        this._documents.delete(id);
        return entry;
    }
    get(id) {
        return this._documents.get(id);
    }
    readArtifact(id) {
        return this._artifacts.get(id);
    }
    progress(chatId) {
        return [...this._documents.values()].flatMap((entry) => entry.progress?.chatId === chatId ? [{ ...entry.progress, chatId }] : []);
    }
    clearLoaded() {
        for (const entry of this._documents.values()) {
            entry.loaded = undefined;
            entry.load = undefined;
        }
    }
    retry(id) {
        const entry = this.document(id);
        entry.work = undefined;
        entry.load = undefined;
        entry.preferredUntil = 0;
        entry.embedFailures = undefined;
        entry.sourceMisses = undefined;
        this.sourceRetries.clear(id);
        this.outputRetries.clear(id);
        for (const [artifactId, output] of this._artifacts) {
            if (output.knowledgeId !== id && artifactId !== entry.artifactIdMemo) {
                continue;
            }
            output.terminal = false;
            output.failedReference = undefined;
            output.unavailable = undefined;
            output.rebuildFailures = undefined;
            this.outputRetries.clear(artifactId);
        }
        entry.artifactIdMemo = undefined;
    }
    reset() {
        this._documents.clear();
        for (const [id, entry] of this._artifacts) {
            if (entry.published) {
                this._artifacts.set(id, { published: entry.published });
            }
            else {
                this._artifacts.delete(id);
            }
        }
        this.sourceRetries.clear();
        this.outputRetries.clear();
    }
    close() {
        this.reset();
        this._artifacts.clear();
    }
}
