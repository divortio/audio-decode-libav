/**
 * Audio decoder: whole-file and streaming utilizing Custom libav.js Engine
 * @module audio-decode
 */

import { getAudioType } from './audioType.js';
import {Decoder} from "./decoder.js";

const EMPTY = Object.freeze({ channelData: Object.freeze([]), sampleRate: 0, samplesDecoded: 0, errors: [] });


export default async function decode(src) {
    if (!src || typeof src === 'string' || !(src.buffer || src.byteLength || src.length))
        throw TypeError('Expected ArrayBuffer or Uint8Array')
    let buf = new Uint8Array(src.buffer || src)

    let type = getAudioType(buf) || 'wav';
    if (!decoders[type]) throw Error('No decoder for ' + type);

    let dec = await decoders[type]();
    try {
        let result = await dec.decode(buf);
        let flushed = await dec.decode();
        return merge(result, flushed);
    } catch (e) {
        dec.free();
        throw e;
    }
}

export async function* decodeStream(stream, format) {
    if (!decoders[format]) throw Error('No decoder for ' + format);
    let dec = await decoders[format]();
    try {
        for await (let chunk of stream) {
            let result = await dec.decode(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk));
            if (result.channelData.length) yield result;
        }
        let flushed = await dec.decode();
        if (flushed.channelData.length) yield flushed;
    } finally {
        dec.free();
    }
}

function createDecoder(format) {
    return async () => {
        let dec = new Decoder(format);
        await dec.ready;
        return streamDecoder(chunk => dec.decode(chunk), () => dec.flush(), () => dec.free());
    };
}

export const decoders = {
    mp3: createDecoder('mp3'),
    flac: createDecoder('flac'),
    opus: createDecoder('opus'),
    oga: createDecoder('oga'),
    m4a: createDecoder('m4a'),
    wav: createDecoder('wav'),
    qoa: createDecoder('qoa'),
    aac: createDecoder('aac'),
    aiff: createDecoder('aiff'),
    caf: createDecoder('caf'),
    webm: createDecoder('webm'),
    amr: createDecoder('amr'),
    wma: createDecoder('wma')
};

function streamDecoder(onDecode, onFlush, onFree) {
    let done = false;
    return {
        async decode(chunk) {
            if (chunk) {
                if (done) throw Error('Decoder already freed');
                try { return norm(await onDecode(chunk)); }
                catch (e) { done = true; onFree?.(); throw e; }
            }
            if (done) return EMPTY;
            done = true;
            try {
                let result = onFlush ? norm(await onFlush()) : EMPTY;
                onFree?.();
                return result;
            } catch (e) { onFree?.(); throw e; }
        },
        async flush() {
            if (done) return EMPTY;
            return onFlush ? norm(await onFlush()) : EMPTY;
        },
        free() {
            if (done) return;
            done = true;
            onFree?.();
        }
    };
}

function norm(r) {
    if (!r?.channelData?.length) return EMPTY;
    let { channelData, sampleRate, samplesDecoded } = r;
    if (samplesDecoded != null && samplesDecoded < channelData[0].length)
        channelData = channelData.map(ch => ch.subarray(0, samplesDecoded));
    if (!channelData[0]?.length) return EMPTY;
    return { channelData, sampleRate, samplesDecoded };
}

function merge(a, b) {
    if (!b?.channelData?.length) return a;
    if (!a?.channelData?.length) return b;
    return {
        channelData: a.channelData.map((ch, i) => {
            let merged = new Float32Array(ch.length + b.channelData[i].length);
            merged.set(ch);
            merged.set(b.channelData[i], ch.length);
            return merged;
        }),
        sampleRate: a.sampleRate,
        samplesDecoded: (a.samplesDecoded || 0) + (b.samplesDecoded || 0)
    };
}
