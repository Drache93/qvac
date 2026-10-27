const TIMESTAMP_PREFIX = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} /;
const NOISE_RULES = [
    { kind: 'startsWith', text: 'Loaded main app package ' },
    { kind: 'startsWith', text: 'Loaded updated app package ' },
    { kind: 'startsWith', text: 'Ignored: Error: Argument must be a file path' },
    { kind: 'startsWith', text: 'Checking for update using Github' },
    { kind: 'equals', text: 'Success.' },
    { kind: 'startsWith', text: 'Latest version is ' },
    { kind: 'equals', text: 'App is up to date.' },
    { kind: 'includes', text: 'representedObject is not a WeakPtrToElectronMenuModelAsNSObject' },
    { kind: 'startsWith', text: 'Received command line ' }
];
function isNoiseLine(line) {
    for (const rule of NOISE_RULES) {
        if (rule.kind === 'startsWith' && line.startsWith(rule.text))
            return true;
        if (rule.kind === 'equals' && line === rule.text)
            return true;
        if (rule.kind === 'includes' && line.includes(rule.text)) {
            return true;
        }
    }
    return false;
}
export function cleanObsidianOutput(raw) {
    return raw
        .split('\n')
        .map((line) => line.replace(TIMESTAMP_PREFIX, ''))
        .filter((line) => line.trim() !== '' && !isNoiseLine(line))
        .join('\n')
        .trim();
}
