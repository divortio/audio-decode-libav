import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const DIST_DIR = path.join(__dirname, '../dist');

const version = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8')).version;
const TARGET_DIST = path.join(DIST_DIR, `audio-decode-libav-${version}`);

if (!fs.existsSync(TARGET_DIST)) process.exit(0); // Ignore during static analysis passes

const EXPECTED_FAILURES = [ 'mp4.mp4', 'lena-raw', 'mp3-raw.mp3', 'lena.raw'];

describe('Expected Missing Codec Signatures validations', async () => {
    const engine = fs.readdirSync(TARGET_DIST).find(name => fs.statSync(path.join(TARGET_DIST, name)).isDirectory());
    if(!engine) return;

    const enginePath = path.join(TARGET_DIST, engine);
    const { getAudioType } = await import('file://' + path.join(enginePath, 'audioType.js'));

    for (const frag of EXPECTED_FAILURES) {
        it(`Verifying ${frag} safely errors or fails to parse type identification natively`, async () => {
            const p = path.join(FIXTURES_DIR, frag);
            if (!fs.existsSync(p)) return;

            const buf = fs.readFileSync(p);
            const type = getAudioType(buf);
            
            // Expected to be falsy since we don't have magic bytes for it mapped yet.
            assert.ok(!type, `Unexpectedly parsed a type (${type}) for known missing codec: ${frag}. Did we add identifying magic bytes?`);
        });
    }
});
