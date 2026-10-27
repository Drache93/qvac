import { z } from 'zod';
import { describePlace } from './place.js';
const TranslatedSchema = z.array(z.object({ value: z.string() })).optional();
export const WeatherJsonSchema = z.object({
    nearest_area: z
        .array(z.object({ areaName: TranslatedSchema, region: TranslatedSchema, country: TranslatedSchema }))
        .optional(),
    current_condition: z
        .array(z.object({
        temp_C: z.string().optional(),
        temp_F: z.string().optional(),
        FeelsLikeC: z.string().optional(),
        humidity: z.string().optional(),
        windspeedKmph: z.string().optional(),
        weatherDesc: TranslatedSchema
    }))
        .optional(),
    weather: z
        .array(z.object({
        date: z.string().optional(),
        maxtempC: z.string().optional(),
        mintempC: z.string().optional(),
        maxtempF: z.string().optional(),
        mintempF: z.string().optional(),
        hourly: z
            .array(z.object({ time: z.string().optional(), weatherDesc: TranslatedSchema }))
            .optional()
    }))
        .optional()
});
const MAX_DAYS = 3;
const DAY_LABELS = ['today', 'tomorrow'];
const RANGE = '\u2013';
const NOON = 4;
function firstValue(values) {
    return values?.[0]?.value?.trim() ?? '';
}
export function placeOf(json) {
    const area = json.nearest_area?.[0];
    if (area === undefined) {
        return null;
    }
    const place = {
        area: firstValue(area.areaName),
        region: firstValue(area.region),
        country: firstValue(area.country)
    };
    return place.area || place.region || place.country ? place : null;
}
export function renderReport(json, place, { asked, verified }) {
    const lines = [headline(place, asked, verified)];
    const now = json.current_condition?.[0];
    if (now !== undefined) {
        lines.push(currentLine(now));
    }
    const days = json.weather?.slice(0, MAX_DAYS) ?? [];
    for (const [index, day] of days.entries()) {
        lines.push(dailyLine(day, index));
    }
    return lines.join('\n');
}
function headline(place, asked, verified) {
    const resolved = describePlace(place);
    if (verified) {
        return resolved;
    }
    return `${resolved} (not "${asked}" — this is where it resolved)`;
}
function currentLine(now) {
    const parts = [`Now: ${now.temp_C ?? '?'}°C / ${now.temp_F ?? '?'}°F`];
    const desc = firstValue(now.weatherDesc);
    if (desc) {
        parts.push(desc);
    }
    if (now.FeelsLikeC !== undefined) {
        parts.push(`feels like ${now.FeelsLikeC}°C`);
    }
    if (now.humidity !== undefined) {
        parts.push(`humidity ${now.humidity}%`);
    }
    if (now.windspeedKmph !== undefined) {
        parts.push(`wind ${now.windspeedKmph} km/h`);
    }
    return parts.join(', ');
}
function dailyLine(day, index) {
    const label = DAY_LABELS[index];
    const date = `${day.date ?? '?'}${label === undefined ? '' : ` (${label})`}`;
    const celsius = `${day.mintempC ?? '?'}${RANGE}${day.maxtempC ?? '?'}°C`;
    const fahrenheit = `${day.mintempF ?? '?'}${RANGE}${day.maxtempF ?? '?'}°F`;
    const desc = firstValue(day.hourly?.[NOON]?.weatherDesc);
    return `${date}: ${celsius} / ${fahrenheit}${desc ? `, ${desc}` : ''}`;
}
