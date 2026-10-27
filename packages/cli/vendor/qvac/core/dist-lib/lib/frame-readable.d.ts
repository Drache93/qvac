import type { Readable } from 'streamx';
import type { WatchStream } from '../spec/capabilities.d.ts';
export declare function frameReadable<Frame>(stream: Readable): Readable & WatchStream<Frame>;
