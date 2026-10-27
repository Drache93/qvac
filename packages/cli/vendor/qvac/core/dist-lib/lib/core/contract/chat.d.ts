import type HyperDB from 'hyperdb';
import type { Router } from '../../../spec/mesh/hyperdispatch/index.js';
export declare function isPurged(tx: HyperDB, chatId: string): Promise<boolean>;
export declare function foreignChat(tx: HyperDB, chatId: string | null | undefined): Promise<boolean>;
export declare function registerChatRoutes(router: Router): void;
