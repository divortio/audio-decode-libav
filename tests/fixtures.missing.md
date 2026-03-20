# Unidentified Codec & Fixture Signatures Analysis

We conducted a deep heuristic byte-signature analysis on the `EXPECTED_FAILURES` files to determine why `audioType.js` was unable to interpret them, using the new `sniffLen` extended parameter functionality.

Here are the documented findings regarding the 36-byte constraints and magic-byte extraction limits:

## 1. Valid & Successfully Identified Formats
The following files were listed in the blacklisted tracker, but our script confirms they **ARE successfully identified natively** by our current `audioType.js` logic within the standard 36 byte constraints! They do not require a longer `sniffLen`.

*   **`mp4.mp4`**: Detected perfectly as `m4a`. 
    * *Why*: The file's hex signature begins with `00 00 00 1c 66 74 79 70` (offset 4 translates exactly to `ftyp`). The `bufferIsM4A` function successfully intercepts this offset regardless of buffer depth.
*   **`mp3-raw.mp3`**: Detected perfectly as `mp3`.
    * *Why*: The first two bytes `ff fb` equate to `0xFF` and `0xFB` respectively. Evaluating `0xFB & 0xE0` results natively in `0xE0`, which immediately satisfies `bufferIsMP3`'s core bitwise mask.
*   **`lena-alaw.caf`**: Detected perfectly as `caf`.
    * *Why*: Hex starts exactly with `caff`, instantly triggering `bufferIsCAF`.
*   **`wav.wav`**: Detected perfectly as `wav`.
    * *Why*: Starts with standard `RIFF....WAVE`, intercepting our 12 byte validation offset immediately.

*Resolution*: These generic formats will be removed from `fixtures.missing.js` as they execute perfectly without extended lengths!

## 2. Unidentifiable by Design Configuration
*   **`lena.raw`**: Fails identification natively. 
    * *Why*: This file encodes **RAW PCM arrays without any container shell**. The raw float headers consist of variable waveform intensities (e.g., `00 00 a4 ba 00 00 48...`), so there are **NO magic bytes anywhere in the file**. Extending `sniffLen` mathematically yields no benefit. The audio format *must* be externally supplied manually natively to LibAV mapping parameters.

## 3. Empty or Incomplete System Builds
*   **`video_aac.3gp`**: Evaluation failed natively.
    * *Why*: Local tests revealed the FFmpeg container instantiation emitted an empty zero-byte `.3gp` file because the local compilation lacked the `h263` video encoder dependency. This causes file tracking sizes of 0.

## 4. Missing Fixture Targets
The following files simply **do not exist** on the filesystem under the `fixtures/` directory recursively checking structures! 
*   `video.mp4`
*   `lena-raw` (Missing `.raw` extension)
*   `qoa` (Missing `.qoa` extension)
*   `aiff` (Missing `.aiff` extension)
*   `aif` (Missing `.aif` extension)

*Resolution*: The automated scripts automatically drop out checking these to prevent asynchronous FS locking constraints efficiently returning early skips.

## Conclusion 
Because `audioType.js` exclusively maps offsets logically located strictly between bounds `[0, 36]`, there is virtually no heuristic advantage to extending `sniffLen` to a larger size natively! **Magic bytes for containers consistently abide accurately to the first 36 bytes statically.** If a target remains unidentifiable beyond these properties, it implies an absolute absence of wrapper properties (`lena.raw`) or an invalid generation configuration natively.
