import path from 'bare-path';
import { fileURLToPath } from 'bare-url';
import HRPCBuilder from 'hrpc';
import Hyperschema from 'hyperschema';
import HyperschemaTS from 'hyperschema-ts';
import { resetHrpcIds, rewindSpec, unstageSpec } from './baseline.js';
import { writeBind, writeClient } from './generate.js';
import { registerHarnessApi, registerHarnessTypes } from './harness.js';
const dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(dir, '..');
const SPEC_DIR = path.join(dir, '..', 'spec');
const SCHEMA_DIR = path.join(SPEC_DIR, 'hyperschema');
const HRPC_DIR = path.join(SPEC_DIR, 'hrpc');
const BASELINE_DIRS = [SPEC_DIR];
const HAND_WRITTEN = [
    'spec/index.js',
    'spec/index.d.ts',
    'spec/calls.d.ts',
    'spec/bind.d.ts',
    'spec/hrpc/index.d.ts',
    'spec/hrpc/messages.d.ts'
];
const baselines = rewindSpec(ROOT, BASELINE_DIRS, {
    carries: 'spec/hyperschema/schema.json',
    keep: HAND_WRITTEN
});
const schema = Hyperschema.from(SCHEMA_DIR);
registerHarnessTypes(schema.namespace('harness'));
Hyperschema.toDisk(schema, { esm: true });
HyperschemaTS.toDisk(schema);
resetHrpcIds(HRPC_DIR);
const builder = HRPCBuilder.from(SCHEMA_DIR, HRPC_DIR);
registerHarnessApi(builder.namespace('harness'));
HRPCBuilder.toDisk(builder);
writeBind(builder, path.join(SPEC_DIR, 'bind.js'));
writeClient(builder, path.join(SPEC_DIR, 'calls.js'), 'harnessClient');
if (baselines.length > 0) {
    unstageSpec(ROOT, BASELINE_DIRS);
}
console.log('harness contract spec generated under spec/');
