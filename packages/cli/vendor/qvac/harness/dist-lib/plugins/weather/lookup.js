import { AbortController } from 'bare-abort-controller';
import { HarnessError } from '../../lib/errors.js';
import { errorMessage } from '../../lib/guards.js';
import { choose, geocode, GEOCODE_TIMEOUT_MS, GEOCODER_HOST, geocoderUrl } from './geocode.js';
import { checkQualifier, cityMatches, describePlace, qualifierOf } from './place.js';
import { placeOf, renderReport, WeatherJsonSchema } from './report.js';
const WEATHER_HOST = 'wttr.in';
const LOOKUP_TIMEOUT_MS = 15_000;
function forecastUrl(path) {
    return new URL(`https://${WEATHER_HOST}/${path}?format=j1`);
}
function cityOf(location) {
    return (location.split(',')[0] ?? '').trim();
}
function egress(args) {
    if (typeof args.location !== 'string' || args.location.trim().length === 0) {
        return null;
    }
    const location = args.location.trim();
    const byName = forecastUrl(encodeURIComponent(location)).href;
    const city = cityOf(location);
    return city.length === 0 ? [byName] : [geocoderUrl(city).href, byName];
}
export function createWeatherLookupTool({ geocodeTimeoutMs = GEOCODE_TIMEOUT_MS } = {}) {
    return {
        name: 'weather_lookup',
        toolset: 'http-request',
        skillGated: true,
        autoApprove: true,
        description: 'Look up the current weather and a three-day forecast for a place, via wttr.in. ' +
            'Returns the place the service resolved on its first line, then the conditions now and ' +
            'one line per day. Use it for any question about weather, temperature or forecast. ' +
            'When a name matches several places it answers with a question listing them.',
        parameters: {
            type: 'object',
            properties: {
                location: {
                    type: 'string',
                    description: 'The place exactly as the user wrote it, including any country or state: ' +
                        '"Nassau, Bahamas", "Paris, Texas", "London"'
                }
            },
            required: ['location']
        },
        effect: () => 'read',
        stableRead: true,
        resource: () => ({ kind: 'host', label: `${GEOCODER_HOST}, ${WEATHER_HOST}` }),
        egress,
        execute: (args, ctx) => execute(args.location, {
            fetch: ctx?.fetch,
            signal: ctx?.signal,
            timeoutMs: geocodeTimeoutMs
        })
    };
}
export const weatherLookupTool = createWeatherLookupTool();
async function execute(raw, { fetch, signal, timeoutMs }) {
    if (typeof raw !== 'string' || raw.trim().length === 0) {
        return { error: 'location must be a non-empty string' };
    }
    const location = raw.trim();
    if (signal?.aborted) {
        return { error: 'weather_lookup cancelled' };
    }
    if (!fetch) {
        return { error: 'weather_lookup has no network access' };
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(undefined), LOOKUP_TIMEOUT_MS);
    const onCallerAbort = () => controller.abort(undefined);
    signal?.addEventListener('abort', onCallerAbort);
    try {
        return await lookup(location, { fetch, signal: controller.signal, timeoutMs });
    }
    catch (err) {
        return failure(err, controller.signal, signal);
    }
    finally {
        clearTimeout(timeout);
        signal?.removeEventListener('abort', onCallerAbort);
    }
}
async function lookup(location, request) {
    const city = cityOf(location);
    const candidates = city.length === 0 ? [] : await geocode(city, request);
    const choice = choose(city, qualifierOf(location), candidates);
    if (choice === null) {
        return byName(location, request);
    }
    if ('contenders' in choice) {
        return reply(which(city, choice.contenders));
    }
    return byCoordinates(location, choice, request);
}
async function byCoordinates(location, { place, verified }, request) {
    const fetched = await forecast(`${place.latitude},${place.longitude}`, location, request);
    if (!('json' in fetched)) {
        return fetched;
    }
    return { content: renderReport(fetched.json, place, { asked: location, verified }) };
}
async function byName(location, request) {
    const fetched = await forecast(encodeURIComponent(location), location, request);
    if (!('json' in fetched)) {
        return fetched;
    }
    const place = placeOf(fetched.json);
    if (place === null) {
        return reply(notFound(location));
    }
    const qualifier = qualifierOf(location);
    const verdict = qualifier === null ? null : checkQualifier(qualifier, place);
    const named = cityMatches(location, place);
    if (verdict === 'contradiction' && !named) {
        return reply(`No such place: "${location}". ${WEATHER_HOST} resolved it to ` +
            `${describePlace(place)}, which is somewhere else.`);
    }
    const verified = qualifier === null ? named : verdict === 'match';
    return { content: renderReport(fetched.json, place, { asked: location, verified }) };
}
async function forecast(path, location, { fetch, signal }) {
    const response = await fetch(forecastUrl(path), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal,
        redirect: 'manual'
    });
    if (response.status >= 300 && response.status < 400) {
        return { error: `${WEATHER_HOST} redirected the lookup for "${location}"` };
    }
    return readForecast(response.status, await response.text(), location);
}
function readForecast(status, body, location) {
    if (/location not found/i.test(body)) {
        return reply(notFound(location));
    }
    if (status !== 200) {
        return { error: unavailable(`it answered HTTP ${status}`), code: 'transport' };
    }
    try {
        return { json: WeatherJsonSchema.parse(JSON.parse(body)) };
    }
    catch {
        return { error: unavailable('it did not return a forecast') };
    }
}
function failure(err, signal, callerSignal) {
    if (callerSignal?.aborted) {
        return { error: 'weather_lookup cancelled' };
    }
    if (signal.aborted) {
        return { error: `weather_lookup timed out after ${LOOKUP_TIMEOUT_MS} ms`, code: 'timeout' };
    }
    if (HarnessError.is(err, 'FETCH_REFUSED')) {
        return { error: errorMessage(err) };
    }
    return { error: unavailable(errorMessage(err)), code: 'transport' };
}
function unavailable(reason) {
    return `The weather service could not be reached: ${reason}.`;
}
function reply(content) {
    return { content, answer: true };
}
function notFound(location) {
    return `No such place: "${location}". ${WEATHER_HOST} does not know it.`;
}
function which(city, places) {
    return `Which ${city}: ${places.map(describePlace).join('; ')}?`;
}
