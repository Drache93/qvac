const BASE_GUIDELINES = [
    'When the request is ambiguous, ask for clarification rather than guessing.'
];
const TOOL_GUIDELINES = [
    'Request one action at a time; inspect the result before deciding the next step.',
    'If a tool fails, analyze the error and try a corrective action before asking the user for help.',
    'If a tool reports missing auth, setup, or approval, take the next tool step to complete it. Do not ask the user in chat whether to request approval; the policy/UI layer handles that.',
    'If the user asks you to use a tool, emit a tool call. Never claim external information was fetched or a side effect completed unless a tool result from this turn proves it.',
    'After tool execution, summarize the result for the user in plain language.',
    'Every gated tool takes an `intent`: one short sentence, addressed to the user, saying plainly what that call does for them — the outcome in their words, never the code. It is the only thing the approval prompt shows them, so never leave it out and never paste the command into it.'
];
const EXEC_FILE_GUIDELINE = 'You CAN create and deliver files: run code with `exec` and declare the file names in `outputs` — each produced file is attached to the chat for the user to open or save. Never claim you cannot produce a file, and never instruct the user to run code or use another app to make one.';
const EXEC_ATTACHED_IMAGE_GUIDELINE = 'An image the user attached is a file you can use, not just something to look at: when they want it inside a file you build, stage that attachment as an `exec` input and embed it. Never generate a replacement for an image the user attached, and if you truly cannot use it, say so rather than delivering the file without it.';
const SKILL_GUIDELINES = [
    'Tools are typed callable functions; skills are markdown guidance for when and how to use them.',
    'Before your first action on a request, check the skills list. If a skill covers the capability you are about to use, call the `skill` tool to load its full instructions FIRST — before any other tool call, and before asking the user a follow-up; the instructions usually answer it.',
    'Never use a capability whose skill you have not loaded this conversation, and never claim a capability is unavailable without checking the skills list.',
    'Loaded instructions may point to more files in the skill (e.g. references/edit.md). Call the `skill` tool again with `name` and `file` to load one BEFORE doing the work it covers — never guess what a referenced file contains.'
];
const CITATION_GUIDELINE = 'Search results arrive prefixed with source labels (`[1]`, `[Source 2: file, ...]`, `Source: <url>`). Do NOT echo those labels or refer to sources by number — they are shown to the user separately. Name a source (its file name or site) in natural prose when you rely on it. If the user explicitly asks for numbered references, produce them normally.';
export const RAG_CITATION_LINE = 'After your answer, add one final line naming the files you used, written exactly as [Sources: file-a.pdf, file-b.md] - or [Sources: none] if the excerpts did not answer the question. This line is required, it is the only place square brackets belong, and it is removed before the user sees it.';
const METADATA_SECTION = `## Message Metadata

User messages may include metadata such as [Current local time: ...]. This is contextual information provided by the system, not part of the user's query. Use it only when relevant and never repeat it unless the user asks about the current date or time.`;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export function currentTimeAnnotation(now = new Date()) {
    const p = (n) => String(n).padStart(2, '0');
    const stamp = `${WEEKDAYS[now.getDay()]} ${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())} ${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;
    const offset = -now.getTimezoneOffset();
    const sign = offset < 0 ? '-' : '+';
    const abs = Math.abs(offset);
    return `[Current local time: ${stamp} (UTC${sign}${p(Math.floor(abs / 60))}:${p(abs % 60)})]`;
}
export function lastUserContent(messages) {
    for (let i = messages.length - 1; i >= 0; i--) {
        const turn = messages[i];
        if (turn?.role === 'user') {
            return turn.content;
        }
    }
    return '';
}
export function annotateUserTimes(turns, now = new Date()) {
    const lastUser = turns.findLastIndex((turn) => turn.role === 'user');
    return turns.map((turn, i) => {
        if (turn.role !== 'user')
            return turn;
        if (!turn.sentAt && i !== lastUser)
            return turn;
        const at = turn.sentAt ? new Date(turn.sentAt) : now;
        return { ...turn, content: `${currentTimeAnnotation(at)}\n\n${turn.content}` };
    });
}
export function toolGuidelines(name) {
    if (name === 'exec') {
        return [EXEC_FILE_GUIDELINE, EXEC_ATTACHED_IMAGE_GUIDELINE];
    }
    return name === 'web_search' || name === 'web_fetch' ? [CITATION_GUIDELINE] : [];
}
function buildGuidelines(active) {
    const lines = [...BASE_GUIDELINES];
    if (active.size > 0) {
        lines.push(...TOOL_GUIDELINES);
    }
    if (active.has('exec')) {
        lines.push(...toolGuidelines('exec'));
    }
    if (active.has('skill')) {
        lines.push(...SKILL_GUIDELINES);
    }
    if (active.has('web_search') || active.has('web_fetch')) {
        lines.push(CITATION_GUIDELINE);
    }
    return `**Guidelines:**\n${lines.map((line) => `- ${line}`).join('\n')}`;
}
export function systemPromptParts({ bio, toolNames = [], skillsSection }) {
    const active = new Set(toolNames);
    const header = active.size
        ? 'You are a helpful AI assistant with access to tools.'
        : 'You are a helpful AI assistant.';
    const preamble = `${header}\n\n${METADATA_SECTION}`;
    const skills = active.has('skill') ? skillsSection : null;
    const text = [preamble, bio, skills, buildGuidelines(active)]
        .filter((part) => Boolean(part))
        .join('\n\n');
    return { text, bioChars: (bio ?? '').length, skillsChars: (skills ?? '').length };
}
export function buildSystemPrompt(input) {
    return systemPromptParts(input).text;
}
export function skillsPromptSection(activeSkills) {
    if (!activeSkills.length)
        return null;
    const lines = activeSkills.map((skill) => `- ${skill.name}: ${skill.description}`).join('\n');
    return `Skills available this turn. You MUST call the \`skill\` tool with its name BEFORE using the capability it describes — load the skill first, then act.\n${lines}`;
}
