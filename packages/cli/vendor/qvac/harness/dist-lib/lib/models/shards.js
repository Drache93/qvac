const SHARD = /^(.+)-(\d{5})-of-(\d{5})(\.\w+)$/;
export function shardSet(src) {
    const parts = src.split('/');
    const match = SHARD.exec(parts[parts.length - 1]?.split('?')[0] ?? '');
    if (!match) {
        return null;
    }
    const [, base, , total, extension] = match;
    const baseUrl = parts.slice(0, -1).join('/');
    const shards = Array.from({ length: Number(total) }, (_, i) => {
        const filename = `${base}-${String(i + 1).padStart(5, '0')}-of-${total}${extension}`;
        return { url: `${baseUrl}/${filename}`, filename };
    });
    return { base, baseUrl, extension, shards };
}
