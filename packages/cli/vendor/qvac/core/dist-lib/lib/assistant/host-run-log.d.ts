import type { HostRunLog } from '@qvac/harness';
import { type EngineBoot } from '@qvac/harness/run-log';
import type { ScopedCapabilities } from '../mesh-scoped-engine.ts';
import type { ChatMessage } from './message.ts';
type RunLogEngine = Pick<ScopedCapabilities, 'hostRunLogBegin' | 'hostRunLogAppend' | 'hostRunLogRelease'>;
export declare function createHostRunLogAdapter(engine: RunLogEngine): HostRunLog;
export declare function loggedMessages(boot: EngineBoot | undefined): ChatMessage[] | null;
export {};
