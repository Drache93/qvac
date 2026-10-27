import { watchable } from './watchable.js';
export function createChatMoveApi(moves, log) {
    return {
        moveChatToMesh: (request) => moves.move(request),
        chatMoveWatch: watchable(() => moves, (request, store) => store.status(request), { name: 'chatMoveWatch', log })
    };
}
