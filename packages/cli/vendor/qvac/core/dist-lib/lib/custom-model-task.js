import { CoreError } from './errors.js';
const TASK_NAMES = {
    embeddings: 'embedding',
    'speech-to-text': 'speech-to-text',
    'text-to-speech': 'text-to-speech',
    'image-generation': 'image-generation'
};
export function customModelTaskRefusal(taskType) {
    if (!taskType || taskType === 'llm')
        return null;
    return new CoreError('CUSTOM_MODEL_TASK_UNSUPPORTED', [TASK_NAMES[taskType] ?? taskType]);
}
