import { type DecideParams, type DecisionResult, type DecisionResponse, type RPCOptions } from '../schemas/index.js';
/**
 * Answers typed decision questions about one state or a batch of states.
 *
 * @param params - Model ID, states, questions, and optional token budgets.
 * @param options - Dispatch options.
 * @returns A promise with a synchronous requestId for cancel(). One state
 * resolves to one result; a batch resolves to results in input order.
 * @throws {RequestValidationFailedError} If the request is invalid.
 * @throws {InferenceCancelledError} If the request is cancelled.
 * @throws {RequestRejectedByPolicyError} If this model's decision queue is full.
 * @throws {InvalidResponseError} If the handler returns a malformed result.
 */
export declare function decide(params: Extract<DecideParams, {
    state: unknown;
}>, options?: RPCOptions): Promise<DecisionResult> & {
    requestId: string;
};
export declare function decide(params: Extract<DecideParams, {
    states: unknown;
}>, options?: RPCOptions): Promise<DecisionResult[]> & {
    requestId: string;
};
export declare function decide(params: DecideParams, options?: RPCOptions): Promise<DecisionResponse> & {
    requestId: string;
};
