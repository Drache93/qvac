const QUALIFIER_ALIASES = [
    ['united states of america', 'united states of america'],
    ['united states', 'united states of america'],
    ['u.s.a.', 'united states of america'],
    ['u.s.', 'united states of america'],
    ['usa', 'united states of america'],
    ['us', 'united states of america'],
    ['united kingdom', 'united kingdom'],
    ['great britain', 'united kingdom'],
    ['england', 'united kingdom'],
    ['scotland', 'united kingdom'],
    ['wales', 'united kingdom'],
    ['northern ireland', 'united kingdom'],
    ['u.k.', 'united kingdom'],
    ['uk', 'united kingdom'],
    ['gb', 'united kingdom'],
    ['united arab emirates', 'united arab emirates'],
    ['uae', 'united arab emirates'],
    ['holland', 'netherlands'],
    ['schweiz', 'switzerland'],
    ['suisse', 'switzerland'],
    ['deutschland', 'germany'],
    ['espana', 'spain'],
    ['italia', 'italy']
];
const OTHER_SUBDIVISIONS = {
    ab: 'alberta',
    bc: 'british columbia',
    mb: 'manitoba',
    nb: 'new brunswick',
    nl: 'newfoundland',
    ns: 'nova scotia',
    on: 'ontario',
    pe: 'prince edward island',
    qc: 'quebec',
    sk: 'saskatchewan',
    nsw: 'new south wales',
    vic: 'victoria',
    qld: 'queensland',
    wa: 'western australia',
    sa: 'south australia',
    tas: 'tasmania',
    nt: 'northern territory',
    act: 'australian capital territory'
};
const US_STATES = {
    al: 'alabama',
    ak: 'alaska',
    az: 'arizona',
    ar: 'arkansas',
    ca: 'california',
    co: 'colorado',
    ct: 'connecticut',
    de: 'delaware',
    fl: 'florida',
    ga: 'georgia',
    hi: 'hawaii',
    id: 'idaho',
    il: 'illinois',
    in: 'indiana',
    ia: 'iowa',
    ks: 'kansas',
    ky: 'kentucky',
    la: 'louisiana',
    me: 'maine',
    md: 'maryland',
    ma: 'massachusetts',
    mi: 'michigan',
    mn: 'minnesota',
    ms: 'mississippi',
    mo: 'missouri',
    mt: 'montana',
    ne: 'nebraska',
    nv: 'nevada',
    nh: 'new hampshire',
    nj: 'new jersey',
    nm: 'new mexico',
    ny: 'new york',
    nc: 'north carolina',
    nd: 'north dakota',
    oh: 'ohio',
    ok: 'oklahoma',
    or: 'oregon',
    pa: 'pennsylvania',
    ri: 'rhode island',
    sc: 'south carolina',
    sd: 'south dakota',
    tn: 'tennessee',
    tx: 'texas',
    ut: 'utah',
    vt: 'vermont',
    va: 'virginia',
    wa: 'washington',
    wv: 'west virginia',
    wi: 'wisconsin',
    wy: 'wyoming',
    dc: 'district of columbia'
};
export function fold(value) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}
export function describePlace(place) {
    return [place.area, place.region, place.country]
        .filter((part, index, parts) => part.length > 0 && parts.indexOf(part) === index)
        .join(', ');
}
export function qualifierOf(location) {
    const comma = location.indexOf(',');
    if (comma === -1) {
        return null;
    }
    const qualifier = fold(location.slice(comma + 1));
    return qualifier.length > 0 ? qualifier : null;
}
function expand(qualifier) {
    const code = qualifier.replace(/ /g, '');
    const subdivision = US_STATES[code] ?? OTHER_SUBDIVISIONS[code];
    if (subdivision !== undefined) {
        return subdivision;
    }
    for (const [alias, full] of QUALIFIER_ALIASES) {
        if (qualifier === fold(alias))
            return full;
    }
    return qualifier;
}
function initialsOf(name) {
    return name
        .split(' ')
        .map((word) => word[0] ?? '')
        .join('');
}
const ABBREVIATION = /^[a-z]{1,3}$/;
export function cityMatches(location, place) {
    const city = fold(location.split(',')[0] ?? '');
    return city.length > 0 && fold(describePlace(place)).includes(city);
}
export function checkQualifier(qualifier, place) {
    const wanted = expand(qualifier);
    const code = qualifier.replace(/ /g, '');
    const opaque = wanted === qualifier && ABBREVIATION.test(code);
    for (const candidate of [fold(place.region), fold(place.country)]) {
        if (candidate.length === 0)
            continue;
        if (initialsOf(candidate) === code)
            return 'match';
        if (opaque) {
            continue;
        }
        if (candidate.includes(wanted) || wanted.includes(candidate)) {
            return 'match';
        }
    }
    return opaque ? 'unverifiable' : 'contradiction';
}
