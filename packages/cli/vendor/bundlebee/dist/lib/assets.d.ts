import URL from 'bare-url';
import type { ReleasePin, Platform, Signal } from './types';
import type Buffer from 'bare-buffer';
export declare function materialize(pin: ReleasePin, assets: ReadonlyMap<string, Buffer>, options: {
    directory?: string | {
        readonly href: string;
    };
    target: Platform;
    signal?: Signal;
}): Promise<Map<string, URL>>;
