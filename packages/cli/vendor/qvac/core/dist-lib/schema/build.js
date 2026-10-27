import fs from 'bare-fs';
import path from 'bare-path';
import { fileURLToPath } from 'bare-url';
import { spawnSync } from 'bare-subprocess';
import regen from 'hyperschema-regen';
import HRPCBuilder from 'hrpc';
import Hyperconf from 'hyperconf/builder';
import Hyperdispatch from 'hyperdispatch';
import Hyperschema from 'hyperschema';
import HyperschemaTS from 'hyperschema-ts';
import HyperDB from 'hyperdb/builder';
import { resetHrpcIds, rewindSpec, unstageSpec } from '@qvac/harness/schema/baseline';
import { assertFieldOrder } from './field-order.js';
import { VENDORED_MIN_SUPPORTED_VERSION, registerConfigTypes } from './config.js';
import { registerEngineApi, registerEngineTypes } from './engine.js';
import { writeBind, writeCapabilities, writeClient, writeConfigTypes } from '@qvac/harness/schema/generate';
import { registerLocalCollections, registerLocalTypes } from './local.js';
import { registerQvacCollections, registerQvacDispatch, registerQvacTypes } from './qvac.js';
const dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(dir, '..');
const SPEC_DIR = path.join(dir, '..', 'spec');
const SCHEMA_DIR = path.join(SPEC_DIR, 'hyperschema');
const HRPC_DIR = path.join(SPEC_DIR, 'hrpc');
const LOCAL_DIR = path.join(SPEC_DIR, 'local');
const LOCAL_SCHEMA_DIR = path.join(LOCAL_DIR, 'hyperschema');
const LOCAL_DB_DIR = path.join(LOCAL_DIR, 'hyperdb');
const MESH_DIR = path.join(SPEC_DIR, 'mesh');
const MESH_SCHEMA_DIR = path.join(MESH_DIR, 'hyperschema');
const MESH_DB_DIR = path.join(MESH_DIR, 'hyperdb');
const MESH_DISPATCH_DIR = path.join(MESH_DIR, 'hyperdispatch');
const CONFIG_SCHEMA_DIR = path.join(SPEC_DIR, 'config', 'hyperschema');
const CONFIG_CONF_DIR = path.join(SPEC_DIR, 'config', 'hyperconf');
const MESH_DB_JSON = path.join(MESH_DB_DIR, 'db.json');
const MESH_DISPATCH_JSON = path.join(MESH_DISPATCH_DIR, 'dispatch.json');
const LOCAL_DB_JSON = path.join(LOCAL_DB_DIR, 'db.json');
const MESH_SCHEMA_JSON = path.join(MESH_SCHEMA_DIR, 'schema.json');
const BASELINE_DIRS = [SPEC_DIR];
const HAND_WRITTEN = [
    'spec/index.js',
    'spec/index.d.ts',
    'spec/calls.d.ts',
    'spec/bind.d.ts',
    'spec/hrpc/index.d.ts',
    'spec/hrpc/messages.d.ts',
    'spec/mesh/hyperdispatch/index.d.ts',
    'spec/mesh/hyperdb/index.d.ts',
    'spec/local/hyperdb/index.d.ts',
    'spec/hyperschema/index.d.ts',
    'spec/mesh/hyperschema/index.d.ts'
];
const rewound = rewindSpec(ROOT, BASELINE_DIRS, {
    carries: 'spec/mesh/hyperdb/db.json',
    keep: HAND_WRITTEN
});
const describe = spawnSync('git', ['describe', '--tags'], { cwd: ROOT }).stdout?.toString().trim();
const baselines = rewound.filter((tag) => tag !== describe);
fs.writeFileSync(path.join(SCHEMA_DIR, 'schema.json'), JSON.stringify({ version: 0, schema: [] }, null, 2));
const schema = Hyperschema.from(SCHEMA_DIR);
registerEngineTypes(schema.namespace('assistant'));
Hyperschema.toDisk(schema, { esm: true });
HyperschemaTS.toDisk(schema);
resetHrpcIds(HRPC_DIR);
const builder = HRPCBuilder.from(SCHEMA_DIR, HRPC_DIR);
registerEngineApi(builder.namespace('assistant'));
HRPCBuilder.toDisk(builder);
writeBind(builder, path.join(SPEC_DIR, 'bind.js'));
const callSites = {
    optionalRequests: new Set([
        '@assistant/empty',
        '@assistant/device-scope',
        '@assistant/create-room-request',
        '@assistant/local-files-request',
        '@assistant/create-mesh-request',
        '@assistant/create-workspace-request'
    ])
};
writeClient(builder, path.join(SPEC_DIR, 'calls.js'), callSites);
writeCapabilities(builder, path.join(SPEC_DIR, 'capabilities.d.ts'), callSites);
const localSchema = Hyperschema.from(LOCAL_SCHEMA_DIR);
registerLocalTypes(localSchema.namespace('local'));
Hyperschema.toDisk(localSchema, { esm: true });
HyperschemaTS.toDisk(localSchema);
const db = HyperDB.from(LOCAL_SCHEMA_DIR, LOCAL_DB_DIR);
registerLocalCollections(db.namespace('local'), path.join(dir, 'indexes.js'));
HyperDB.toDisk(db, { esm: true });
const meshSchema = Hyperschema.from(MESH_SCHEMA_DIR);
registerQvacTypes(meshSchema.namespace('qvac'));
Hyperschema.toDisk(meshSchema, { esm: true });
HyperschemaTS.toDisk(meshSchema);
const meshDb = HyperDB.from(MESH_SCHEMA_DIR, MESH_DB_DIR);
registerQvacCollections(meshDb.namespace('qvac'), path.join(dir, 'indexes.js'));
HyperDB.toDisk(meshDb, { esm: true });
const dispatch = Hyperdispatch.from(MESH_SCHEMA_DIR, MESH_DISPATCH_DIR);
registerQvacDispatch(dispatch.namespace('qvac'));
Hyperdispatch.toDisk(dispatch);
const configSchema = Hyperschema.from(CONFIG_SCHEMA_DIR);
registerConfigTypes(configSchema.namespace('conf'));
Hyperschema.toDisk(configSchema);
const config = Hyperconf.from(CONFIG_SCHEMA_DIR, CONFIG_CONF_DIR);
config.setProduction('@conf/config', { minSupportedVersion: VENDORED_MIN_SUPPORTED_VERSION });
Hyperconf.toDisk(config);
fs.writeFileSync(path.join(CONFIG_CONF_DIR, 'package.json'), `${JSON.stringify({ type: 'commonjs' }, null, 2)}\n`);
writeConfigTypes(path.join(CONFIG_CONF_DIR, 'index.d.ts'));
for (const file of [MESH_DISPATCH_JSON, MESH_DB_JSON, LOCAL_DB_JSON]) {
    assertUniqueIds(file);
}
try {
    for (const tag of baselines) {
        regen.validate(MESH_DB_JSON, LOCAL_DB_JSON, MESH_DISPATCH_JSON, { tag });
    }
    if (baselines.length > 0) {
        assertFieldOrder(ROOT, MESH_SCHEMA_JSON, baselines);
    }
}
finally {
    if (rewound.length > 0) {
        unstageSpec(ROOT, BASELINE_DIRS);
    }
}
console.log('assistant schema + hrpc + bind + client + local + mesh hyperdb generated under spec/');
function assertUniqueIds(file) {
    const { schema } = JSON.parse(fs.readFileSync(file, 'utf8'));
    const byId = new Map();
    for (const { id, name } of schema) {
        const clash = byId.get(id);
        if (clash) {
            throw new Error(`${path.basename(file)}: id ${id} is on both ${clash} and ${name}`);
        }
        byId.set(id, name);
    }
}
