import b4a from 'b4a';
const NEWLINE = 0x0a;
export async function* readLines(drive, key) {
    let carry = null;
    for await (const chunk of drive.createReadStream(key)) {
        const buffer = carry === null ? chunk : b4a.concat([carry, chunk]);
        let start = 0;
        for (let index = 0; index < buffer.length; index++) {
            if (buffer[index] !== NEWLINE)
                continue;
            yield b4a.toString(buffer.subarray(start, index), 'utf8');
            start = index + 1;
        }
        carry = start === buffer.length ? null : buffer.subarray(start);
    }
    yield carry === null ? '' : b4a.toString(carry, 'utf8');
}
