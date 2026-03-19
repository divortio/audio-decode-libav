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

if (!fs.existsSync(TARGET_DIST)) {
    console.error(`Missing dist outputs at ${TARGET_DIST}. Make sure 03_BUILD ran first.`);
    process.exit(1);
}

const ENGINES = fs.readdirSync(TARGET_DIST).filter(name => fs.statSync(path.join(TARGET_DIST, name)).isDirectory());
const FRAGMENTS = fs.readdirSync(FIXTURES_DIR).filter(f => fs.statSync(path.join(FIXTURES_DIR, f)).isFile());

// Missing codecs specified by user instructions to be gracefully handled by a dedicated failure suite instead.
// For example, video.mp4 might not be natively an "audio type" byte-sequence.
const EXPECTED_FAILURES = ['video.mp4', 'mp4.mp4', 'lena-raw', 'mp3-raw.mp3', 'lena.raw'];

describe('Fragment Codec WebAssembly Validation Matrix', async () => {
    for (const engine of ENGINES) {
        describe(`Engine Environment: ${engine}`, async () => {
            const enginePath = path.join(TARGET_DIST, engine);
            
            // Dynamic import because this is an ESM script testing built files
            const { getAudioType } = await import('file://' + path.join(enginePath, 'audioType.js'));
            const { default: decLib } = await import('file://' + path.join(enginePath, 'decoder.js'));
            const Decoder = decLib.Decoder;

            for (const frag of FRAGMENTS) {
                if (EXPECTED_FAILURES.some(ex => frag.includes(ex))) {
                    continue; // Skip expected failures, evaluated in missingCodecs.test.js
                }

                it(`Should accurately parse and decode: ${frag}`, async () => {
                    const buf = fs.readFileSync(path.join(FIXTURES_DIR, frag));
                    const type = getAudioType(buf);
                    
                    assert.ok(type, `Failed to extract getAudioType signature for ${frag}`);

                    const decoder = new Decoder(type);
                    await decoder.ready;
                    
                    // Decode stream logic emulation
                    await decoder.decode(buf);
                    const decoded = await decoder.flush();
                    
                    decoder.free();
                    
                    assert.ok(decoded, `Failed to yield payload from LibAV engine for ${frag}`);
                    assert.ok(decoded.channelData, `Decoded payload missing interleaved channels data for ${frag}`);
                    assert.ok(decoded.sampleRate > 0, `Decoded payload sample rate missing for ${frag}`);
                    
                    if (decoded.errors && decoded.errors.length) {
                        assert.fail(`LibAV emitted internal unpacking errors: ${JSON.stringify(decoded.errors)}`);
                    }
                });
            }
        });
    }
});
