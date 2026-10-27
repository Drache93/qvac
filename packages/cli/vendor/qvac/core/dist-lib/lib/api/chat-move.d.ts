import type { LoggerInterface } from '@qvac/logging';
import type { CapabilityHandlers } from '../../spec/capabilities.d.ts';
import type { ChatMoves } from '../core/chat-move.ts';
export declare function createChatMoveApi(moves: ChatMoves, log: LoggerInterface | null): Pick<CapabilityHandlers, 'moveChatToMesh' | 'chatMoveWatch'>;
