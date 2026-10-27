import type { ReportModel } from './model.ts';
import type { Outcome } from './story.ts';
export type FlowKind = 'start' | 'handoff' | 'steer' | 'round' | 'call' | 'end';
export type FlowStatus = Outcome | 'model' | 'start' | 'done' | 'error';
export interface FlowNode {
    id: string;
    kind: FlowKind;
    status: FlowStatus;
    title: string;
    meta: string;
    lines: string[];
    badge: string;
    round: number | null;
    call: number | null;
    from: number | null;
    steps: number[];
    x: number;
    y: number;
    w: number;
    h: number;
}
export interface FlowEdge {
    source: string;
    target: string;
    points: [number, number][];
}
export interface Flow {
    w: number;
    h: number;
    nodes: FlowNode[];
    edges: FlowEdge[];
}
export declare function flow(model: ReportModel): Flow;
