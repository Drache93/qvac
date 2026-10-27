import type { LoggerInterface } from '@qvac/logging';
import type { CapabilityHandlers } from '../../spec/capabilities.d.ts';
export interface DiagnosticsSource {
    watch(listener: () => void): void;
    unwatch(listener: () => void): void;
    snapshot(): Record<string, unknown>;
    readonly sampled: true;
}
export declare function createDiagnosticsApi(source: DiagnosticsSource, log: LoggerInterface | null): Pick<CapabilityHandlers, 'diagnostics' | 'diagnosticsWatch'>;
