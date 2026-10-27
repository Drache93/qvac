const URL_LITERAL = /https?:\/\/[^\s'"`\\<>(){}[\]]+/gi;
export function namedHosts(source) {
    const hosts = new Set();
    for (const [match] of source.matchAll(URL_LITERAL)) {
        try {
            hosts.add(new URL(match).hostname.toLowerCase());
        }
        catch { }
    }
    return [...hosts];
}
export function hostIsNamed(host, named) {
    const bare = (value) => value.toLowerCase().replace(/^www\./, '');
    return named.some((name) => bare(name) === bare(host));
}
