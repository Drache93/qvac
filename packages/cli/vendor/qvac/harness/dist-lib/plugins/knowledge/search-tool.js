export const KNOWLEDGE_SEARCH_TOOL = 'knowledge_search';
export function knowledgeSearchTool(knowledge) {
    return {
        name: KNOWLEDGE_SEARCH_TOOL,
        toolset: 'knowledge',
        autoApprove: true,
        description: 'Search the knowledge shared with this conversation: files, documents and past chats. ' +
            'Use it when the answer may be in them and the passages already given do not have it.',
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'What to look for, in your own words: "the deadline in the lease"'
                }
            },
            required: ['query']
        },
        effect: () => 'read',
        async execute(args, ctx) {
            const query = typeof args.query === 'string' ? args.query.trim() : '';
            if (!query) {
                return { error: 'query must be a non-empty string' };
            }
            const scopes = ctx?.knowledge?.scopes ?? [];
            const hits = scopes.length
                ? await knowledge.search({ text: query, scopes, signal: ctx?.signal })
                : [];
            return {
                results: hits.map(({ artifactId, chunkId, text }) => ({
                    source: artifactId,
                    chunkId,
                    text
                }))
            };
        }
    };
}
