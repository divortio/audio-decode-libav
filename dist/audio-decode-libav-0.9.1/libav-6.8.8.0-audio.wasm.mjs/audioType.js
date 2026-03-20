/**
 * @fileoverview Audio type sniffing utilities. Provides a public interface
 * that safely slices input buffers before internal processing.
 */

// --- Constants ---

/**
 * The maximum number of bytes required to perform all audio type checks
 * (36 bytes to cover the Opus Ogg Header).
 * @private
 * @type {number}
 */
const SNIFF_LENGTH = 36;


// --- Internal Helper ---

/**
 * Safely slices and returns the first 36 bytes of a buffer as a Uint8Array.
 * @param {ArrayBuffer | Uint8Array | DataView | null | undefined} buf - The buffer to slice.
 * @returns {ArrayBuffer | ArrayBuffer | ArrayBuffer | Uint8Array | DataView | null} A Uint8Array view of the first 36 bytes, or null if input is invalid.
 * @param sniffLen {number}
 */
function getSniffingBuffer(buf, sniffLen=SNIFF_LENGTH) {
    if (!buf) return null;

    // Ensure we have a Uint8Array view of the buffer correctly handling Node.js Buffer shared memory pool offsets
    const uint8Buf = new Uint8Array(buf.buffer || buf, buf.byteOffset || 0, buf.byteLength || buf.length);

    // Return a subarray, limited by the smaller of the required length
    // and the buffer's actual length.
    const sliceEnd = Math.min(uint8Buf.byteLength, sniffLen);
    return uint8Buf.subarray(0, sliceEnd);
}

// --- Internal Buffer Sniffing Functions (Assume buffer is sliced/small) ---

/**
 * Checks if the buffer contains MP3 signature bytes.
 * @private
 * @param {Uint8Array} buf - The buffer (assumed to be <= 36 bytes).
 * @returns {boolean} True if MP3 is detected.
 */
function bufferIsMP3(buf) {
    if (buf.length < 3) return

    // contains id3v2 tag
    if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
        return true;
    }
    // no tag
    if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) {
        return true;
    }
    // 'TAG'
    return buf[0] === 0x54 && buf[1] === 0x41 && buf[2] === 0x47;
}

/**
 * Checks if the buffer contains WAV signature bytes.
 * @private
 * @param {Uint8Array} buf - The buffer (assumed to be <= 36 bytes).
 * @returns {boolean} True if WAV is detected.
 */
function bufferIsWAV(buf) {
    if (buf.length < 12) return

    return buf[0] === 82 &&
        buf[1] === 73 &&
        buf[2] === 70 &&
        buf[3] === 70 &&
        buf[8] === 87 &&
        buf[9] === 65 &&
        buf[10] === 86 &&
        buf[11] === 69;
}

/**
 * Checks if the buffer contains OGG signature bytes.
 * @private
 * @param {Uint8Array} buf - The buffer (assumed to be <= 36 bytes).
 * @returns {boolean} True if OGG is detected.
 */
function bufferIsOGG(buf) {
    if (buf.length < 4) return;

    return buf[0] === 79 &&
        buf[1] === 103 &&
        buf[2] === 103 &&
        buf[3] === 83;
}

/**
 * Checks if the buffer contains FLAC signature bytes.
 * @private
 * @param {Uint8Array} buf - The buffer (assumed to be <= 36 bytes).
 * @returns {boolean} True if FLAC is detected.
 */
function bufferIsFLAC(buf) {
    if (buf.length < 4) return;

    return buf[0] === 102 &&
        buf[1] === 76 &&
        buf[2] === 97 &&
        buf[3] === 67;
}

/**
 * Checks if the buffer contains M4A or standardized ISO Base Media formats.
 * @private
 * @param {Uint8Array} buf - The buffer (assumed to be <= 36 bytes).
 * @returns {boolean} True if M4A / MP4 / 3GP is detected.
 */
function bufferIsM4A(buf) {
    if (buf.length < 8) return;

    if (buf[4] === 102 && buf[5] === 116 && buf[6] === 121 && buf[7] === 112) {
        // Any 'ftyp' container (ftypM4A, ftypiso, ftypmp4, ftyp3gp, etc)
        // Libav handles the specific atoms implicitly. 
        return true; 
    }
    
    // Explicit 'M4A ' ID (without standard ftyp boundary wrapper sometimes observed)
    return buf[0] === 77 && buf[1] === 52 && buf[2] === 65 && buf[3] === 32;
}

/**
 * Checks if the buffer contains OPUS signature bytes.
 * @private
 * @param {Uint8Array} buf - The buffer (assumed to be <= 36 bytes).
 * @returns {boolean} True if OPUS is detected.
 */
function bufferIsOPUS(buf) {
    if (buf.length < 36) return

    // Bytes 0 to 3: detect general OGG (OPUS is OGG)
    // Bytes 28 to 35: detect OPUS
    return buf[0] === 79 &&
        buf[1] === 103 &&
        buf[2] === 103 &&
        buf[3] === 83 &&
        buf[28] === 79 &&
        buf[29] === 112 &&
        buf[30] === 117 &&
        buf[31] === 115 &&
        buf[32] === 72 &&
        buf[33] === 101 &&
        buf[34] === 97 &&
        buf[35] === 100;
}

