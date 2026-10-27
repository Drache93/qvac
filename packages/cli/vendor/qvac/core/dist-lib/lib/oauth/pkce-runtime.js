export async function generateRuntimePkceChallenge(runtime) {
    const verifier = runtime.randomBase64Url(32);
    const challenge = await runtime.sha256Base64Url(verifier);
    return { verifier, challenge, method: 'S256' };
}
