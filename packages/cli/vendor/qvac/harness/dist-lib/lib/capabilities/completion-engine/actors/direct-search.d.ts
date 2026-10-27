import type { CompletionActor, CompletionDeps } from '../session.ts';
import type { CompletionContext } from '../../../machine/index.ts';
import type { DirectToolOutput, SearchingOutput } from '../stages.ts';
export declare const directSearch: CompletionActor<SearchingOutput>;
export declare function startDirectSearch(deps: CompletionDeps, context: CompletionContext, query: string): Promise<DirectToolOutput | null>;
