export const IMAGE_ONLY_USER_PROMPT = 'The user sent one or more images without any accompanying text. Describe what the images show and respond to anything notable in them.';
export const DOCUMENT_ONLY_USER_PROMPT = 'The user sent one or more documents without any accompanying text. Summarize the attached documents.';
export const IMAGE_AND_DOCUMENT_USER_PROMPT = 'The user sent one or more images together with one or more documents, and no accompanying text. Describe what the images show and summarize the attached documents.';
export function backfillDocumentOnlyTurn(messages) {
    const last = messages.findLast((turn) => turn.role === 'user');
    if (!last || last.content.trim()) {
        return;
    }
    last.content = last.attachments?.length
        ? IMAGE_AND_DOCUMENT_USER_PROMPT
        : DOCUMENT_ONLY_USER_PROMPT;
}
export function backfillImageOnlyTurns(messages) {
    for (const turn of messages) {
        if (turn.role !== 'user' || turn.content.trim())
            continue;
        if (turn.attachments?.length) {
            turn.content = IMAGE_ONLY_USER_PROMPT;
        }
    }
}
export function unreadableImagesNotice(fileNames) {
    const plural = fileNames.length > 1;
    return (`[Attached image${plural ? 's' : ''}: ${fileNames.join(', ')} — could not be read, so ` +
        `${plural ? 'they are' : 'it is'} not visible to you. Tell the user the upload failed and ` +
        `ask for a re-upload; never describe or recreate ${plural ? 'them' : 'it'}]`);
}
export function annotateUnreadableImages(unreadable) {
    for (const [turn, names] of unreadable) {
        const notice = unreadableImagesNotice(names);
        turn.content = turn.content ? `${turn.content}\n${notice}` : notice;
    }
}
export function unheardAudioNotice(label, reason, opts = {}) {
    const retry = opts.retryable === false ? '' : ', and ask them to try again';
    return (`${label} could not be transcribed (${reason}). Tell the user the audio was not ` +
        `transcribed and why${retry}; never invent what it might contain.`);
}
export function silentAudioNotice(fileName) {
    return (`Attached audio "${fileName}" was transcribed and contained no detectable speech. ` +
        'Tell the user; never invent what it might contain.');
}
export function audioTranscriptBlock(fileName, transcript) {
    return [
        `The audio file "${fileName}" has already been transcribed on-device. You cannot open the file itself — use the transcript below as its full content and answer from it.`,
        'Transcript:',
        transcript
    ].join('\n');
}
function clock(seconds) {
    const s = Math.round(seconds);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
export function videoAnnotation({ fileName, duration, times }) {
    return (`[Video "${fileName}", ${clock(duration)} long. You are seeing ${times.length} frames taken ` +
        `evenly across the whole video, in order, at ${times.map(clock).join(', ')}. You cannot see ` +
        'what happens between frames.]');
}
export function videoTranscriptBlock(transcript) {
    return `The video's audio was transcribed on-device. Transcript:\n${transcript}`;
}
export function unsyncedVideoNotice(fileName) {
    return `[Attached video "${fileName}" has not reached this device yet — the upload may still be syncing.]`;
}
export function unreadVideoNotice(fileName) {
    return (`[Attached video "${fileName}" could not be read on this device: the file may be damaged, ` +
        'or in a format it cannot decode. Tell the user so; do not try to open it another way.]');
}
export function hiddenVideoNotice(fileName) {
    return `[Attached video "${fileName}" — its frames are not visible to this model]`;
}
export const VIDEO_NO_AUDIO = '[The video has no audio track.]';
export const VIDEO_SILENT = "[The video's audio contained no detectable speech.]";
const MAX_SENDER_NAME_CHARS = 64;
function displayableSender(name) {
    const flat = name?.replace(/\s+/g, ' ').trim();
    return flat ? Array.from(flat).slice(0, MAX_SENDER_NAME_CHARS).join('') : undefined;
}
export function restoreSentContent(messages) {
    for (const turn of messages) {
        if (turn.readContent !== undefined) {
            turn.content = turn.readContent;
            delete turn.sender;
            delete turn.sentAt;
        }
        else if (turn.sentContent !== undefined) {
            turn.content = turn.sentContent;
        }
        delete turn.readContent;
        delete turn.sentContent;
    }
}
export function askedIn(sent, sender) {
    const content = sent.findLast((turn) => turn.role === 'user')?.content;
    const name = displayableSender(sender);
    return name && content?.startsWith(`${name}: `) ? content.slice(name.length + 2) : content;
}
export function nameSenders(messages) {
    return messages.map(({ sender, ...turn }) => {
        const name = displayableSender(sender);
        return name ? { ...turn, content: `${name}: ${turn.content}` } : turn;
    });
}
