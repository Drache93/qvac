const ADDON_TASK_TYPES = {
    llm: 'llm',
    embeddings: 'embeddings',
    whisper: 'speech-to-text',
    parakeet: 'speech-to-text',
    tts: 'text-to-speech',
    diffusion: 'image-generation',
    audiogen: 'audio-generation',
    nmt: 'translation',
    ocr: 'text-recognition'
};
export function addonTaskType(addon) {
    return ADDON_TASK_TYPES[addon] ?? 'other';
}
