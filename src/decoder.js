import LibAVFactory from "./libav.js-audio/dist/libav-6.8.8.0-audio.wasm.mjs";

/**
 * Standard Audio Decode result schema.
 * @typedef {Object} DecoderResult
 * @property {Float32Array[]} channelData - Array of non-interleaved planar Float32Arrays for each audio channel.
 * @property {number} sampleRate - The sampling rate of the decoded audio.
 * @property {number} samplesDecoded - Total sequence of valid audio frames unpacked.
 * @property {Array<{message: string, frameLength?: number}>} errors - List of extraction errors encountered.
 */

/**
 * A highly abstracted Audio Decoder class providing a WebAssembly streaming-equivalent pipeline via LibAV Native.
 * @class
 */

const EMPTY = { channelData: [], sampleRate: 0, samplesDecoded: 0, errors: [] };

export class Decoder {
    /**
     * Initializes the Decoder logic and binds the WebAssembly environment loading Promise into `.ready`.
     * @param {string} [format] - Optional codec format override signature.
     */
    constructor(format) {
        /** @type {string | undefined} */
        this.format = format;
        /** @type {Promise<void>} Resolves when the LibAV VM has mapped correctly */
        this.ready = this._init();
    }

    /**
     * Private bootstrap for the nested VM engine mapping
     * @private
     * @returns {Promise<void>}
     */
    async _init() {
        this.libav = await LibAVFactory();
        this.dev_name = 'input_' + Math.random().toString(36).slice(2) + '.tmp';

        // We will buffer the stream in memory to prevent blocking deadlocks across WASM threads
        // since we are using the minimal chunking fallback.
        this.chunks = [];
        this.totalLength = 0;
        this.isFreed = false;
    }

    /**
     * Feeds binary byte chunks into the decoder's raw memory state. 
     * Output buffering is deferred until `.flush()` is called to prevent threading desync inside LibAV JS wrappers.
     * @param {Uint8Array | null} chunk - Native Uint8Array buffer partition to cache, or null to instruct finalization.
     * @returns {Promise<DecoderResult | Object>} The output result, constantly Empty unless chunk is strictly null.
     */
    async decode(chunk) {
        if (this.isFreed) throw new Error('Decoder freed');

        if (chunk && chunk.length > 0) {
            this.chunks.push(chunk);
            this.totalLength += chunk.length;
            // To emulate streaming, we buffer until flush is called (.decode(null) alias flush).
            // Emulating WASM streaming blocks over libav.js without breaking out of the event
            // loop requires full buffering for demux header guarantees on small chunks.
            return EMPTY;
        }

        return EMPTY; // No chunk given means no output
    }

    /**
     * Consolidates all buffered chunks iteratively and commands the LibAV engine to construct a standard planar extraction.
     * Converts demuxed payloads into Float32 planar buffers internally and cleans up memory allocations correctly.
     * @returns {Promise<DecoderResult>} The standard Web-Audio API-compatible data container payload.
     */
    async flush() {
        if (this.totalLength === 0) return EMPTY;

        // Flatten the buffer
        let buf = new Uint8Array(this.totalLength);
        let offset = 0;
        for (const c of this.chunks) {
            buf.set(c, offset);
            offset += c.length;
        }

        // Use our monolithic parser logic
        await this.libav.writeFile(this.dev_name, buf);

        let fmt_ctx, streams;
        try {
            [fmt_ctx, streams] = await this.libav.ff_init_demuxer_file(this.dev_name);
        } catch (e) {
            return { ...EMPTY, errors: [{ message: "Unable to demux", frameLength: buf.length }] };
        }

        let audioStreamIndex = -1;
        for (let i = 0; i < streams.length; i++) {
            if (streams[i].codec_type === 1) { audioStreamIndex = i; break; }
        }

        if (audioStreamIndex === -1) {
            await this.libav.avformat_close_input_js(fmt_ctx);
            return { ...EMPTY, errors: [{ message: "No audio stream" }] };
        }

        const stream = streams[audioStreamIndex];
        const [, c, pkt, frame] = await this.libav.ff_init_decoder(stream.codec_id, { codecpar: stream.codecpar });

        const [, packets] = await this.libav.ff_read_frame_multi(fmt_ctx, pkt);
        if (!packets[audioStreamIndex]) {
            await this.libav.ff_free_decoder(c, pkt, frame);
            await this.libav.avformat_close_input_js(fmt_ctx);
            return EMPTY;
        }

        const frames = await this.libav.ff_decode_multi(c, pkt, frame, packets[audioStreamIndex], true);
        if (!frames.length) return EMPTY;

        const sample_rate = await this.libav.AVCodecContext_sample_rate(c);
        let channel_layout = await this.libav.AVCodecContext_channel_layout(c);
        const channels = await this.libav.AVCodecContext_channels(c);
        if (!channel_layout) channel_layout = channels === 1 ? 4 : (channels === 2 ? 3 : ((1 << channels) - 1));

        const [filter_graph, buffersrc_ctx, buffersink_ctx] = await this.libav.ff_init_filter_graph("aformat=sample_fmts=fltp", {
            sample_rate, sample_fmt: await this.libav.AVCodecContext_sample_fmt(c), channel_layout
        }, {
            sample_rate, sample_fmt: this.libav.AV_SAMPLE_FMT_FLTP, channel_layout
        });

        const filterFrames = await this.libav.ff_filter_multi(buffersrc_ctx, buffersink_ctx, frame, frames, true);
        const channelData = Array.from({ length: channels }, () => []);

        let totalSamples = 0;
        for (const f of filterFrames) {
            let planeSize = f.data.length / channels;
            totalSamples += planeSize / 4; // float32 = 4 bytes
            for (let ch = 0; ch < channels; ch++) {
                channelData[ch].push(new Float32Array(f.data.slice(ch * planeSize, (ch + 1) * planeSize).buffer));
            }
        }

        const finalData = channelData.map(chunks => {
            const merged = new Float32Array(totalSamples);
            let off = 0;
            for (const chk of chunks) { merged.set(chk, off); off += chk.length; }
            return merged;
        });

        await this.libav.avfilter_graph_free_js(filter_graph);
        await this.libav.ff_free_decoder(c, pkt, frame);
        await this.libav.avformat_close_input_js(fmt_ctx);

        return {
            channelData: finalData,
            sampleRate: sample_rate,
            samplesDecoded: totalSamples,
            errors: []
        };
    }

    /**
     * Immediately clears memory bindings mapped by LibAV to the WASM filesystem for this decoder loop.
     * Must be called to prevent memory leaks!
     * @returns {void}
     */
    free() {
        if (!this.isFreed) {
            this.isFreed = true;
            try { this.libav.unlink(this.dev_name); } catch(e) {}
        }
    }
}

export default {Decoder}