/**
 * Checks if the buffer contains QOA signature bytes.
 * @private
 * @param {Uint8Array} buf - The buffer (assumed to be <= 36 bytes).
 * @returns {boolean} True if QOA is detected.
 */
function bufferIsQOA(buf) {
    if (buf.length < 4) return
    return (buf[0] === 0x71 && buf[1] === 0x6f && buf[2] === 0x61 && buf[3] === 0x66)
}

/**
 * Checks if the buffer contains AIFF signature bytes.
 * @private
 * @param buf
 * @return {boolean}
 */
function bufferIsAIFF(buf) {
    if (buf.length < 12) return;
    return buf[0] === 0x46 && buf[1] === 0x4f && buf[2] === 0x52 && buf[3] === 0x4d &&
        buf[8] === 0x41 && buf[9] === 0x49 && buf[10] === 0x46 && (buf[11] === 0x46 || buf[11] === 0x43);
}

/**
 * Checks if the buffer contains AAC ADTS or ADIF signature bytes.
 * @private
 * @param buf
 * @return {boolean}
 */
function bufferIsAAC(buf) {
    if (buf.length < 4) return;
    
    // ADTS (Audio Data Transport Stream) syncword (12 bits: 1111 1111 1111)
    if (buf[0] === 0xff && (buf[1] & 0xf0) === 0xf0 && (buf[1] & 0x06) === 0x00) {
        return true;
    }
    
    // ADIF (Audio Data Interchange Format) header "ADIF"
    if (buf[0] === 0x41 && buf[1] === 0x44 && buf[2] === 0x49 && buf[3] === 0x46) {
        return true;
    }
    
    return false;
}

/**
 * Checks if the buffer contains MIDI signature bytes.
 * @private
 * @param buf
 * @return {boolean}
 */
function bufferIsMID(buf) {
    if (buf.length < 4) return;
    return buf[0] === 0x4d && buf[1] === 0x54 && buf[2] === 0x68 && buf[3] === 0x64;
}

/**
 * Checks if the buffer contains CAF signature bytes.
 * @private
 * @param buf
 * @return {boolean}
 */
function bufferIsCAF(buf) {
    if (buf.length < 4) return;
    return buf[0] === 0x63 && buf[1] === 0x61 && buf[2] === 0x66 && buf[3] === 0x66;
}

/**
 * Checks if the buffer contains WMA signature bytes.
 * @private
 * @param buf
 * @return {boolean}
 */
function bufferIsWMA(buf) {
    if (buf.length < 8) return;
    return buf[0] === 0x30 && buf[1] === 0x26 && buf[2] === 0xb2 && buf[3] === 0x75 &&
        buf[4] === 0x8e && buf[5] === 0x66 && buf[6] === 0xcf && buf[7] === 0x11;
}

/**
 * Checks if the buffer contains AMR signature bytes.
 * @private
 * @param buf
 * @return {boolean}
 */
function bufferIsAMR(buf) {
    if (buf.length < 5) return;
    return buf[0] === 0x23 && buf[1] === 0x21 && buf[2] === 0x41 && buf[3] === 0x4d && buf[4] === 0x52;
}

/**
 * Checks if the buffer contains WEBM/Matroska signature bytes.
 * @private
 * @param buf
 * @return {boolean}
 */
function bufferIsWEBM(buf) {
    if (buf.length < 4) return;
    return buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3;
}

/**
 * Checks if the buffer contains AVI signature bytes.
 * @private
 * @param buf
 * @return {boolean}
 */
function bufferIsAVI(buf) {
    if (buf.length < 12) return;
    return buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
        buf[8] === 0x41 && buf[9] === 0x56 && buf[10] === 0x49 && buf[11] === 0x20;
}

/**
 * Checks if the buffer contains AC3 signature bytes.
 * @private
 * @param buf
 * @return {boolean}
 */
function bufferIsAC3(buf) {
    if (buf.length < 2) return;
    // AC3 syncword evaluates to 0x0B77
    return buf[0] === 0x0b && buf[1] === 0x77;
}

/**
 * Internal function to determine the audio container family string.
 * @private
 * @param {Uint8Array} buf - The sliced buffer (max 36 bytes).
 * @returns {string} The detected audio type string (e.g., 'mp3', 'm4a').
 */
