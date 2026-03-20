import fs from 'fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAudioType } from '../src/audioType.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

const FIXTURES = fs.readdirSync(FIXTURES_DIR).filter(f => fs.statSync(path.join(FIXTURES_DIR, f)).isFile());

const missing = [];

for (const fix of FIXTURES) {
    const p = path.join(FIXTURES_DIR, fix);
    const buf = fs.readFileSync(p);

    try {
        const type = getAudioType(buf);
        if (!type) {
            missing.push(fix);
        }
    } catch(e) {
        missing.push(fix);
    }
}

console.log('--- True Missing Codecs ---');
console.log(JSON.stringify(missing, null, 2));

