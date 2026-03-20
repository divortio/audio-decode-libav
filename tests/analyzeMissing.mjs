import fs from 'fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { EXPECTED_FAILURES } from './fixtures.missing.js';
import { getAudioType } from '../src/audioType.js';

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

console.log('--- Unidentified Codecs Heuristic Profiler ---');

const analysis = {};

for (const fix of EXPECTED_FAILURES) {
    const p = path.join(FIXTURES_DIR, fix);
    if (!fs.existsSync(p)) {
        console.log(`Skipping missing local file: ${fix}`);
        continue;
    }

    const buf = fs.readFileSync(p);
    const hexHead = Array.from(buf.subarray(0, 64)).map(b => b.toString(16).padStart(2, '0')).join(' ');
    const asciiHead = Array.from(buf.subarray(0, 64)).map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.').join('');

    // Try sniffing with a huge buffer
    const typeExtended = getAudioType(buf, buf.length);
    const typeNormal = getAudioType(buf, 36);

    analysis[fix] = {
        typeNormal,
        typeExtended,
        first64BytesHex: hexHead,
        first64BytesAscii: asciiHead
    };
}

console.log(JSON.stringify(analysis, null, 2));

// Save analysis to a robust temporary file
fs.writeFileSync(path.join(__dirname, 'analysis.json'), JSON.stringify(analysis, null, 2));
console.log('Saved to tests/analysis.json');
