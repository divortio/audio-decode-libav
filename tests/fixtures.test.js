import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { EXPECTED_FAILURES } from './fixtures.missing.js';

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
const FIXTURES = fs.readdirSync(FIXTURES_DIR).filter(f => fs.statSync(path.join(FIXTURES_DIR, f)).isFile());

describe('Fixture Codec WebAssembly Validation Matrix', () => {
    for (const engine of ENGINES) {
        describe(`Engine Environment: ${engine}`, () => {
            const enginePath = path.join(TARGET_DIST, engine);

            for (const fix of FIXTURES) {
                if (EXPECTED_FAILURES.some(ex => fix.includes(ex))) {
                    continue; // Skip expected failures, evaluated in fixtures.missing.test.js
                }

                it(`Should accurately parse and decode: ${fix}`, async () => {
                    const buf = fs.readFileSync(path.join(FIXTURES_DIR, fix));
                    
                    // Dynamic import because this is an ESM script testing built files
                    const { getAudioType } = await import('file://' + path.join(enginePath, 'audioType.js'));
                    const { default: decLib } = await import('file://' + path.join(enginePath, 'decoder.js'));
                    const Decoder = decLib.Decoder;
                    
                    const type = getAudioType(buf);
                    
                    assert.ok(type, `Failed to extract getAudioType signature for ${fix}`);

                    const decoder = new Decoder(type);
                    await decoder.ready;
                    
                    // Decode exact payload logic
                    const decoded = await decoder.decodeFileExact(buf);
                    
                    decoder.free();
                    
                    assert.ok(decoded, `Failed to yield payload from LibAV engine for ${fix}`);
                    assert.ok(decoded.channelData, `Decoded payload missing interleaved channels data for ${fix}`);
                    assert.ok(decoded.sampleRate > 0, `Decoded payload sample rate missing for ${fix}`);
                    
                    if (decoded.errors && decoded.errors.length) {
                        assert.fail(`LibAV emitted internal unpacking errors: ${JSON.stringify(decoded.errors)}`);
                    }
                });
            }
        });
    }
});
