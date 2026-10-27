import Protomux from 'protomux';
export function createProtocolPairing(protocol) {
    const muxes = new Map();
    function mux(stream, onopen) {
        const paired = Protomux.from(stream.noiseStream);
        if (!muxes.has(paired)) {
            const onclose = () => muxes.delete(paired);
            muxes.set(paired, onclose);
            paired.pair({ protocol }, onopen);
            paired.stream.once('close', onclose);
        }
        return paired;
    }
    function destroy() {
        for (const [paired, onclose] of muxes) {
            paired.unpair({ protocol });
            paired.stream.off('close', onclose);
        }
        muxes.clear();
    }
    return { mux, destroy };
}
