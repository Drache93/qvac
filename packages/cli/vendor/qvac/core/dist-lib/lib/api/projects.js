import { PROJECT_ORDER, PROJECTS } from '../core/collections.js';
import { listedProject, liveMember, readProject } from '../core/contract/projects.js';
import { dueProjectKey } from '../core/project-keys.js';
import { MAX_MESH_NAME_CHARS, MAX_PROJECT_ORDER_IDS, meshNameWithinBounds } from '../../schema/qvac.js';
import { meshWatchable, requireMesh } from './current-mesh.js';
import { requireOurMember, requireWorkspace } from './members.js';
import b4a from 'b4a';
import { CoreError } from '../errors.js';
function toProject(row, named) {
    return {
        projectId: b4a.toHex(row.id),
        name: named?.name ?? '',
        memberIds: row.memberIds ?? [],
        createdBy: row.createdBy ?? undefined,
        createdAt: row.createdAt,
        updatedAt: Math.max(row.updatedAt, named?.namedAt ?? 0)
    };
}
async function list(mesh, meshId, { account, nameOf }) {
    requireWorkspace(mesh, meshId);
    const ours = mesh.ourMemberId ?? (await mesh.refreshOurMember())?.memberId;
    if (!ours) {
        return { projects: [] };
    }
    const projects = [];
    for await (const row of mesh.view.find(PROJECTS)) {
        if (listedProject(row, ours)) {
            projects.push(toProject(row, nameOf(row.id)));
        }
    }
    return { projects: await ordered(projects, mesh.key, account()) };
}
async function ordered(projects, workspaceKey, account) {
    const order = await account?.view.get(PROJECT_ORDER, { workspaceKey });
    const rank = new Map((order?.projectIds ?? []).map((id, i) => [id, i]));
    return projects.sort((a, b) => (rank.get(a.projectId) ?? -1) - (rank.get(b.projectId) ?? -1) || b.createdAt - a.createdAt);
}
async function setOrder(pool, account, { meshId, projectIds }) {
    const workspace = await requireMesh(pool, meshId);
    requireWorkspace(workspace, meshId);
    const ids = [...new Set(projectIds ?? [])];
    if (ids.length > MAX_PROJECT_ORDER_IDS) {
        throw new CoreError('PROJECT_ORDER_TOO_LONG', [MAX_PROJECT_ORDER_IDS]);
    }
    const mesh = account();
    if (!mesh) {
        throw new CoreError('ACCOUNT_MEMBER_UNKNOWN');
    }
    const workspaceKey = workspace.key;
    const existing = await mesh.view.get(PROJECT_ORDER, { workspaceKey });
    await mesh.dispatch('put-project-order', {
        workspaceKey,
        projectIds: ids,
        orderedAt: Math.max(Date.now(), (existing?.orderedAt ?? 0) + 1)
    });
    return { ok: true };
}
async function ourProject(pool, meshId, projectId) {
    const workspace = await requireMesh(pool, meshId);
    requireWorkspace(workspace, meshId);
    const ours = await requireOurMember(workspace);
    const row = await readProject(workspace.view, b4a.from(projectId, 'hex'));
    if (!row || !listedProject(row, ours)) {
        throw new CoreError('PROJECT_NOT_FOUND', [projectId]);
    }
    return { workspace, ours, row };
}
export function projectName(name) {
    const trimmed = name?.trim();
    if (!trimmed) {
        throw new CoreError('PROJECT_NAME_EMPTY');
    }
    if (!meshNameWithinBounds(trimmed)) {
        throw new CoreError('MESH_NAME_TOO_LONG', [MAX_MESH_NAME_CHARS]);
    }
    return trimmed;
}
async function reread({ workspace, row }, nameOf) {
    return toProject((await readProject(workspace.view, row.id)) ?? row, nameOf(row.id));
}
async function projectMesh(pool, { workspace, row }, projectOf) {
    if (!(await projectOf(workspace.key, row.id))) {
        throw new CoreError('PROJECT_NOT_FOUND', [b4a.toHex(row.id)]);
    }
    return requireMesh(pool, b4a.toHex(row.id));
}
async function rename(pool, { projectOf, nameOf }, { meshId, projectId, config }) {
    const name = projectName(config.name);
    const scope = await ourProject(pool, meshId, projectId);
    const project = await projectMesh(pool, scope, projectOf);
    await project.setName(name);
    await project.refreshName();
    return reread(scope, nameOf);
}
async function addMember(pool, { projectOf, nameOf }, { meshId, projectId, memberId }) {
    const scope = await ourProject(pool, meshId, projectId);
    if (!(await liveMember(scope.workspace.view, memberId))) {
        throw new CoreError('PROJECT_MEMBER_NOT_IN_WORKSPACE');
    }
    const project = await projectMesh(pool, scope, projectOf);
    await project.dispatch('put-project-member', { memberId, addedAt: Date.now() });
    const { workspace, row } = scope;
    const batch = workspace.batch();
    batch.dispatch('set-project-listing', { projectId: row.id, memberId });
    const key = await dueProjectKey(workspace.view, memberId, {
        projectId: row.id,
        seed: project.seed
    });
    if (key) {
        batch.dispatch('put-project-key', key);
    }
    await batch.flush();
    return reread(scope, nameOf);
}
async function removeMember(pool, { projectOf, nameOf }, { meshId, projectId, memberId }) {
    const scope = await ourProject(pool, meshId, projectId);
    if (b4a.equals(scope.ours, memberId)) {
        throw new CoreError('MEMBER_REMOVE_SELF');
    }
    const project = await projectMesh(pool, scope, projectOf);
    await project.dispatch('remove-member', { memberId, revokedAt: Date.now() });
    await scope.workspace.dispatch('set-project-listing', {
        projectId: scope.row.id,
        memberId,
        removed: true
    });
    return reread(scope, nameOf);
}
async function remove(pool, { meshId, projectId }) {
    const { workspace, row } = await ourProject(pool, meshId, projectId);
    await workspace.dispatch('delete-project', { projectId: row.id });
    return { ok: true };
}
function watchProjects(pool, names, options) {
    const { account, log } = options;
    return meshWatchable(pool, ({ meshId }, mesh) => list(mesh, meshId, options), {
        name: 'projectsWatch',
        log,
        changes: {
            watch: (listener) => {
                account()?.watch(listener);
                names.watch(listener);
            },
            unwatch: (listener) => {
                account()?.unwatch(listener);
                names.unwatch(listener);
            }
        }
    });
}
export function createProjectsApi(pool, source, options) {
    return {
        createProject: async ({ meshId, config }) => {
            const projectId = await source.createProject(meshId, { name: config.name ?? '' });
            return reread(await ourProject(pool, meshId, projectId), options.nameOf);
        },
        listProjects: async ({ meshId }) => list(await requireMesh(pool, meshId), meshId, options),
        projectsWatch: watchProjects(pool, source, options),
        updateProject: (request) => rename(pool, options, request),
        addProjectMember: (request) => addMember(pool, options, request),
        removeProjectMember: (request) => removeMember(pool, options, request),
        setProjectOrder: (request) => setOrder(pool, options.account, request),
        deleteProject: (request) => remove(pool, request)
    };
}
