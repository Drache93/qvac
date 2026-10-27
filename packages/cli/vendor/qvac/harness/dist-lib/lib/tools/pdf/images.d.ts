import type { ToolExecuteContext } from '../../contract/index.ts';
import { type CreateRequest } from './request.ts';
interface ToolError {
    readonly error: string;
}
export declare function placeImages(request: CreateRequest, ctx: ToolExecuteContext): Promise<CreateRequest | ToolError>;
export {};
