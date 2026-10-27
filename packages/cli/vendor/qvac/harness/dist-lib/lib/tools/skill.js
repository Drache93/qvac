import path from 'path';
import b4a from 'b4a';
import Localdrive from 'localdrive';
import { HarnessError } from '../errors.js';
import { unquoteArg } from '../helpers/model-args.js';
import { resolveSkillsOverlayDir } from './skills/overlay-dir.js';
import { parseSkillFrontMatter } from './skills/frontmatter-parser.js';
import { Agent } from '../agent/index.js';
import { ShellLine } from './exec/shell-line.js';
const MAIN_FILE = 'SKILL.md';
const NO_FILE = /^(?:none|null|undefined|main)$/i;
export function mainFileRequested(name, file) {
    if (file === undefined || file === null)
        return true;
    const asked = unquoteArg(file).toLowerCase();
    return (asked === '' ||
        NO_FILE.test(asked) ||
        asked === name.toLowerCase() ||
        asked === MAIN_FILE.toLowerCase());
}
export function skillFileArg(args) {
    return args?.file ?? args?.path ?? args?.filename;
}
export function skillFileStem(file) {
    return file
        .toLowerCase()
        .replace(/^references\//, '')
        .replace(/\.md$/, '');
}
function resolveSkillDir(root, name) {
    if (!root)
        return null;
    return path.resolve(root, name);
}
function toolNote(tools) {
    if (!tools?.length)
        return null;
    const grants = [];
    for (const entry of tools) {
        const { name } = Agent.parseToolGrant(entry);
        if (!grants.includes(name)) {
            grants.push(name);
        }
    }
    return [
        `You can now call: ${grants.join(', ')}.`,
        'Do this work yourself with those tools in this turn — never tell the user to install ' +
            'anything, open another app, or run code themselves.'
    ].join(' ');
}
async function addSkillFiles(files, drive, name) {
    for await (const entry of drive.list(`/${name}`)) {
        const rel = String(entry.key).slice(name.length + 2);
        if (rel && rel !== 'SKILL.md') {
            files.add(rel);
        }
    }
}
async function listSkillFiles(drives, name) {
    const files = new Set();
    for (const drive of drives) {
        if (!drive)
            continue;
        try {
            await addSkillFiles(files, drive, name);
        }
        catch {
        }
    }
    return [...files].sort();
}
function nearestFile(wanted, available) {
    const matches = available.filter((file) => skillFileStem(file) === skillFileStem(wanted));
    return matches.length === 1 ? matches[0] : null;
}
export function createSkillTool({ skillsDir, overlayDir = resolveSkillsOverlayDir(), read } = {}) {
    const baseDrive = skillsDir ? new Localdrive(skillsDir) : null;
    const overlayDrive = overlayDir ? new Localdrive(overlayDir) : null;
    async function resolveSkill(name, file) {
        if (read) {
            return { raw: await read(name, file), root: skillsDir };
        }
        for (const [drive, root] of [
            [overlayDrive, overlayDir],
            [baseDrive, skillsDir]
        ]) {
            const buf = drive ? await drive.get(`/${name}/${file}`) : null;
            if (buf) {
                return { raw: b4a.toString(buf, 'utf8'), root: root ?? undefined };
            }
        }
        throw new HarnessError('SKILL_FILE_NOT_FOUND', [name, file]);
    }
    return {
        name: 'skill',
        toolset: null,
        description: 'Load the instructions for a named skill. Call this FIRST, before any other tool, whenever a listed skill covers the capability you are about to use. When loaded instructions point to another file in the skill, call this again with `name` and `file` to load it before doing the work it covers.',
        parameters: {
            type: 'object',
            properties: {
                name: { type: 'string', description: "The skill's name" },
                file: {
                    type: 'string',
                    description: "Path of a file inside the skill to load, exactly as the skill's instructions name it (e.g. 'references/edit.md'). Omit to load the main instructions."
                }
            },
            required: ['name']
        },
        prompt: {
            description: "Load a named skill's instructions FIRST, before any other tool, when a listed skill covers " +
                'what you are about to do — and again with `file` for any file they reference.',
            parameters: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    file: {
                        type: 'string',
                        description: "A file inside the skill, exactly as named there (e.g. 'references/edit.md'). " +
                            'Omit for the main instructions.'
                    }
                },
                required: ['name']
            }
        },
        effect: () => 'read',
        autoApprove: true,
        async execute(args, ctx) {
            const name = unquoteArg(args.name ?? args.skill_name ?? args.skill);
            const fileArg = skillFileArg(args);
            const file = mainFileRequested(name, fileArg) ? MAIN_FILE : unquoteArg(fileArg);
            if (file.startsWith('/') || file.includes('\\') || file.split('/').includes('..')) {
                return { error: `file not found in skill ${name}: ${file}` };
            }
            const load = async (target) => {
                const { raw, root } = await resolveSkill(name, target);
                const { body, meta } = parseSkillFrontMatter(raw);
                const dir = resolveSkillDir(root, name);
                const content = dir ? body.replaceAll('{{SKILL_DIR}}', ShellLine.escape(dir)) : body;
                const note = toolNote(meta.tools);
                return {
                    name,
                    file: target === MAIN_FILE ? undefined : target,
                    content: note ? `${content.trim()}\n\n${note}` : content
                };
            };
            const mainInstead = async (asked, available) => {
                const main = await load(MAIN_FILE);
                const others = available.length ? ` Its other files: ${available.join(', ')}.` : '';
                return {
                    ...main,
                    content: `There is no file ${asked} in this skill; these are its instructions.${others}\n\n${main.content}`
                };
            };
            try {
                return await load(file);
            }
            catch {
                if (file === MAIN_FILE) {
                    return { error: `skill not found: ${name}` };
                }
                const available = await listSkillFiles([overlayDrive, baseDrive], name);
                const near = nearestFile(file, available);
                if (near !== null) {
                    try {
                        return await load(near);
                    }
                    catch { }
                }
                if (!ctx?.skillsLoadedThisTurn?.includes(name)) {
                    try {
                        return await mainInstead(file, available);
                    }
                    catch {
                        return { error: `skill not found: ${name}` };
                    }
                }
                const rest = available.length
                    ? `Its other files: ${available.join(', ')}.`
                    : 'It has no other files; you already have its full instructions, so act now.';
                return { name, content: `There is no file ${file} in this skill. ${rest}` };
            }
        }
    };
}
