export declare function transitionName(named: unknown): string;
export interface MachineDefinitionNode {
    id: string;
    type: string;
    initial?: string;
    tags: string[];
    entry: string[];
    exit: string[];
    states?: Record<string, MachineDefinitionNode>;
    on?: Record<string, MachineTransitionDefinition[]>;
    always?: MachineTransitionDefinition[];
    invoke: {
        id: string;
        src: string;
    }[];
}
export interface MachineTransitionDefinition {
    eventType: string;
    target?: string[];
    guard?: string;
    actions?: string[];
}
export declare function completionMachineDefinition(): MachineDefinitionNode;
