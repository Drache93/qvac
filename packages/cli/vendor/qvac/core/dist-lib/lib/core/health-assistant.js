import { MEDPSY_1_7B, MEDPSY_4B } from '@qvac/harness/model-catalog';
export const HEALTH_ASSISTANT_ID = 'qvac-health-assistant';
export function buildHealthAssistant(device, { at = Date.now() } = {}) {
    const mobile = device.platform === 'android' || device.platform === 'ios';
    return {
        id: HEALTH_ASSISTANT_ID,
        name: 'Health Assistant',
        bio: 'You are a health-focused assistant. Provide clear, helpful information about health and wellbeing.',
        providerDeviceId: device.id,
        modelName: mobile ? MEDPSY_1_7B : MEDPSY_4B,
        reasoning: 'inherit',
        enabledSkills: [],
        enabledTools: [],
        installedSkills: [],
        isDefault: false,
        iconName: 'heart',
        toolsScope: 'all',
        skillsScope: 'selected',
        approvalMode: 'ask',
        disabledToolsets: [],
        createdAt: at,
        updatedAt: at
    };
}
