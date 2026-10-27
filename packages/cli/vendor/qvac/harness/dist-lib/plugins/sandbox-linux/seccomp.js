const ARCHES = ['x64', 'arm64'];
const AUDIT = [0xc000003e, 0xc00000b7];
const SOCKET = [41, 198];
const SOCKETPAIR = [53, 199];
const DENIED = {
    ptrace: [101, 117],
    process_vm_readv: [310, 270],
    process_vm_writev: [311, 271],
    io_uring_setup: [425, 425],
    io_uring_enter: [426, 426],
    io_uring_register: [427, 427],
    connect: [42, 203],
    accept: [43, 202],
    accept4: [288, 242],
    bind: [49, 200],
    listen: [50, 201],
    getpeername: [52, 205],
    getsockname: [51, 204],
    shutdown: [48, 210],
    sendto: [44, 206],
    sendmmsg: [307, 269],
    recvmmsg: [299, 243],
    getsockopt: [55, 209],
    setsockopt: [54, 208]
};
const LD_ABS_W = 0x20;
const AND = 0x54;
const JEQ = 0x15;
const JGE = 0x35;
const RET = 0x06;
const RET_ALLOW = 0x7fff0000;
const RET_KILL_PROCESS = 0x80000000;
const RET_EPERM = 0x00050000 | 1;
const NR = 0;
const ARCH = 4;
const ARG0 = 16;
const ARG1 = 24;
const X32_BIT = 0x40000000;
const AF_UNIX = 1;
const TYPE_MASK = 0xf;
const SOCK_STREAM = 1;
const SOCK_SEQPACKET = 5;
export function seccompProgram(arch) {
    const at = ARCHES.indexOf(arch);
    const ops = [
        { code: LD_ABS_W, k: ARCH },
        { code: JEQ, k: AUDIT[at], yes: 'nr' },
        { code: RET, k: RET_KILL_PROCESS },
        { code: LD_ABS_W, k: NR, label: 'nr' },
        ...(arch === 'x64' ? [{ code: JGE, k: X32_BIT, yes: 'deny' }] : []),
        ...Object.values(DENIED).map((nr) => ({ code: JEQ, k: nr[at], yes: 'deny' })),
        { code: JEQ, k: SOCKET[at], yes: 'family' },
        { code: JEQ, k: SOCKETPAIR[at], yes: 'family' },
        { code: RET, k: RET_ALLOW },
        { code: LD_ABS_W, k: ARG0, label: 'family' },
        { code: JEQ, k: AF_UNIX, yes: 'type' },
        { code: RET, k: RET_EPERM, label: 'deny' },
        { code: LD_ABS_W, k: ARG1, label: 'type' },
        { code: AND, k: TYPE_MASK },
        { code: JEQ, k: SOCK_STREAM, yes: 'allow' },
        { code: JEQ, k: SOCK_SEQPACKET, yes: 'allow' },
        { code: RET, k: RET_EPERM },
        { code: RET, k: RET_ALLOW, label: 'allow' }
    ];
    const program = new Uint8Array(ops.length * 8);
    const view = new DataView(program.buffer);
    ops.forEach((op, i) => {
        const target = op.yes ? ops.findIndex(({ label }) => label === op.yes) : i + 1;
        view.setUint16(i * 8, op.code, true);
        view.setUint8(i * 8 + 2, target - i - 1);
        view.setUint32(i * 8 + 4, op.k, true);
    });
    return program;
}
