import Module from 'bare-module';
import type { ReleasePin, ReleaseContents, ReleaseLoadOptions } from './types';
export declare function loadModules(pin: ReleasePin, contents: ReleaseContents, options: ReleaseLoadOptions): Promise<Module>;
