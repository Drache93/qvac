import { AbortController } from 'bare-abort-controller';
import { z } from 'zod';
import { HarnessError } from '../../lib/errors.js';
import { checkQualifier, describePlace, fold } from './place.js';
export const GEOCODER_HOST = 'geocoding-api.open-meteo.com';
export const GEOCODE_TIMEOUT_MS = 5_000;
const CONTENDER_RATIO = 10;
const MAX_LISTED = 4;
const GeocodeSchema = z.object({
    results: z
        .array(z.object({
        name: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        country: z.string().optional(),
        admin1: z.string().optional(),
        population: z.number().optional()
    }))
        .optional()
});
export async function geocode(city, lookup) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(undefined), lookup.timeoutMs);
    const onLookupAbort = () => controller.abort(undefined);
    lookup.signal.addEventListener('abort', onLookupAbort);
    try {
        return await search(city, lookup, controller.signal);
    }
    catch (err) {
        if (lookup.signal.aborted) {
            throw err;
        }
        return [];
    }
    finally {
        clearTimeout(timeout);
        lookup.signal.removeEventListener('abort', onLookupAbort);
    }
}
export function geocoderUrl(city) {
    const query = `name=${encodeURIComponent(city)}&count=10&language=en&format=json`;
    return new URL(`https://${GEOCODER_HOST}/v1/search?${query}`);
}
async function search(city, { fetch }, signal) {
    const response = await fetch(geocoderUrl(city), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal,
        redirect: 'manual'
    });
    if (response.status !== 200) {
        throw new HarnessError('GEOCODER_HTTP_STATUS', [response.status]);
    }
    const { results = [] } = GeocodeSchema.parse(JSON.parse(await response.text()));
    return results.map((result) => ({
        area: result.name,
        region: result.admin1 ?? '',
        country: result.country ?? '',
        latitude: result.latitude,
        longitude: result.longitude,
        population: result.population
    }));
}
export function choose(city, qualifier, candidates) {
    const exact = candidates.filter((candidate) => fold(candidate.area) === fold(city));
    const top = byPopulation(exact)[0] ?? candidates[0];
    if (top === undefined) {
        return null;
    }
    if (qualifier !== null) {
        return qualified(qualifier, { exact, candidates, top });
    }
    const contenders = contendersOf(exact);
    if (contenders.length > 1) {
        return { contenders };
    }
    return { place: top, verified: exact.includes(top) };
}
function qualified(qualifier, { exact, candidates, top }) {
    const named = (pool) => pool.find((candidate) => checkQualifier(qualifier, candidate) === 'match');
    const namesake = named(byPopulation(exact));
    if (namesake !== undefined) {
        return { place: namesake, verified: true };
    }
    return { place: named(candidates) ?? top, verified: false };
}
function contendersOf(exact) {
    const pool = byPopulation(exact);
    const top = pool[0]?.population;
    if (top === undefined) {
        return [];
    }
    const lines = pool.map(describePlace);
    return pool
        .filter((candidate, index) => candidate.population !== undefined &&
        candidate.population * CONTENDER_RATIO >= top &&
        lines.indexOf(describePlace(candidate)) === index)
        .slice(0, MAX_LISTED);
}
function byPopulation(candidates) {
    return [...candidates].sort((a, b) => (b.population ?? -1) - (a.population ?? -1));
}
