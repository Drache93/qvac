import { type LocalRoot, type Realpath } from './scope.ts';
export declare function createLocalRoots(dirs: readonly string[], realpath?: Realpath): Promise<LocalRoot[]>;
