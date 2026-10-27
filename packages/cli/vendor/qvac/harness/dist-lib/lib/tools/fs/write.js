import b4a from 'b4a';
import { pipelinePromise, Readable } from 'streamx';
export async function writeText(drive, key, text, opts) {
    await pipelinePromise(Readable.from([b4a.from(text, 'utf8')]), drive.createWriteStream(key, opts));
}
