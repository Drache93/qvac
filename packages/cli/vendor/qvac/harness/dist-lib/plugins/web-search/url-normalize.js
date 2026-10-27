const TRACKING_PARAM_RE = /^(utm_\w+|fbclid|gclid)$/i;
function stripTrackingParams(search) {
    if (!search) {
        return '';
    }
    const kept = search
        .slice(1)
        .split('&')
        .filter((pair) => {
        const key = pair.split('=')[0] || '';
        return !TRACKING_PARAM_RE.test(key);
    });
    return kept.length > 0 ? `?${kept.join('&')}` : '';
}
export function normalizeUrl(raw) {
    try {
        const u = new URL(raw);
        const host = u.hostname.toLowerCase().replace(/^www\./, '');
        const search = stripTrackingParams(u.search);
        return host + u.pathname.replace(/\/+$/, '') + search;
    }
    catch {
        return raw;
    }
}
