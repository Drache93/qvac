export const MAX_CONTENT_CHARS = 800;
export function formatResultsForPrompt(results) {
    if (results.length === 0) {
        return '';
    }
    return results
        .map((result, index) => {
        const content = result.content.length > MAX_CONTENT_CHARS
            ? `${result.content.slice(0, MAX_CONTENT_CHARS)}…`
            : result.content;
        return `[${index + 1}] ${result.title}\nSource: ${result.url}\n${content}`;
    })
        .join('\n\n');
}
