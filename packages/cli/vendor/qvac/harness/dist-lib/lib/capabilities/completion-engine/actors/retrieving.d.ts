import type { KnowledgeHit } from '../../../contract/knowledge.ts';
import type { CompletionActor, CompletionDeps } from '../session.ts';
import type { RetrievingOutput } from '../stages.ts';
export declare const retrieving: CompletionActor<RetrievingOutput>;
interface KnowledgeSearch {
    id: string;
    text: string;
}
export declare function knowledgeSearch({ args, services, operations }: CompletionDeps, { id, text }: KnowledgeSearch): Promise<KnowledgeHit[]>;
export {};
