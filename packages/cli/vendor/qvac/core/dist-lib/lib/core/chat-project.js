import { CHATS } from './collections.js';
import { accountMember } from './contract/members.js';
import { inProject } from './contract/projects.js';
export async function chatProject(chatMesh, chatId, open) {
    if (chatMesh.role === 'project') {
        return chatMesh;
    }
    const chat = await chatMesh.view.get(CHATS, { id: chatId });
    const owner = chat?.projectId ? await accountMember(chatMesh.view) : null;
    const project = owner && chat?.projectId ? await open(chat.projectId) : null;
    if (!owner || project?.role !== 'project' || !(await inProject(project.view, owner))) {
        return null;
    }
    return project;
}
