import LibAVFactory from './libav.js-audio/dist/libav-6.8.8.0-audio.wasm.mjs';

const EMPTY = { channelData: [], sampleRate: 0, samplesDecoded: 0, errors: [] };

export class Decoder {
    constructor(format) {
        this.format = format;
        this.isFreed = false;

        this.chunkQueue = [];
        this.readResolvers = [];
        this.outputQueue = [];
        this.writeResolvers = [];
        
        this.isEOF = false;
        
        // Asynchronous initialization
        this.ready = this._init();
    }

    async _init() {
        this.libav = await LibAVFactory();
        this.dev_name = 'input_' + Math.random().toString(36).slice(2) + '.' + (this.format || 'bin');
    }

    async _waitForChunk() {
        if (this.chunkQueue.length > 0) return this.chunkQueue.shift();
        if (this.isEOF) return null;
        return new Promise(resolve => this.readResolvers.push(resolve));
    }

    async decode(chunk) {
        if (this.isFreed) throw new Error('Decoder freed');
        
        if (!this.processPromise) {
             this.libav.onread = async (name, pos, len) => {
                 let c = await this._waitForChunk();
                 this.libav.ff_reader_dev_send(name, c);
             };
             await this.libav.mkreaderdev(this.dev_name);
             this.processPromise = this._processLoop();
        }

        if (chunk && chunk.length > 0) {
            if (this.readResolvers.length > 0) {
                this.readResolvers.shift()(chunk);
            } else {
                this.chunkQueue.push(chunk);
            }
        } else {
            this.isEOF = true;
            while(this.readResolvers.length > 0) this.readResolvers.shift()(null);
        }

        // Allow microtask ticks to immediately switch execution context to libav asyncify pipeline.
        // This ensures synchronous processing can evaluate locally within Event Loop limitations.
        await new Promise(r => setTimeout(r, 0));

        return this._flushOutputQueue();
    }

    _flushOutputQueue() {
        if (this.outputQueue.length === 0) return EMPTY;

        let totalLength = 0;
        let sampleRate = 0;
        for (const out of this.outputQueue) {
            totalLength += out.samplesDecoded;
            sampleRate = out.sampleRate; // usually identical across stream
        }

        const channels = this.outputQueue[0].channelData.length;
        const mergedData = Array.from({ length: channels }, () => new Float32Array(totalLength));

        let offset = 0;
        for (const out of this.outputQueue) {
            for (let ch = 0; ch < channels; ch++) {
                mergedData[ch].set(out.channelData[ch], offset);
            }
            offset += out.samplesDecoded;
        }

        this.outputQueue = [];
        return { channelData: mergedData, sampleRate, samplesDecoded: totalLength, errors: [] };
    }

    async _initFilterGraph(c, frames) {
        if (this.filter_graph) return;
        this.target_sr = frames[0] && frames[0].sample_rate ? frames[0].sample_rate : await this.libav.AVCodecContext_sample_rate(c);
        this.target_channels = frames[0] && frames[0].channels ? frames[0].channels : await this.libav.AVCodecContext_channels(c);
        this.sample_fmt = frames[0] && frames[0].format !== undefined ? frames[0].format : await this.libav.AVCodecContext_sample_fmt(c);
        
        let channel_layout = frames[0] && frames[0].channel_layout ? frames[0].channel_layout : await this.libav.AVCodecContext_channel_layout(c);
        if (!channel_layout) channel_layout = this.target_channels === 1 ? 4 : (this.target_channels === 2 ? 3 : ((1 << this.target_channels) - 1));
        this.channel_layout = channel_layout;

        [this.filter_graph, this.buffersrc_ctx, this.buffersink_ctx] = await this.libav.ff_init_filter_graph("aformat=sample_fmts=fltp", {
            sample_rate: this.target_sr, 
            sample_fmt: this.sample_fmt, 
            channel_layout
        }, {
            sample_rate: this.target_sr, 
            sample_fmt: this.libav.AV_SAMPLE_FMT_FLTP, 
            channel_layout
        });
    }

