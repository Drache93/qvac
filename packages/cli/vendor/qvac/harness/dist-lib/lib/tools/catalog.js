import { toSdkTool } from '../capabilities/sdk-tool.js';
export function toolCatalog(tools) {
    return tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        skillGated: tool.skillGated === true,
        scopeRequired: false,
        rootsRequired: tool.rootsRequired === true,
        writeRootsRequired: tool.writeRootsRequired === true,
        toolset: tool.toolset,
        promptChars: JSON.stringify(toSdkTool(tool)).length
    }));
}
