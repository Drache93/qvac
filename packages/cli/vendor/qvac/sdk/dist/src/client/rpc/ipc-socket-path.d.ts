/**
 * Create the endpoint the worker dials.
 *
 * On Unix the socket sits in a fresh directory that only the current user can
 * enter, so other local users cannot reach it whatever the process umask. On
 * Windows it is a named pipe, whose default access already denies other users.
 */
export declare function createIPCSocketPath(): string;
/** Remove the socket file and its directory. Named pipes have nothing to remove. */
export declare function removeIPCSocketPath(socketPath: string): void;
//# sourceMappingURL=ipc-socket-path.d.ts.map