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

describe('Missing Fixtures Sniffing Validation Matrix', () => {
    for (const engine of ENGINES) {
        describe(`Engine Environment: ${engine}`, () => {
            const enginePath = path.join(TARGET_DIST, engine);

            for (const fix of EXPECTED_FAILURES) {
                it(`Should fail to conventionally sniff: ${fix}`, async () => {
                    const fixturePath = path.join(FIXTURES_DIR, fix);
                    if (!fs.existsSync(fixturePath)) {
                        // ignore missing test files from expectations gracefully
                        assert.ok(true);
                        return;
                    }
                    
                    const { getAudioType } = await import('file://' + path.join(enginePath, 'audioType.js'));
                    const buf = fs.readFileSync(fixturePath);
                    
                    let type;
                    try {
                        type = getAudioType(buf);
                    } catch (e) {
                        // Expected to fail sniffing or parsing
                    }
                    
                    assert.ok(!type, `Unexpectedly SUCCESSFUL extraction for getAudioType signature for ${fix} (Yielded: ${type}). Please remove from fixtures.missing.js blacklist!`);
                });
            }
        });
    }
});
