import type { ExecLanguage } from '../../lib/contract/exec.ts';
import type { Interpreter } from './runtime.ts';
export declare function createJavaScriptLanguage(interpreter: Interpreter): ExecLanguage;
