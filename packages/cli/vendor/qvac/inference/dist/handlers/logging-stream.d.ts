import type { LoggingStreamRequest, LoggingStreamResponse } from '../schemas/index.js';
import type { StreamHandlerContext } from './types.js';
export declare function handleLoggingStream(request: LoggingStreamRequest, context?: StreamHandlerContext): AsyncGenerator<LoggingStreamResponse>;
