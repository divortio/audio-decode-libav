# Codec Identification Validations Matrix

We have meticulously configured our decoding pipeline via massive FFmpeg WASM extracts to handle practically any audio extraction schema encountered in a modern Web-Audio context payload!

## Validated Extraction Signatures (Supported Codecs)

These signatures are completely natively validated against strict byte payloads mapped exhaustively out inside `src/audioMimeType.js`. Note that decoding is natively capable of supporting formats beyond what we uniquely isolate using `getAudioType`, since libav natively identifies unknown streams dynamically anyway!

- `WAV` (`audio/wav`)
- `MP3` (`audio/mpeg`)
- `FLAC` (`audio/flac`)
- `AAC` / `M4A` (`audio/aac`)
- `OPUS` (`audio/opus`)
- `OGG` (`audio/ogg`)
- `AIFF` (`audio/aiff`)
- `MIDI` (`audio/midi`)
- `CAF` (`audio/x-caf`)
- `WMA` (`audio/x-ms-wma`)
- `AMR` (`audio/amr`)
- `WEBM` (`audio/webm`)
- `QOA` (`audio/qoa`)

## Expected Failures / Identified Blocks
Due to incredibly nuanced magic-byte structuring that overlaps raw video models, a specific array of file structures explicitly throw parsing warnings or bypass explicit extraction mapping in our native `getAudioType.js` node implementation natively.

Currently expected format misses:
* `video.mp4`
* `mp4.mp4`
* `lena-raw`
* `mp3-raw.mp3`
* `lena.raw`

These blocks bypass the sniffer tests recursively checked within `tests/fixtures.missing.test.js` validating their rejection structures automatically!
