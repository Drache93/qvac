import { isOwnKickedRow } from '../helpers/index.js';
import b4a from 'b4a';
export function syncOwnMember(mesh, device) {
    if (!device.writerKey || !b4a.equals(device.writerKey, mesh.localWriterKey)) {
        return;
    }
    void mesh.refreshOurMember();
}
export function syncDeviceRevocation(mesh, device) {
    if (!isOwnKickedRow(mesh, device))
        return;
    mesh.log?.info('sync', 'our writer was revoked (kicked)');
    mesh.emit('kicked');
}
