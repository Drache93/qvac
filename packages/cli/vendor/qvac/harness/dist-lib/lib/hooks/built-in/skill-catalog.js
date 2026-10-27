export class SkillCatalogGuardHook {
    name = 'skill-catalog';
    phase = 'preToolCall';
    _catalog;
    constructor(catalog = []) {
        this._catalog = catalog;
    }
    run(ctx) {
        if (ctx.phase !== 'preToolCall' || ctx.toolName !== 'skill')
            return;
        const entries = ctx.skillNames ?? (typeof this._catalog === 'function' ? this._catalog() : this._catalog);
        const known = new Set(entries.map((entry) => (typeof entry === 'string' ? entry : entry.name)));
        const raw = ctx.args.name ?? ctx.args.skill_name ?? ctx.args.skill;
        const name = typeof raw === 'string' ? raw : '';
        if (known.has(name)) {
            return;
        }
        const listed = [...known].join(', ');
        const rest = listed
            ? `The only skills are: ${listed}. Nothing else needs a skill load — answer or act with the tools you already have.`
            : 'No skill is available this turn — answer or act with the tools you already have.';
        return { kind: 'hook-rejection', error: `skill not found: ${name}. ${rest}`, guidance: true };
    }
}
