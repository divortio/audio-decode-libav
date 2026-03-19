import LibAVFactory from './vendor/libav.js-audio/dist/libav-6.8.8.0-audio.wasm.mjs';

let libavInstance = null;
let initPromise = null;

async function getLibAV() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
        const libav = await LibAVFactory();
        return libav;
    })();
    libavInstance = await initPromise;
    return libavInstance;
}

const EMPTY = Object.freeze({ channelData: Object.freeze([]), sampleRate: 0 });

export default async function decode(src) {
    if (!src || (typeof src !== 'object' && typeof src !== 'string'))
        throw TypeError('Expected ArrayBuffer or TypedArray')
    
    // Convert to a clean Uint8Array, respecting byteOffset if src is a view
    let buf = new Uint8Array(src.buffer ? src.buffer.slice(src.byteOffset, src.byteOffset + src.byteLength) : src);

    let ext = '.tmp';
    let isMp3 = false;
    for (let i = 0; i < Math.min(buf.length - 1, 100); i++) {
        if (buf[i] === 0xFF && (buf[i+1] & 0xE0) === 0xE0) { isMp3 = true; break; }
    }
    if (buf.length >= 3 && buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) isMp3 = true;
    
    if (isMp3) ext = '.mp3';
    else if (buf.length >= 4 && buf[0] === 0x4F && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) ext = '.ogg';
    else if (buf.length >= 4 && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) ext = '.wav';
    else if (buf.length >= 4 && buf[0] === 0x66 && buf[1] === 0x4C && buf[2] === 0x61 && buf[3] === 0x43) ext = '.flac';
    else if (buf.length >= 8 && buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) ext = '.m4a';

    const libav = await getLibAV();
    const name = 'input_' + Math.random().toString(36).slice(2) + ext;

    await libav.writeFile(name, buf);

    let fmt_ctx, streams;
    try {
        [fmt_ctx, streams] = await libav.ff_init_demuxer_file(name);
    } catch (e) {
        try { libav.unlink(name); } catch(e) {}
        throw new Error('Unknown audio format or unable to demux');
    }

    let audioStreamIndex = -1;
    for (let i = 0; i < streams.length; i++) {
        if (streams[i].codec_type === 1 /* AVMEDIA_TYPE_AUDIO */) {
            audioStreamIndex = i;
            break;
        }
    }

    if (audioStreamIndex === -1) {
        await libav.avformat_close_input_js(fmt_ctx);
        try { libav.unlink(name); } catch(e) {}
        throw new Error('No audio format found in the input file');
    }

    const stream = streams[audioStreamIndex];
    const [, c, pkt, frame] = await libav.ff_init_decoder(stream.codec_id, {
        codecpar: stream.codecpar,
        time_base: stream.time_base
    });

    const [, packets] = await libav.ff_read_frame_multi(fmt_ctx, pkt);

    // We only care about audio packets
    const audioPackets = packets[audioStreamIndex] || [];

    // decode all packets
    const frames = await libav.ff_decode_multi(c, pkt, frame, audioPackets, true);

    if (!frames.length) {
        // cleanup and return empty
        await libav.ff_free_decoder(c, pkt, frame);
        await libav.avformat_close_input_js(fmt_ctx);
        try { libav.unlink(name); } catch(e) {}
        return EMPTY;
    }

    const sample_rate = await libav.AVCodecContext_sample_rate(c);
    let channel_layout = await libav.AVCodecContext_channel_layout(c);
    const channels = await libav.AVCodecContext_channels(c);
    if (!channel_layout) channel_layout = channels === 1 ? 4 : (channels === 2 ? 3 : ((1 << channels) - 1));

    // Initialize the filter graph to force Float32 planar
    // According to libav.js documentation, ff_init_filter_graph takes inputs and outputs
    const [filter_graph, buffersrc_ctx, buffersink_ctx] = await libav.ff_init_filter_graph("aformat=sample_fmts=fltp", {
        sample_rate,
        sample_fmt: await libav.AVCodecContext_sample_fmt(c),
        channel_layout,
        time_base: stream.time_base
    }, {
        sample_rate,
        sample_fmt: libav.AV_SAMPLE_FMT_FLTP,
        channel_layout,
        time_base: stream.time_base
    });

    const filterFrames = await libav.ff_filter_multi(buffersrc_ctx, buffersink_ctx, frame, frames, true);

    const channelData = Array.from({ length: channels }, () => []);

    for (const f of filterFrames) {
        let planeSize = f.data.length / channels;
        for (let ch = 0; ch < channels; ch++) {
            channelData[ch].push(f.data.slice(ch * planeSize, (ch + 1) * planeSize));
        }
    }

    const finalData = channelData.map(chunks => {
        const totalLen = chunks.reduce((acc, val) => acc + val.length, 0);
        const merged = new Float32Array(totalLen);
        let offset = 0;
        for (const chunk of chunks) {
            merged.set(chunk, offset);
            offset += chunk.length;
        }
        return merged;
    });

    await libav.avfilter_graph_free_js(filter_graph);
    await libav.ff_free_decoder(c, pkt, frame);
    await libav.avformat_close_input_js(fmt_ctx);
    try { libav.unlink(name); } catch(e) {}

    return {
        _channelData: finalData,
        sampleRate: sample_rate,
        numberOfChannels: finalData.length,
        length: finalData.length > 0 ? finalData[0].length : 0,
        getChannelData(ch) { return this._channelData[ch]; },
        duration: finalData.length > 0 && sample_rate > 0 ? finalData[0].length / sample_rate : 0
    };
}

export async function* decodeStream(stream, format) {
    throw new Error('decodeStream is currently abstracted to full-buffer decode in libav-audio-decode.');
}
export const decoders = {};
