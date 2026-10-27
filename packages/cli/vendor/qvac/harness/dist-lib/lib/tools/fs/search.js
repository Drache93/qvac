import b4a from 'b4a';
import { errorMessage } from '../../guards.js';
import { HarnessLog } from '../../log.js';
import { isDriveReadTruncated } from './drive.js';
import { isDeniedPath } from './scope.js';
import { MAX_WALK_ENTRIES, MAX_WALK_MS, streamFiles } from './walk.js';
export const MAX_GREP_MATCHES = 1000;
const NEWLINE = 0x0a;
const LINE_END = b4a.from([NEWLINE]);
const MAX_LINE_CHARS = 500;
const BINARY_PROBE_BYTES = 1024;
const DEFAULT_CONCURRENCY = 8;
const MAX_UNCOUNTED_BYTES = 1024 * 1024;
const MAX_LINE_BYTES = 1024 * 1024;
const UNSEARCHED = -2;
const LOOKAROUND = /\(\?<?[=!]/;
const BACKREFERENCE = /\\[1-9]|\\k</;
const CROSSES_LINES = /\[\^|\\(?:[sWDn0]|12|x0[aA]|u000[aA]|c[jJ])|\\(?:x[\da-fA-F]{2}|u[\da-fA-F]{4}|c[a-zA-Z]|[^dDsSwW])-|[\0-\n]|\(\?[a-zA-Z-]/;
function cursors(keys) {
    return keys.map((key) => ({ key, at: UNSEARCHED }));
}
function nearest(all, from, find) {
    let best = -1;
    for (const cursor of all) {
        if (cursor.at === UNSEARCHED || (cursor.at >= 0 && cursor.at < from)) {
            cursor.at = find(cursor.key, from);
        }
        if (cursor.at >= 0 && (best === -1 || cursor.at < best)) {
            best = cursor.at;
        }
    }
    return best;
}
function countNewlines(bytes, start, end) {
    let count = 0;
    for (let i = start; i < end; i++) {
        if (bytes[i] === NEWLINE) {
            count++;
        }
    }
    return count;
}
class ByteHaystack {
    #bytes;
    #needles;
    constructor(bytes, needles) {
        this.#bytes = bytes;
        this.#needles = cursors(needles);
    }
    get length() {
        return this.#bytes.length;
    }
    next(from) {
        return nearest(this.#needles, from, (needle, at) => b4a.indexOf(this.#bytes, needle, at));
    }
    newlineAt(from) {
        return b4a.indexOf(this.#bytes, NEWLINE, from);
    }
    newlineBefore(index) {
        return b4a.lastIndexOf(this.#bytes, NEWLINE, index - 1);
    }
    slice(start, end) {
        return b4a.toString(this.#bytes, 'utf8', start, end);
    }
    newlines(start, end) {
        return countNewlines(this.#bytes, start, end);
    }
}
class TextHaystack {
    #text;
    #finders;
    constructor(text, finders) {
        this.#text = text;
        this.#finders = finders === null ? null : cursors(finders);
    }
    get length() {
        return this.#text.length;
    }
    next(from) {
        const at = this.#finders === null
            ? from
            : nearest(this.#finders, from, (finder, start) => {
                finder.lastIndex = start;
                return finder.exec(this.#text)?.index ?? -1;
            });
        return at < this.#text.length ? at : -1;
    }
    newlineAt(from) {
        return this.#text.indexOf('\n', from);
    }
    newlineBefore(index) {
        return this.#text.lastIndexOf('\n', index - 1);
    }
    slice(start, end) {
        return this.#text.slice(start, end);
    }
    newlines(start, end) {
        let count = 0;
        let at = this.#text.indexOf('\n', start);
        while (at !== -1 && at < end) {
            count++;
            at = this.#text.indexOf('\n', at + 1);
        }
        return count;
    }
}
class LineCounter {
    line = 1;
    #pending = [];
    #pendingBytes = 0;
    defer(block) {
        this.#pending.push(block);
        this.#pendingBytes += block.length;
        if (this.#pendingBytes > MAX_UNCOUNTED_BYTES) {
            this.flush();
        }
    }
    flush() {
        for (const block of this.#pending) {
            this.line += countNewlines(block, 0, block.length);
        }
        this.#pending.length = 0;
        this.#pendingBytes = 0;
    }
}
class OrderedCommits {
    hits = [];
    cut = false;
    #maxMatches;
    #pending = [];
    constructor(maxMatches) {
        this.#maxMatches = maxMatches;
    }
    get room() {
        return this.#maxMatches - this.hits.length;
    }
    add(file, read) {
        const entry = { file, read, scan: null };
        void read.then((scan) => {
            entry.scan = scan;
        });
        this.#pending.push(entry);
    }
    async settle(keep) {
        for (let head = this.#pending[0]; head !== undefined; head = this.#pending[0]) {
            if (head.scan === null && this.#pending.length <= keep) {
                return false;
            }
            const scan = head.scan ?? (await head.read);
            this.#pending.shift();
            if (this.#commit(head.file, scan)) {
                return true;
            }
        }
        return false;
    }
    result(capped) {
        return { hits: this.hits, capped, cut: this.cut };
    }
    #commit(file, scan) {
        const room = this.room;
        if (scan.hits.length >= room) {
            this.hits.push(...scan.hits.slice(0, room));
            return true;
        }
        if (scan.end === 'unreadable') {
            HarnessLog.info('warn: grep skipped a file', {
                file: file.path,
                err: errorMessage(scan.error)
            });
        }
        else if (scan.end !== 'binary') {
            this.cut ||= scan.end === 'cut';
            this.hits.push(...scan.hits);
        }
        return false;
    }
}
function escapeLiteral(query) {
    return query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function finders(sources, flags) {
    if (!sources.some((source) => BACKREFERENCE.test(source))) {
        try {
            return [new RegExp(sources.map((source) => `(?:${source})`).join('|'), flags)];
        }
        catch {
        }
    }
    return sources.map((source) => new RegExp(source, flags));
}
function hasNul(head) {
    return b4a.indexOf(head.subarray(0, BINARY_PROBE_BYTES), 0) !== -1;
}
async function* gated(files, gate) {
    for await (const file of files) {
        if (Date.now() > gate.deadline) {
            gate.late = true;
            return;
        }
        const name = file.key.slice(file.key.lastIndexOf('/') + 1);
        if (!isDeniedPath(file.path, gate.deny) &&
            (gate.include === null || gate.include(name, file.path))) {
            yield file;
        }
    }
}
export class DriveSearch {
    #concurrency;
    #tests;
    #needles;
    #finders;
    constructor(queries, { regex = false, caseSensitive = false, concurrency = DEFAULT_CONCURRENCY } = {}) {
        this.#concurrency = concurrency;
        const bytes = !regex && caseSensitive && !queries.some((query) => query === '' || query.includes('\uFFFD'));
        const flags = caseSensitive ? '' : 'i';
        const sources = regex ? queries : queries.map(escapeLiteral);
        const lines = bytes ? [] : sources.map((source) => new RegExp(source, flags));
        this.#tests = bytes
            ? queries.map((query) => (line) => line.includes(query))
            : lines.map((rx) => (line) => rx.test(line));
        this.#needles = bytes ? queries.map((query) => b4a.from(query)) : null;
        this.#finders =
            bytes ||
                (regex && queries.some((query) => LOOKAROUND.test(query) || CROSSES_LINES.test(query)))
                ? null
                : finders(sources, `${flags}g${regex ? 'm' : ''}`);
    }
    static async answer(drive, request) {
        const search = new DriveSearch(request.queries, {
            regex: request.regex,
            caseSensitive: request.caseSensitive
        });
        const root = {
            kind: 'hyper',
            key: request.driveKey,
            writable: false,
            prefix: '/',
            drive
        };
        return search.searchFolder(root, request.folder, {
            includeIgnored: request.includeIgnored,
            maxMatches: Math.min(request.maxMatches, MAX_GREP_MATCHES),
            maxEntries: Math.min(request.maxEntries, MAX_WALK_ENTRIES),
            maxMs: Math.min(request.maxMs, MAX_WALK_MS)
        });
    }
    async searchFolder(root, folder, { maxMatches, includeIgnored, maxEntries, maxMs, deny = [], include = null }) {
        const walk = streamFiles(root, folder, { includeIgnored, maxEntries, maxMs });
        const gate = {
            deny,
            include,
            deadline: maxMs === undefined ? Infinity : Date.now() + maxMs,
            late: false
        };
        const found = await this.search(root.drive, gated(walk.files, gate), maxMatches);
        const listed = await walk.result;
        return {
            ...found,
            truncated: listed.truncated || gate.late,
            skippedLinks: listed.skippedLinks
        };
    }
    async search(drive, files, maxMatches) {
        const commits = new OrderedCommits(maxMatches);
        const stop = { stopped: false };
        try {
            for await (const file of files) {
                if (await commits.settle(this.#concurrency - 1)) {
                    return commits.result(true);
                }
                commits.add(file, this.#scan(drive, { file, room: commits.room, stop }));
            }
            return commits.result(await commits.settle(0));
        }
        finally {
            stop.stopped = true;
        }
    }
    async #scan(drive, { file, room, stop }) {
        const state = {
            file,
            room,
            hits: [],
            lines: new LineCounter(),
            probed: false,
            carry: null,
            skipping: false
        };
        try {
            for await (const chunk of drive.createReadStream(file.key)) {
                const end = stop.stopped ? 'complete' : this.#take(chunk, state);
                if (end !== null) {
                    return { hits: state.hits, end };
                }
            }
            return { hits: state.hits, end: this.#last(state) };
        }
        catch (error) {
            if (!state.probed && state.carry !== null && !hasNul(state.carry)) {
                this.#wholeLines(state.carry, state);
            }
            return { hits: state.hits, end: isDriveReadTruncated(error) ? 'cut' : 'unreadable', error };
        }
    }
    #take(chunk, state) {
        if (state.skipping) {
            const newline = b4a.indexOf(chunk, NEWLINE);
            if (newline === -1) {
                return null;
            }
            state.skipping = false;
            chunk = chunk.subarray(newline + 1);
        }
        const buffer = state.carry === null ? chunk : b4a.concat([state.carry, chunk]);
        if (!state.probed && buffer.length < BINARY_PROBE_BYTES) {
            state.carry = buffer;
            return null;
        }
        if (!state.probed && hasNul(buffer)) {
            return 'binary';
        }
        state.probed = true;
        return this.#wholeLines(buffer, state) || this.#longLine(state) ? 'complete' : null;
    }
    #longLine(state) {
        const { carry } = state;
        if (carry === null || carry.length <= MAX_LINE_BYTES) {
            return false;
        }
        state.carry = null;
        state.skipping = true;
        return this.#block(b4a.concat([carry.subarray(0, MAX_LINE_BYTES), LINE_END]), state);
    }
    #last(state) {
        const { carry } = state;
        if (carry === null) {
            return 'complete';
        }
        if (!state.probed && hasNul(carry)) {
            return 'binary';
        }
        this.#block(carry[carry.length - 1] === NEWLINE ? carry : b4a.concat([carry, LINE_END]), state);
        return 'complete';
    }
    #wholeLines(buffer, state) {
        const last = b4a.lastIndexOf(buffer, NEWLINE);
        state.carry = last + 1 === buffer.length ? null : buffer.subarray(last + 1);
        return last !== -1 && this.#block(buffer.subarray(0, last + 1), state);
    }
    #block(block, { file, hits, lines, room }) {
        const hay = this.#needles === null
            ? new TextHaystack(b4a.toString(block, 'utf8'), this.#finders)
            : new ByteHaystack(block, this.#needles);
        let counted = -1;
        for (let at = hay.next(0); at !== -1; at = hay.next(counted)) {
            const start = at === 0 ? 0 : hay.newlineBefore(at) + 1;
            const newline = hay.newlineAt(at);
            const end = newline === -1 ? hay.length : newline;
            if (counted === -1) {
                lines.flush();
                counted = 0;
            }
            lines.line += hay.newlines(counted, start);
            const text = hay.slice(start, end);
            if (this.#tests.some((test) => test(text))) {
                hits.push({ file: file.path, line: lines.line, text: text.slice(0, MAX_LINE_CHARS) });
            }
            if (hits.length >= room) {
                return true;
            }
            lines.line++;
            counted = end + 1;
        }
        if (counted === -1) {
            lines.defer(block);
        }
        else if (counted < hay.length) {
            lines.line += hay.newlines(counted, hay.length);
        }
        return false;
    }
}
