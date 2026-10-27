import { CoreError } from './errors.ts';
export declare function customModelTaskRefusal(taskType: string | null | undefined): CoreError<'CUSTOM_MODEL_TASK_UNSUPPORTED'> | null;
