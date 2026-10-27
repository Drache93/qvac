import { fold } from 'asenion';
export function foldSearchText(text) {
    return fold(text, { preserveLength: true });
}
