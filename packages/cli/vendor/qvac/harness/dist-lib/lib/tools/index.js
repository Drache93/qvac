import { createFileTools } from './files/index.js';
import { deniedRootsFor } from './fs/scope.js';
import { createHttpRequestTool } from './http-request.js';
import { createOfficeTools } from './office.js';
import { compileOperationTools } from './operations/compile.js';
import { createPdfTool } from './pdf.js';
import { createSkillTool } from './skill.js';
import { stageInputs } from './attachments/staging.js';
import { ensureBundledSkillsDir } from './skills/bundled-dir.js';
import { credentialAllowListFor } from './skills/credential-grants.js';
import { createWebFetchTool } from './web-fetch.js';
export class Tools {
    static deniedRoots = deniedRootsFor;
    static bundledSkillsDir = ensureBundledSkillsDir;
    static stageInputs = stageInputs;
    static operations = compileOperationTools;
    static product({ sdkHome, skillsDir, skillCatalog, credentialStore, files = true }) {
        const deniedRoots = deniedRootsFor(sdkHome);
        const credentialed = skillCatalog
            ? { credentialStore, credentialAllowList: credentialAllowListFor(skillCatalog) }
            : undefined;
        const httpRequestTool = createHttpRequestTool(credentialed);
        const tools = [
            httpRequestTool,
            createWebFetchTool(),
            ...(files ? createFileTools({ deniedRoots }) : []),
            createPdfTool(),
            ...createOfficeTools()
        ];
        if (skillCatalog) {
            tools.push(...compileOperationTools(skillCatalog, { httpRequestTool }));
        }
        if (skillsDir) {
            tools.push(createSkillTool({ skillsDir }));
        }
        return tools;
    }
}
