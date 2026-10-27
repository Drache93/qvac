export const MUSIC_MODEL_CHOICES = ['turbo', 'turbo-hq', 'sft', 'base'];
export const GENERATE_MUSIC_TOOL = 'generate_music';
export const DEFAULT_MUSIC_MODEL_CHOICE = 'turbo';
export const MUSIC_CHOICE_CATALOG = [
    {
        choice: 'turbo',
        label: 'ACE-Step 1.5 Turbo (Q4)',
        sizeBytesApprox: 3_300_000_000,
        requiresGpu: false,
        notes: 'Fastest, fits phone memory. Good default.'
    },
    {
        choice: 'turbo-hq',
        label: 'ACE-Step 1.5 Turbo (Q8)',
        sizeBytesApprox: 4_400_000_000,
        requiresGpu: true,
        notes: 'Higher-precision Turbo. Wants a desktop GPU.'
    },
    {
        choice: 'sft',
        label: 'ACE-Step 1.5 SFT (Q8)',
        sizeBytesApprox: 4_400_000_000,
        requiresGpu: true,
        notes: 'Fine-tuned quality. Wants a desktop GPU.'
    },
    {
        choice: 'base',
        label: 'ACE-Step 1.5 Base (Q4)',
        sizeBytesApprox: 3_300_000_000,
        requiresGpu: true,
        notes: 'Undistilled base model at 50 steps. Slowest; wants a desktop GPU.'
    }
];
export function musicModelChoiceFrom(settings) {
    if (!settings || typeof settings !== 'object' || !('modelChoice' in settings)) {
        return undefined;
    }
    return isMusicModelChoice(settings.modelChoice) ? settings.modelChoice : undefined;
}
export function isMusicModelChoice(value) {
    return MUSIC_MODEL_CHOICES.some((choice) => choice === value);
}
