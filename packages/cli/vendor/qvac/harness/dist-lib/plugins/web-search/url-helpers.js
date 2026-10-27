export function urlMatchesHost(url, host) {
    let hostname;
    try {
        hostname = new URL(url).hostname.toLowerCase();
    }
    catch {
        return false;
    }
    const target = host.toLowerCase();
    return hostname === target || hostname.endsWith(`.${target}`);
}
