const DISCRETE_GPU = [
    /nvidia/i,
    /geforce/i,
    /quadro/i,
    /tesla/i,
    /amd radeon rx/i,
    /radeon rx/i,
    /radeon pro w/i,
    /\barc\b.*\b[ab]\d{2,}/i,
    /adreno/i,
    /mali-g/i,
    /apple m\d/i
];
const INTEGRATED_GPU = [
    /intel.*(hd|uhd|iris)/i,
    /amd radeon(?! rx| pro w)/i,
    /radeon vega/i,
    /microsoft basic render/i
];
const SOFTWARE_GPU = [/llvmpipe/i, /swrast/i, /mesa/i];
export function classifyGpu(name) {
    for (const re of DISCRETE_GPU) {
        if (re.test(name))
            return 'discrete';
    }
    for (const re of INTEGRATED_GPU) {
        if (re.test(name))
            return 'integrated';
    }
    for (const re of SOFTWARE_GPU) {
        if (re.test(name))
            return 'software';
    }
    return 'integrated';
}
