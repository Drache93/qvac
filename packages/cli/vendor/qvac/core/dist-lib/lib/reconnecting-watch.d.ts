import type { WatchStream } from './api/index.ts';
export declare function reconnectingWatch<Frame>(open: () => WatchStream<Frame>, onDisconnect: (error: Error) => void): WatchStream<Frame>;
