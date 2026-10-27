import b4a from 'b4a';
export function runDriver({ request, agent }) {
    if (request.capability) {
        return agent.providerDeviceId;
    }
    return request.runnerDeviceId ? (request.runTakenBy ?? null) : request.originDeviceId;
}
export function drivenBy(input, deviceId) {
    const driver = runDriver(input);
    return !!driver && b4a.equals(driver, deviceId);
}
function untaken(request) {
    return !request.capability && !!request.runnerDeviceId && !request.runTakenBy;
}
export function offeredTo(request, deviceId) {
    return untaken(request) && b4a.equals(request.runnerDeviceId, deviceId);
}
export function handedOff(request, deviceId) {
    return untaken(request) && b4a.equals(request.originDeviceId, deviceId);
}
