import type { Tool } from '../../schemas/tools.js';
import { type ToolInput } from '../tool-helpers.js';
/**
 * Reserved name of the built-in search tool. A caller cannot register a tool
 * under this name, and it is never itself deferred — the model needs one
 * callable entry point to reach everything else.
 */
export declare const TOOL_SEARCH_NAME = "tool_search";
export type HistoryMessage = {
    role: string;
    content: string;
};
export declare function isDeferred(tool: Tool): boolean;
export declare function partitionTools(tools: readonly Tool[]): {
    alwaysLoaded: Tool[];
    deferred: Tool[];
};
/** Strip the registration-only fields so what reaches the model is a plain definition. */
export declare function toWireTool(tool: Tool): Tool;
/**
 * Compact listing of the deferred inventory: one line per tool, name and
 * description only, grouped by `group` where present.
 *
 * Caller order is preserved and groups appear in first-use order, because this
 * text sits in the prompt prefix — a reordering between turns would move the
 * divergence point and cost a re-prefill.
 */
export declare function buildCatalog(deferred: readonly Tool[]): string;
/**
 * The built-in search tool, carrying the catalog in its description.
 *
 * The catalog is deliberately not a set of parameterless tool entries: those
 * render into the same native block and the grammar would accept a call to a
 * tool whose schema the model has never seen. Description text cannot be
 * called, which is the whole point.
 */
export declare function buildToolSearchTool(deferred: readonly Tool[]): Tool;
/**
 * Rank the deferred inventory against a query. Exact name first, then text
 * match. Ties keep registration order so repeated searches are deterministic.
 */
export declare function searchDeferredTools(deferred: readonly Tool[], query: string, limit?: number): Tool[];
export declare function buildToolSearchResult(query: string, matches: readonly Tool[], alreadyLoaded: readonly string[]): string;
/**
 * Which deferred definitions this conversation already carries.
 *
 * Read back from the history rather than held in the session, so `completion()`
 * stays stateless: a reopened chat replaying the same messages resolves the
 * same loaded set, and two concurrent conversations cannot see each other's.
 */
export declare function loadedToolNames(history: readonly HistoryMessage[]): Set<string>;
export type DeferredResolution = {
    /**
     * Definitions that go into the prompt and the parser: always-loaded tools,
     * `tool_search`, and whatever history has loaded.
     */
    toolsToRender: Tool[];
    /** The deferred tools `tool_search` searches over. */
    deferred: Tool[];
};
/**
 * Split a registered tool list into what the prompt carries and what
 * `tool_search` searches over.
 *
 * A loaded definition is declared in the tools block like any other tool, in
 * registration order. A schema that sits only in a `tool` result, outside the
 * block and the tool-call grammar, is not reliably called by small models: they
 * search for it again instead. Declaring it changes the block at the front of
 * the prompt, so the turn after a search re-prefills from there.
 *
 * Returns `null` when nothing defers, so the existing path is untouched.
 */
export declare function resolveDeferredTools(tools: readonly Tool[] | undefined, history: readonly HistoryMessage[]): DeferredResolution | null;
/**
 * Run a `tool_search` call and produce the `tool` message that carries its
 * result. Pure over the history it is given; the caller appends the message.
 *
 * Takes either wire `Tool`s or the Zod-schema `ToolInput` form, because what a
 * caller holds is whatever they passed to `completion()`. Both are converted
 * to wire form first, so the size cap measures the JSON schemas the prompt
 * will declare, not Zod objects.
 */
export declare function executeToolSearch(tools: readonly Tool[] | readonly ToolInput[], args: Record<string, unknown>, history: readonly HistoryMessage[]): string;
