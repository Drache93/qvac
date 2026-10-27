import crypto from 'crypto';
export class ToolSets {
    sets = new Map();
    add(tools) {
        const hash = ToolSets.hash(tools);
        this.sets.set(hash, tools);
        return hash;
    }
    resolve(hash) {
        return this.sets.get(hash);
    }
    static hash(tools) {
        return crypto.createHash('sha256').update(JSON.stringify(tools)).digest('hex');
    }
}