    _patchFrames(frames) {
        let pts = 0;
        for (let f of frames) { 
            if (!f.channel_layout) f.channel_layout = this.channel_layout;
            f.pts = f.ptslo = (pts++);
            f.ptshi = 0;
        }
    }

    async _processLoop() {
        let firstChunk = await this._waitForChunk();
        if (firstChunk === null) return;
        
        this.chunkQueue.unshift(firstChunk);

        let fmt_ctx, streams;
        try {
            [fmt_ctx, streams] = await this.libav.ff_init_demuxer_file(this.dev_name);
        } catch (e) {
            this.outputQueue.push({ ...EMPTY, errors: [{ message: "Unable to demux" }] });
            return;
        }

        let audioStreamIndex = -1;
        for (let i = 0; i < streams.length; i++) {
            if (streams[i].codec_type === 1) { audioStreamIndex = i; break; }
        }

        if (audioStreamIndex === -1) {
            await this.libav.avformat_close_input_js(fmt_ctx);
            this.outputQueue.push({ ...EMPTY, errors: [{ message: "No audio stream" }] });
            return;
        }

        const streamInfo = streams[audioStreamIndex];
        const [, c, pkt, frame] = await this.libav.ff_init_decoder(streamInfo.codec_id, { codecpar: streamInfo.codecpar });

        this.filter_graph = 0;

        while (true) {
            const [res, packets] = await this.libav.ff_read_frame_multi(fmt_ctx, pkt, { limit: 1048576, copyoutPacket: 'default' });

            const isEOF = (res === this.libav.AVERROR_EOF);
            const needsFlush = isEOF && (!packets[streamInfo.index] || packets[streamInfo.index].length === 0);

            if (needsFlush) {
                const frames = await this.libav.ff_decode_multi(c, pkt, frame, [], true);
                if (frames.length > 0) {
                    await this._initFilterGraph(c, frames);
                    this._patchFrames(frames);
                    const extracted = await this._filterFrames(this.filter_graph, this.buffersrc_ctx, this.buffersink_ctx, this.target_channels, this.target_sr, frames, frame, true);
                    if (extracted) this.outputQueue.push(extracted);
                }
                break;
            }

            if (packets[streamInfo.index] && packets[streamInfo.index].length > 0) {
                const frames = await this.libav.ff_decode_multi(c, pkt, frame, packets[streamInfo.index], isEOF);
                if (frames.length > 0) {
                    await this._initFilterGraph(c, frames);
                    this._patchFrames(frames);
                    const extracted = await this._filterFrames(this.filter_graph, this.buffersrc_ctx, this.buffersink_ctx, this.target_channels, this.target_sr, frames, frame, false);
                    if (extracted) this.outputQueue.push(extracted);
                }
            }

            if (res === this.libav.AVERROR_EOF) break;
            if (res !== 0 && res !== -Math.abs(this.libav.EAGAIN)) break; 
        }

        if (this.filter_graph) await this.libav.avfilter_graph_free_js(this.filter_graph);
        await this.libav.ff_free_decoder(c, pkt, frame);
        await this.libav.avformat_close_input_js(fmt_ctx);
    }

    async _filterFrames(filter_graph, buffersrc_ctx, buffersink_ctx, channels, sampleRate, frames, frameObj, isFin) {
        const filterFrames = await this.libav.ff_filter_multi(buffersrc_ctx, buffersink_ctx, frameObj, frames, isFin);
        if (!filterFrames || filterFrames.length === 0) return null;

        const channelData = Array.from({ length: channels }, () => []);
        let totalSamples = 0;

        for (const f of filterFrames) {
            let currentChannels = f.channels || channels;
            let rawBytesPerChannel = f.data.length / currentChannels;
            let planeSize = f.nb_samples ? f.nb_samples * 4 : Math.floor(rawBytesPerChannel / 4) * 4;
            
            totalSamples += planeSize / 4; 
            for (let ch = 0; ch < currentChannels; ch++) {
                if (!channelData[ch]) channelData[ch] = [];
                // Circumvent V8 internal Buffer pooling and offset misalignment explicitly
                const floats = new Float32Array(planeSize / 4);
                const bytes = new Uint8Array(floats.buffer);
                bytes.set(f.data.subarray(ch * planeSize, ch * planeSize + planeSize));
                channelData[ch].push(floats);
            }
            if (currentChannels > channels) channels = currentChannels;
        }

        const finalData = channelData.map(chunks => {
            const merged = new Float32Array(totalSamples);
            let off = 0;
            for (const chk of chunks) { merged.set(chk, off); off += chk.length; }
            return merged;
        });

        return { channelData: finalData, sampleRate, samplesDecoded: totalSamples };
    }