function getBufferCodecFamily(buf) {
    if (bufferIsWAV(buf) === true) return 'wav';
    if (bufferIsAIFF(buf) === true) return 'aiff';
    if (bufferIsAAC(buf) === true) return 'aac';
    if (bufferIsMID(buf) === true) return 'mid';
    if (bufferIsCAF(buf) === true) return 'caf';
    if (bufferIsMP3(buf) === true) return 'mp3';
    if (bufferIsFLAC(buf) === true) return 'flac';
    if (bufferIsWMA(buf) === true) return 'wma';
    if (bufferIsAMR(buf) === true) return 'amr';
    if (bufferIsWEBM(buf) === true) return 'webm';
    if (bufferIsAVI(buf) === true) return 'avi';
    if (bufferIsAC3(buf) === true) return 'ac3';
    if (bufferIsM4A(buf) === true) return 'm4a';
    if (bufferIsOPUS(buf) === true) return 'opus'; // overlaps with ogg, so must come first
    if (bufferIsOGG(buf) === true) return 'oga';
    if (bufferIsQOA(buf) === true) return 'qoa';
}


// --- Public Exports ---

/**
 * @typedef {object} AudioTypeObject
 * @property {boolean} isWAV - True if the audio format is WAV.
 * @property {boolean} isMP3 - True if the audio format is MP3.
 * @property {boolean} isFLAC - True if the audio format is FLAC.
 * @property {boolean} isM4A - True if the audio format is M4A.
 * @property {boolean} isOPUS - True if the audio format is OPUS.
 * @property {boolean} isOGG - True if the audio format is OGG (or OGA/Vorbis).
 * @property {boolean} isQOA - True if the audio format is QOA.
 * @property {boolean} isAIFF - True if the audio format is AIFF.
 * @property {boolean} isAAC - True if the audio format is AAC.
 * @property {boolean} isMID - True if the audio format is MID.
 * @property {boolean} isCAF - True if the audio format is CAF.
 * @property {boolean} isWMA - True if the audio format is WMA.
 * @property {boolean} isAMR - True if the audio format is AMR.
 * @property {boolean} isWEBM - True if the audio format is WEBM.
 * @property {boolean} isAVI - True if the audio format is AVI.
 * @property {boolean} isAC3 - True if the audio format is AC3.
 * @property {string | undefined} type - The detected audio type string (e.g., 'mp3').
 */

/**
 * Determines the absolute audio container type string natively by safely extracting and parsing the input buffer signature natively.
 * Evaluates against 15 recognized magic-byte structures spanning standard lossy and lossless codecs.
 *
 * @public
 * @function getAudioType
 * @param {ArrayBuffer | Uint8Array | DataView} buf - The buffer containing the audio file's initial bytes. Must comprise at least the first 36 bytes for guaranteed analysis accuracy (required for Opus payload evaluations).
 * @returns {string} The formally recognized 3-4 character audio container type string representation (e.g., 'mp3', 'flac', 'oga'), or undefined if unidentifiable.
 * @throws {TypeError} Will throw if the provided buffer cannot be represented as a Uint8Array internally.
 * @example
 * const isMp3 = getAudioType(myBuffer) === 'mp3';
 * @param sniffLen {number}
 */
export function getAudioType(buf, sniffLen=SNIFF_LENGTH) {
    const sniffBuf = getSniffingBuffer(buf, sniffLen);
    if (!!sniffBuf) {
        return getBufferCodecFamily(sniffBuf);
    }
}

/**
 * Constructs and determines the native audio container type and returns an instantly accessible boolean identity mapping.
 * Extremely versatile for switchless checking logic across vast format possibilities.
 *
 * @public
 * @function getAudioTypeObj
 * @param {ArrayBuffer | Uint8Array | DataView} buf - The buffer containing the audio file's initial bytes to be sniffed.
 * @returns {{isWAV: boolean, isMP3: boolean, isFLAC: boolean, isM4A: boolean, isOPUS: boolean, isOGG: boolean, isQOA: boolean, isAIFF: boolean, isAAC: boolean, isMID: boolean, isCAF: boolean, isWMA: boolean, isAMR: boolean, isWEBM: boolean, isAVI: boolean, type: string}} A detailed strict representation describing the validated native audio type identity flags exclusively mapping formats as internal True/False triggers.
 * @see {@link getAudioType} Extensively utilizes the core native extractor.
 * @param sniffLen {number}
 */
export function getAudioTypeObj(buf, sniffLen=SNIFF_LENGTH) {
    const sniffBuf = getSniffingBuffer(buf, sniffLen);
    const codeFamily = sniffBuf ? getBufferCodecFamily(sniffBuf) : undefined;

    // Create the return object based on the detected codeFamily string
    return {
        isWAV: codeFamily === 'wav',
        isMP3: codeFamily === 'mp3',
        isFLAC: codeFamily === 'flac',
        isM4A: codeFamily === 'm4a',
        isOPUS: codeFamily === 'opus',
        isOGG: codeFamily === 'oga', // Note: OGA is the common extension for OGG containers
        isQOA: codeFamily === 'qoa',
        isAIFF: codeFamily === 'aiff',
        isAAC: codeFamily === 'aac',
        isMID: codeFamily === 'mid',
        isCAF: codeFamily === 'caf',
        isWMA: codeFamily === 'wma',
        isAMR: codeFamily === 'amr',
        isWEBM: codeFamily === 'webm',
        isAVI: codeFamily === 'avi',
        isAC3: codeFamily === 'ac3',
        type: codeFamily
    };
}