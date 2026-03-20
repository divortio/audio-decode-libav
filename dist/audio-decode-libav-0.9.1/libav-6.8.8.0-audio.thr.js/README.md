# audio-decode-libav 
Decode any audio format to raw samples.<br>
JS / WASM – no ffmpeg, no native bindings, works in both node and browser.<br>
Small API, minimal size, near-native performance, lazy-loading, chunked decoding.


```js
import decode from '@divortio/audio-decode-libav';

const {channelData, sampleRate} = await decode(anyAudioBuffer);
```

#### Supported formats:

All standard web-audio models including MP3, WAV, OGG Vorbis, FLAC, Opus, AAC, QOA, AIFF, CAF, WebM, AMR, and WMA are natively supported under the hood by an abstracted `libav.js` WebAssembly engine mapping. No separate format decoders are necessary.

### Whole-file decode

Auto-detects format from content. Input can be _ArrayBuffer_, _Uint8Array_, or _Buffer_.

```js
import decode from '@divortio/audio-decode-libav';

const {channelData, sampleRate} = await decode(anyAudioBuffer);
// format detected automatically — works with any supported codec
```

### Chunked decoding

For chunk-by-chunk decoding, specify the codec upfront:

```js
import {decoders} from '@divortio/audio-decode-libav';
import audioType from 'audio-type';

// autodetect format
const format = audioType(firstChunk);        // 'mp3', 'flac', etc.
const decoder = await decoders[format]();

const a = await decoder.decode(chunk1);  // { channelData, sampleRate }
const b = await decoder.decode(chunk2);
const c = await decoder.decode(null);    // end of stream — flush + free

// explicit methods
// decoder.flush(), decoder.free()
```

### Stream decoding

Decode a `ReadableStream` or async iterable:

```js
import {decodeStream} from '@divortio/audio-decode-libav';

for await (const {channelData, sampleRate} of decodeStream(stream, 'mp3')) {
    // process each decoded chunk
}
```

Available codec keys: `mp3`, `flac`, `opus`, `oga`, `m4a`, `wav`, `qoa`, `aac`, `aiff`, `caf`, `webm`, `amr`, `wma`.

### Custom decoders

The `decoders` registry is extensible:

```js
import {decoders} from '@divortio/audio-decode-libav';

decoders.myformat = async () => ({
    decode: chunk => ..., free() {
    }
});
```

## See also