    async decodeFileExact(buf) {
        if (this.isFreed) throw new Error('Decoder freed');
        if (this.processPromise) throw new Error('Cannot run file extraction alongside dynamic streams.');
        
        this.processPromise = (async () => {
            await this.libav.writeFile(this.dev_name, buf);

            let fmt_ctx, streams;
            try {
                [fmt_ctx, streams] = await this.libav.ff_init_demuxer_file(this.dev_name);
            } catch (e) {
                this.outputQueue.push({ ...EMPTY, errors: [{ message: "Unable to demux", frameLength: buf.length }] });
                return;
            }

            let audioStreamIndex = -1;
            for (let i = 0; i < streams.length; i++) {
                if (streams[i].codec_type === 1) { audioStreamIndex = i; break; }
            }

            if (audioStreamIndex === -1) {
                await this.libav.avformat_close_input_js(fmt_ctx);
                this.outputQueue.push({ ...EMPTY, errors: [{ message: "No audio stream" }] });
                return;
            }

            const streamInfo = streams[audioStreamIndex];
            const [, c, pkt, frame] = await this.libav.ff_init_decoder(streamInfo.codec_id, { codecpar: streamInfo.codecpar });

            this.filter_graph = 0;

            const [, packets] = await this.libav.ff_read_frame_multi(fmt_ctx, pkt);
            if (!packets[audioStreamIndex]) {
                await this.libav.ff_free_decoder(c, pkt, frame);
                await this.libav.avformat_close_input_js(fmt_ctx);
                return;
            }

            const frames = await this.libav.ff_decode_multi(c, pkt, frame, packets[audioStreamIndex], true);
            if (frames.length > 0) {
                await this._initFilterGraph(c, frames);
                this._patchFrames(frames);
                const extracted = await this._filterFrames(this.filter_graph, this.buffersrc_ctx, this.buffersink_ctx, this.target_channels, this.target_sr, frames, frame, true);
                if (extracted) this.outputQueue.push(extracted);
            }

            if (this.filter_graph) await this.libav.avfilter_graph_free_js(this.filter_graph);
            await this.libav.ff_free_decoder(c, pkt, frame);
            await this.libav.avformat_close_input_js(fmt_ctx);
        })();

        await this.processPromise;
        return this._flushOutputQueue();
    }

    async flush() {
        if (this.isFreed) return EMPTY;
        
        let res = EMPTY;
        if (this.processPromise && !this.isEOF) {
           res = await this.decode(null);
        }
        
        if (this.processPromise) await this.processPromise; 
        
        return this._mergeChannelDataFast(res, this._flushOutputQueue()); 
    }

    _mergeChannelDataFast(a, b) {
        if (!a || !a.channelData.length) return b || EMPTY;
        if (!b || !b.channelData.length) return a;
        
        const mergedTotal = a.samplesDecoded + b.samplesDecoded;
        const mergedData = a.channelData.map((ch, i) => {
            const combined = new Float32Array(mergedTotal);
            combined.set(ch, 0);
            combined.set(b.channelData[i], ch.length);
            return combined;
        });
        
        return { channelData: mergedData, sampleRate: a.sampleRate, samplesDecoded: mergedTotal, errors: a.errors.concat(b.errors) };
    }

    free() {
        if (!this.isFreed) {
            this.isFreed = true;
            try { this.libav.unlink(this.dev_name); } catch(e) {}
            // Empty resolving callbacks silently
            while(this.readResolvers.length > 0) this.readResolvers.shift()(null);
        }
    }
}

export default {Decoder};