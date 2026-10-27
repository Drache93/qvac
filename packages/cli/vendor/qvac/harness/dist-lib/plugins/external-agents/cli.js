import { isRecord } from '../../lib/guards.js';
import { graceMs } from './targets.js';
const CLAUDE_TOOLS = { read: 'Read,Grep,Glob', write: 'Read,Grep,Glob,Edit,Write,Bash' };
const OUTPUT_CHARS = 4_000;
const USER_LOGIN = ['--setting-sources', 'user', '--strict-mcp-config'];
export const claudeCli = {
    argv: (task, config) => [
        ...(config.login === 'user' ? USER_LOGIN : ['--bare']),
        '-p',
        '--output-format',
        'stream-json',
        '--verbose',
        '--no-session-persistence',
        '--permission-mode',
        'dontAsk',
        '--permission-prompts',
        'none',
        ...(config.maxTurns === undefined ? [] : ['--max-turns', String(config.maxTurns)]),
        ...(config.maxCostUsd === undefined ? [] : ['--max-budget-usd', String(config.maxCostUsd)]),
        '--allowedTools',
        CLAUDE_TOOLS[task.access]
    ],
    drive: cliDriver(claudeEvent)
};
export const codexCli = {
    argv: (task) => [
        'exec',
        '--json',
        '--ephemeral',
        '--skip-git-repo-check',
        '-C',
        task.workdir,
        '--sandbox',
        task.access === 'read' ? 'read-only' : 'workspace-write',
        '-'
    ],
    drive: cliDriver(codexEvent)
};
function cliDriver(parse) {
    return async ({ config, child, task, signal }) => {
        const run = { text: '', transcript: [], final: null };
        if (signal.aborted) {
            const exit = await child.stop(0, ['SIGKILL']);
            return { status: 'aborted', text: '', transcript: [{ type: 'end', exit }] };
        }
        child.onLine((line) => {
            const event = parsed(line);
            const seen = run.transcript.length;
            if (event) {
                parse(run, event);
            }
            for (const entry of run.transcript.slice(seen)) {
                task.onEvent?.(entry);
            }
        });
        const onAbort = () => void child.stop(graceMs(config), ['SIGINT', 'SIGTERM', 'SIGKILL']);
        signal.addEventListener('abort', onAbort, { once: true });
        child.write(task.prompt);
        child.end();
        const exit = await child.closed;
        signal.removeEventListener('abort', onAbort);
        run.transcript.push({ type: 'end', exit });
        if (signal.aborted) {
            return {
                status: 'aborted',
                text: run.text,
                usage: run.final?.usage,
                transcript: run.transcript
            };
        }
        return run.final
            ? { ...run.final, transcript: run.transcript }
            : { status: 'error', text: 'the agent ended without a result', transcript: run.transcript };
    };
}
function parsed(line) {
    try {
        const event = JSON.parse(line);
        return isRecord(event) ? event : null;
    }
    catch {
        return null;
    }
}
function claudeEvent(run, event) {
    const blocks = Array.isArray(Object(event.message).content)
        ? Object(event.message).content
        : [];
    if (event.type === 'assistant' || event.type === 'user') {
        for (const block of blocks.map(Object)) {
            claudeBlock(run, block);
        }
    }
    else if (event.type === 'result') {
        claudeResult(run, event);
    }
}
function claudeBlock(run, block) {
    if (block.type === 'text') {
        run.text += String(block.text);
        run.transcript.push({ type: 'message', text: block.text });
    }
    else if (block.type === 'thinking') {
        run.transcript.push({ type: 'thought', text: block.thinking });
    }
    else if (block.type === 'tool_use') {
        const { id, name: title, input } = block;
        run.transcript.push({ type: 'tool', id, title, status: 'pending', input });
    }
    else if (block.type === 'tool_result') {
        const status = block.is_error === true ? 'failed' : 'completed';
        run.transcript.push({
            type: 'tool',
            id: block.tool_use_id,
            status,
            output: text(block.content)
        });
    }
}
function text(content) {
    const parts = Array.isArray(content) ? content : [content];
    const joined = parts
        .map((part) => (typeof part === 'string' ? part : String(Object(part).text ?? '')))
        .join('');
    return joined.length > OUTPUT_CHARS ? `${joined.slice(0, OUTPUT_CHARS)}…` : joined;
}
function claudeResult(run, event) {
    const denials = Array.isArray(event.permission_denials) ? event.permission_denials : [];
    for (const denial of denials.map(Object)) {
        run.transcript.push({ type: 'permission', title: denial.tool_name, answer: 'denied' });
    }
    const usage = Object(event.usage);
    const status = () => {
        if (event.subtype === 'error_max_turns' || event.subtype === 'error_max_budget_usd') {
            return 'budget';
        }
        return event.subtype === 'success' && event.is_error !== true ? 'answered' : 'error';
    };
    run.final = {
        status: status(),
        text: typeof event.result === 'string' ? event.result : run.text,
        usage: numbers({
            inputTokens: usage.input_tokens,
            outputTokens: usage.output_tokens,
            costUsd: event.total_cost_usd,
            turns: event.num_turns
        })
    };
}
function codexEvent(run, event) {
    if (event.type === 'item.completed') {
        codexItem(run, Object(event.item));
    }
    else if (event.type === 'turn.completed') {
        const usage = Object(event.usage);
        run.final = {
            status: 'answered',
            text: run.text,
            usage: numbers({ inputTokens: usage.input_tokens, outputTokens: usage.output_tokens })
        };
    }
    else if (event.type === 'turn.failed' || event.type === 'error') {
        const message = String(Object(event.error).message ?? event.message ?? 'the turn failed');
        run.transcript.push({ type: 'error', message });
        run.final = { status: 'error', text: message, usage: undefined };
    }
}
function codexItem(run, item) {
    const changes = Array.isArray(item.changes) ? item.changes : [];
    if (item.type === 'agent_message') {
        run.text = String(item.text);
        run.transcript.push({ type: 'message', text: item.text });
    }
    else if (item.type === 'reasoning') {
        run.transcript.push({ type: 'thought', text: item.text });
    }
    else if (item.type === 'command_execution') {
        const { id, command: title, status } = item;
        run.transcript.push({ type: 'tool', id, title, kind: 'execute', status });
    }
    else if (item.type === 'file_change') {
        const paths = changes.map((change) => Object(change).path);
        run.transcript.push({ type: 'tool', id: item.id, kind: 'edit', status: item.status, paths });
    }
    else if (item.type === 'mcp_tool_call' || item.type === 'web_search') {
        run.transcript.push({ type: 'tool', id: item.id, kind: item.type, status: item.status });
    }
}
const USAGE_KEYS = ['inputTokens', 'outputTokens', 'costUsd', 'turns'];
function numbers(usage) {
    const out = {};
    for (const key of USAGE_KEYS) {
        const value = usage[key];
        if (typeof value === 'number') {
            out[key] = value;
        }
    }
    return out;
}
