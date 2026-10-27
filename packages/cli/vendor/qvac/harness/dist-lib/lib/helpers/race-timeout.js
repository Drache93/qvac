export async function raceTimeout(pending, { ms, fallback }) {
    let timer = null;
    const expired = new Promise((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
    });
    try {
        return await Promise.race([pending, expired]);
    }
    finally {
        if (timer !== null) {
            clearTimeout(timer);
        }
    }
}
