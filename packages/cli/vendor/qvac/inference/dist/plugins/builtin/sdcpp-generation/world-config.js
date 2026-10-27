export const DEFAULT_WORLD_FIT_STEPS = 100;
/** `fitSteps` sizes the memory fit only; the native walk session never sees it. */
export function splitWorldConfig(world) {
    const { fitSteps = DEFAULT_WORLD_FIT_STEPS, ...session } = world ?? {};
    // Cast rather than rebuild: `exactOptionalPropertyTypes` will not widen the
    // schema's `x?: T` into the addon's `x?: T` without it, and the addon already
    // drops undefined values before stringifying them.
    return { fitSteps, session: session };
}
