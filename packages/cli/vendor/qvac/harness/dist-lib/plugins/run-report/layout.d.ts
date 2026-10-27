import type { MachineDefinitionNode } from '../../lib/machine/index.ts';
export type NodeKind = 'state' | 'final' | 'history' | 'start' | 'any';
export interface ChartNode {
    id: string;
    label: string;
    group: string;
    kind: NodeKind;
    x: number;
    y: number;
    w: number;
    h: number;
    stays: string[];
}
export interface ChartEdge {
    key: string;
    source: string;
    target: string;
    event: string;
    guard: string | null;
    points: [number, number][];
    label: {
        x: number;
        y: number;
        w: number;
        h: number;
    };
}
export interface Chart {
    w: number;
    h: number;
    nodes: ChartNode[];
    edges: ChartEdge[];
}
export interface Ran {
    visits: Record<string, number[]>;
    edges: Record<string, number[]>;
}
export declare function layout(definition: MachineDefinitionNode, ran?: Ran): Promise<Chart>;
export declare function eventName(type: string): string;
