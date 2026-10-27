import process from 'process';
export function underTest() {
    return Boolean(process.env.QVAC_TEST);
}
