export interface Exit {
    code: number | null;
    signal: string | null;
}
export interface AgentProcess {
    readonly exited: Promise<Exit>;
    readonly closed: Promise<Exit>;
    write(line: string): void;
    end(): void;
    onLine(handle: (line: string) => void): void;
    stop(graceMs: number, signals: readonly (string | null)[]): Promise<Exit>;
    stderr(): string;
}
export interface SpawnOptions {
    cwd: string;
    env: Record<string, string>;
}
export declare function spawnAgent(command: string, args: readonly string[], { cwd, env }: SpawnOptions): AgentProcess;
export declare function agentEnv(home: string | null, keyEnv?: string, key?: string | null): Record<string, string>;
