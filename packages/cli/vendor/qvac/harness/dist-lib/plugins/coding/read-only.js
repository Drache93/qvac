import fs from 'fs';
import path from 'path';
import { ShellLine } from '../../lib/tools/exec/shell-line.js';
const GREP = {
    short: 'rniIlLcvwxhHoqsEFz',
    valued: 'eABCm',
    long: [
        '--recursive',
        '--line-number',
        '--ignore-case',
        '--files-with-matches',
        '--files-without-match',
        '--count',
        '--invert-match',
        '--word-regexp',
        '--line-regexp',
        '--only-matching',
        '--no-filename',
        '--with-filename',
        '--extended-regexp',
        '--fixed-strings'
    ],
    longValued: [
        '--regexp',
        '--include',
        '--exclude',
        '--exclude-dir',
        '--max-count',
        '--context',
        '--after-context',
        '--before-context',
        '--color',
        '--colour'
    ]
};
const LINES = {
    short: 'qv',
    valued: 'nc',
    long: ['--quiet', '--silent', '--verbose'],
    longValued: ['--lines', '--bytes'],
    count: true
};
const READERS = {
    cat: { short: 'nbsAEetTuv' },
    head: LINES,
    tail: LINES,
    wc: { short: 'clmwL', long: ['--bytes', '--chars', '--lines', '--words'] },
    ls: { short: 'aAlhRrtS1dFpiogGnuUcCxsQ' },
    pwd: { short: 'LP' },
    echo: { short: 'neE', text: true },
    nl: { valued: 'bvisnw' },
    cut: {
        short: 's',
        valued: 'bcdf',
        longValued: ['--bytes', '--characters', '--delimiter', '--fields']
    },
    tr: { short: 'cdsC', text: true },
    file: { short: 'bLhiz', long: ['--brief', '--mime', '--mime-type'] },
    stat: { short: 'L', valued: 'cf' },
    du: { short: 'shacmkx', valued: 'd', longValued: ['--max-depth'] },
    tree: { short: 'adfisDhpugFnC', valued: 'LIP' },
    diff: { short: 'uqwbBiaty', valued: 'U' },
    grep: GREP,
    egrep: GREP,
    fgrep: GREP,
    rg: {
        short: 'nilcvwoFSsuHNq',
        valued: 'egtTABCmM',
        long: [
            '--hidden',
            '--files',
            '--count',
            '--files-with-matches',
            '--line-number',
            '--ignore-case',
            '--smart-case',
            '--fixed-strings',
            '--word-regexp',
            '--no-ignore',
            '--no-heading',
            '--heading'
        ],
        longValued: [
            '--glob',
            '--type',
            '--type-not',
            '--max-count',
            '--context',
            '--after-context',
            '--before-context',
            '--max-depth',
            '--regexp',
            '--color'
        ]
    },
    uniq: { short: 'cdui', valued: 'fs', most: 1 },
    sort: {
        short: 'nrufbdhgiMVsc',
        valued: 'tk',
        long: [
            '--numeric-sort',
            '--reverse',
            '--unique',
            '--ignore-case',
            '--human-numeric-sort',
            '--version-sort',
            '--stable',
            '--check'
        ],
        longValued: ['--key', '--field-separator']
    },
    sed: { words: sedRange },
    find: { words: findExpression }
};
const PRINT_RANGE = /^(\d+|\$)(,(\d+|\$))?p$/;
function sedRange(words, file) {
    const [flag, range, ...files] = words;
    return (flag === '-n' &&
        PRINT_RANGE.test(range ?? '') &&
        files.every((word) => !word.startsWith('-') && file(word)));
}
const FIND_TESTS = new Set([
    '-name',
    '-iname',
    '-path',
    '-ipath',
    '-wholename',
    '-regex',
    '-iregex',
    '-type',
    '-maxdepth',
    '-mindepth',
    '-size',
    '-mtime',
    '-mmin',
    '-newer'
]);
const FIND_FLAGS = new Set([
    '-empty',
    '-print',
    '-print0',
    '-prune',
    '-not',
    '!',
    '(',
    ')',
    '-o',
    '-or',
    '-a',
    '-and'
]);
function findExpression(words, file) {
    const rest = words[0] === '-P' ? words.slice(1) : words;
    const begins = rest.findIndex((word) => word.startsWith('-') || FIND_FLAGS.has(word));
    const starts = begins === -1 ? rest : rest.slice(0, begins);
    let test = null;
    for (const word of begins === -1 ? [] : rest.slice(begins)) {
        if (test !== null) {
            if (test === '-newer' && !file(word)) {
                return false;
            }
            test = null;
        }
        else if (FIND_TESTS.has(word)) {
            test = word;
        }
        else if (!FIND_FLAGS.has(word)) {
            return false;
        }
    }
    return test === null && starts.every(file);
}
export function readsOnly(line, root) {
    const parsed = ShellLine.parse(line);
    const stays = root ? resolvesInside(root) : () => true;
    return (parsed.unjudgeable === null &&
        parsed.commands.length > 0 &&
        parsed.commands.every((command) => reader(command, stays)));
}
function reader({ argv, expands, assignments, redirects }, stays) {
    const name = argv[0] ?? '';
    const known = Object.hasOwn(READERS, name) ? READERS[name] : undefined;
    if (!known || assignments.length || !redirects.every((r) => harmless(r, stays))) {
        return false;
    }
    if (expands.some(Boolean)) {
        return false;
    }
    const file = (word) => inside(word) && stays(word);
    const words = argv.slice(1);
    if (known.words) {
        return known.words(words, file);
    }
    const operands = operandsOf(known, words);
    return (operands !== null &&
        operands.length <= (known.most ?? Infinity) &&
        (known.text === true || operands.every(file)));
}
function operandsOf(known, words) {
    const operands = [];
    let value = false;
    for (const [i, word] of words.entries()) {
        if (value) {
            value = false;
        }
        else if (word === '--') {
            return [...operands, ...words.slice(i + 1)];
        }
        else if (word === '-' || !word.startsWith('-')) {
            operands.push(word);
        }
        else if (!(known.count && /^-\d+$/.test(word))) {
            const taken = word.startsWith('--') ? longFlag(known, word) : shortFlags(known, word);
            if (taken === null) {
                return null;
            }
            value = taken === 1;
        }
    }
    return operands;
}
function longFlag(known, word) {
    const at = word.indexOf('=');
    const name = at === -1 ? word : word.slice(0, at);
    if (known.longValued?.includes(name)) {
        return at === -1 ? 1 : 0;
    }
    return at === -1 && known.long?.includes(name) ? 0 : null;
}
function shortFlags(known, word) {
    const letters = [...word.slice(1)];
    for (const [i, letter] of letters.entries()) {
        if (known.valued?.includes(letter)) {
            return i === letters.length - 1 ? 1 : 0;
        }
        if (!known.short?.includes(letter)) {
            return null;
        }
    }
    return 0;
}
function resolvesInside(root) {
    const real = realpath(root) ?? root;
    return (word) => {
        const target = realpath(path.resolve(root, word));
        return target === null || target === real || target.startsWith(real + path.sep);
    };
}
function realpath(file) {
    try {
        return fs.realpathSync(file);
    }
    catch {
        return null;
    }
}
function inside(word) {
    return !word.startsWith('/') && !word.startsWith('~') && !word.split('/').includes('..');
}
function harmless({ op, target }, stays) {
    return ((op === '<' && inside(target) && stays(target)) ||
        target === '/dev/null' ||
        ((op === '>&' || op === '<&') && /^\d$/.test(target)));
}
