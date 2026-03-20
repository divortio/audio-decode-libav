import { getAudioType } from './audioType.js';

/**
 * Evaluates the binary signature of an audio buffer and returns the corresponding standard MIME type.
 * This utilizes `getAudioType` to parse the underlying compression format directly from the binary header.
 * 
 * @function getAudioMimeType
 * @param {ArrayBuffer | Uint8Array | DataView} buffer - The raw binary audio data to analyze. 
 *        Must contain at least the first 36 bytes of the audio file to ensure accurate detection across all formats.
 * @returns {string | null} The corresponding MIME type string (e.g., 'audio/mpeg', 'audio/flac'), or null if the signature is unrecognized.
 * 
 * @example
 * const mime = getAudioMimeType(mp3Buffer);
 * console.log(mime); // 'audio/mpeg'
 */
export const getAudioMimeType = function(buffer) {
    const audioType = getAudioType(buffer);
    if (!audioType) return null;

    switch (audioType) {
        case 'wav':
            return 'audio/wav';
        case 'mp3':
            return 'audio/mpeg';
        case 'flac':
            return 'audio/flac';
        case 'm4a':
        case 'aac':
            return 'audio/aac';
        case 'opus':
            return 'audio/opus';
        case 'oga':
        case 'ogg':
            return 'audio/ogg';
        case 'aiff':
            return 'audio/aiff';
        case 'mid':
            return 'audio/midi';
        case 'caf':
            return 'audio/x-caf';
        case 'wma':
            return 'audio/x-ms-wma';
        case 'amr':
            return 'audio/amr';
        case 'webm':
            return 'audio/webm';
        case 'avi':
            return 'video/avi';
        case 'qoa':
            return 'audio/qoa';
        default:
            return null;
    }
};