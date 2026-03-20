import fs from 'fs';
import { join } from 'path';
import { getAudioType } from '../src/audioType.js';

const FIXTURES_DIR = new URL('./fixtures', import.meta.url).pathname;

const videoFixtures = [
    'video_aac.mp4',
    'video_flac.mkv',
    'video_opus.mkv',
    'video_opus.webm',
    'video_alac.m4v',
    'video_aac.mov',
    'video_mp3.avi'
];

console.log('--- Testing Video Container Audio Sniffing limits ---');

const missingVideoFixtures = [];

for (const fix of videoFixtures) {
    const p = join(FIXTURES_DIR, fix);
    if (!fs.existsSync(p)) continue;
    
    const buf = fs.readFileSync(p);
    const audioType = getAudioType(buf);
    
    if (audioType) {
        console.log(`✅ ${fix} -> Sniffed as: ${audioType}`);
    } else {
        console.log(`❌ ${fix} -> Failed sniffing audio`);
        missingVideoFixtures.push(fix);
    }
}

console.log('\n--- Missing Video Codecs Output ---');
console.log(JSON.stringify(missingVideoFixtures, null, 2));
