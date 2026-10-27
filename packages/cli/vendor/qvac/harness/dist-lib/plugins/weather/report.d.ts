import { z } from 'zod';
import { type ResolvedPlace } from './place.ts';
interface Translated {
    readonly value: string;
}
interface CurrentCondition {
    readonly temp_C?: string;
    readonly temp_F?: string;
    readonly FeelsLikeC?: string;
    readonly humidity?: string;
    readonly windspeedKmph?: string;
    readonly weatherDesc?: ReadonlyArray<Translated>;
}
interface HourlyEntry {
    readonly time?: string;
    readonly weatherDesc?: ReadonlyArray<Translated>;
}
interface DailyForecast {
    readonly date?: string;
    readonly maxtempC?: string;
    readonly mintempC?: string;
    readonly maxtempF?: string;
    readonly mintempF?: string;
    readonly hourly?: ReadonlyArray<HourlyEntry>;
}
interface NearestArea {
    readonly areaName?: ReadonlyArray<Translated>;
    readonly region?: ReadonlyArray<Translated>;
    readonly country?: ReadonlyArray<Translated>;
}
export interface WeatherJson {
    readonly nearest_area?: ReadonlyArray<NearestArea>;
    readonly current_condition?: ReadonlyArray<CurrentCondition>;
    readonly weather?: ReadonlyArray<DailyForecast>;
}
export declare const WeatherJsonSchema: z.ZodType<WeatherJson>;
export declare function placeOf(json: WeatherJson): ResolvedPlace | null;
export interface RenderReportOptions {
    readonly asked: string;
    readonly verified: boolean;
}
export declare function renderReport(json: WeatherJson, place: ResolvedPlace, { asked, verified }: RenderReportOptions): string;
export {};
