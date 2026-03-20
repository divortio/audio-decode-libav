import { execSync } from 'child_process';
import { join } from 'path';
import fs from 'fs';

const FIXTURES_DIR = new URL('./fixtures', import.meta.url).pathname;

// Ensure base lena is used as sample tone
const SOURCE_AUDIO = join(FIXTURES_DIR, 'lena.wav');

const videoFormats = [
    { ext: 'mp4', vcodec: 'libx264', acodec: 'aac', name: 'video_aac.mp4' },
    { ext: 'mkv', vcodec: 'libx264', acodec: 'flac', name: 'video_flac.mkv' },
    { ext: 'mkv', vcodec: 'libx264', acodec: 'libopus', name: 'video_opus.mkv' },
    { ext: 'webm', vcodec: 'libvpx-vp9', acodec: 'libopus', name: 'video_opus.webm' },
    { ext: 'm4v', vcodec: 'libx264', acodec: 'alac', name: 'video_alac.m4v' },
    // Modern Apple format (MOV container with AAC or ALAC)
    { ext: 'mov', vcodec: 'prores', acodec: 'aac', name: 'video_aac.mov' },
    { ext: 'avi', vcodec: 'mpeg4', acodec: 'mp3', name: 'video_mp3.avi' },
    // 3GP for older android
    { ext: '3gp', vcodec: 'h263', acodec: 'aac', name: 'video_aac.3gp' },

    // Issue #6 iPhone Default: MOV (HEVC) + ALAC
    { ext: 'mov', vcodec: 'libx265', vflags: '-tag:v hvc1', acodec: 'alac', name: 'video_iphone.mov' },

    // Specialized AAC Types (Note: we use a video stream filler just for standard format structure if we want, or disable video)
    // Actually, for pure audio ADTS/M4A variants, we can use the same logic but set vcodec: 'copy' without a video stream?
    // Wait, the existing script inputs a video testsrc `lavfi color=c=black`. We can just encode them as video + audio to test the container depth!
    // But .aac is an AUDIO ONLY container! So -vn must be used for .aac!
    { ext: 'aac', vcodec: 'none', acodec: 'aac', aflags: '-profile:a aac_low', name: 'aac_lc.aac' },
    { ext: 'aac', vcodec: 'none', acodec: 'libfdk_aac', aflags: '-profile:a aac_he', name: 'aac_he.aac' },
    { ext: 'aac', vcodec: 'none', acodec: 'libfdk_aac', aflags: '-ac 2 -profile:a aac_he_v2', name: 'aac_he_v2.aac' },
    // ADTS does not cleanly support AAC-LD, so we pack it in m4a.
    { ext: 'm4a', vcodec: 'none', acodec: 'libfdk_aac', aflags: '-profile:a aac_ld', name: 'aac_ld.m4a' }
];

console.log('--- Generating Minimal Video & Specialized Audio Fixtures ---');

videoFormats.forEach(fmt => {
    const outFile = join(FIXTURES_DIR, fmt.name);
    let cmd = '';
    
    // Check if it's purely an audio fixture output without a video stream
    if (fmt.vcodec === 'none') {
        cmd = `ffmpeg -hide_banner -y -i "${SOURCE_AUDIO}" -vn -c:a ${fmt.acodec} ${fmt.aflags || ''} "${outFile}"`;
    } else {
        cmd = `ffmpeg -hide_banner -y -f lavfi -i color=c=black:s=320x240:d=5 -i "${SOURCE_AUDIO}" -c:v ${fmt.vcodec} ${fmt.vflags || ''} -c:a ${fmt.acodec} ${fmt.aflags || ''} -shortest -t 5 "${outFile}"`;
    }

    try {
        console.log(`Generating ${fmt.name}...`);
        execSync(cmd, { stdio: 'ignore' });
        console.log(` -> Success`);
    } catch (e) {
        console.error(` -> Failed generating ${fmt.name}. Ensure ffmpeg is compiled with ${fmt.acodec} (e.g. libfdk_aac)`);
    }
});