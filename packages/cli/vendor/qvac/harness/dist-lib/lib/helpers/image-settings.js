export function imageSettingsFrom(agent) {
    if (!agent) {
        return undefined;
    }
    const settings = {};
    if (agent.imageModelChoice) {
        settings.modelChoice = agent.imageModelChoice;
    }
    if (agent.imageSteps) {
        settings.steps = agent.imageSteps;
    }
    if (agent.imageWidth) {
        settings.width = agent.imageWidth;
    }
    if (agent.imageHeight) {
        settings.height = agent.imageHeight;
    }
    return Object.keys(settings).length ? settings : undefined;
}
