import { PluginRegistry } from '../../lib/plugins/index.js';
import { barevisorSandbox, GuestShell } from './vm-shell.js';
PluginRegistry.requirePeers('sandbox-vm', {
    barevisor: () => import.meta.resolve('barevisor/sandbox')
});
export { WORKDIR_REFUSED } from './vm-shell.js';
function imageError(image) {
    return image?.kernel && image.initrd
        ? null
        : 'image needs the kernel and initrd paths of a prebuilt guest';
}
export class VmShell {
    name = 'sandbox-vm';
    api = PluginRegistry.API_VERSION;
    addons = { barevisor: () => import('barevisor/sandbox') };
    shell;
    _image;
    _shell;
    constructor({ createSandbox = barevisorSandbox, image, ...vm }) {
        this._image = image;
        this._shell = new GuestShell({ ...vm, image, network: false, disk: false, mounts: {} }, createSandbox);
        this.shell = this._shell;
    }
    validate() {
        return imageError(this._image);
    }
    setup() {
        return { exec: { shell: this._shell }, teardown: () => this._shell.close() };
    }
}
