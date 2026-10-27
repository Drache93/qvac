export declare const MAX_GOAL_CHECKS = 8;
export declare const GOAL_CHECKS_ASK: string;
export declare const GOAL_PROOF_ASK: string;
export declare function namedChecks(text: string): string[];
export declare function mergeChecks(host: readonly string[], named: readonly string[]): string[];
export declare function runsCheck(command: string, check: string): boolean;
