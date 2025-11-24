
import { AudioScriptBlock } from '../types.ts';
import { generateSpeech, TtsVoice } from './geminiTtsService.ts';
import { decode, decodeAudioData } from '../utils/audioUtils.ts';

// --- Sound Synthesis Helpers (Pad & Binaural) ---

export const createPadBuffer = (ctx: BaseAudioContext, duration: number, mood: string): AudioBuffer => {
    const sampleRate = ctx.sampleRate;
    const buffer = ctx.createBuffer(2, sampleRate * duration, sampleRate);
    const L = buffer.getChannelData(0);
    const R = buffer.getChannelData(1);

    let frequencies = [146.83, 185.00, 220.00]; 
    if (mood === 'warm' || mood === 'nature') frequencies = [146.83, 185.00, 220.00, 293.66];
    if (mood === 'epic') frequencies = [98.00, 146.83, 196.00];
    if (mood === 'deep_focus') frequencies = [110.00, 164.81, 196.00];
    
    for (let i = 0; i < buffer.length; i++) {
        let sample = 0;
        const t = i / sampleRate;
        
        frequencies.forEach(f => {
            // Osciladores simples com leve detune para efeito "chorus"
            sample += Math.sin(2 * Math.PI * f * t) * 0.1;
            sample += Math.sin(2 * Math.PI * (f * 1.01) * t) * 0.1; 
            sample += (Math.random() * 2 - 1) * 0.005; // Noise floor
        });

        // Envelope suave (Fade In/Out) para evitar cliques
        let envelope = 1;
        if (t < 2) envelope = t / 2;
        if (t > duration - 2) envelope = (duration - t) / 2;
        
        L[i] = sample * envelope * 0.5;
        R[i] = sample * envelope * 0.5; 
    }
    
    return buffer;
};

const createBinauralBuffer = (ctx: BaseAudioContext, duration: number, freqHz: number): AudioBuffer => {
    const sampleRate = ctx.sampleRate;
    const buffer = ctx.createBuffer(2, sampleRate * duration, sampleRate);
    const L = buffer.getChannelData(0);
    const R = buffer.getChannelData(1);
    
    const baseFreq = 200; 
    
    for (let i = 0; i < buffer.length; i++) {
        const t = i / sampleRate;
        L[i] = Math.sin(2 * Math.PI * baseFreq * t) * 0.1;
        R[i] = Math.sin(2 * Math.PI * (baseFreq + freqHz) * t) * 0.1;
    }
    return buffer;
};

// --- Utility: Text Chunking ---
const splitTextIntoChunks = (text: string): string[] => {
    // Divide por pontuação para manter a entonação natural do TTS
    const chunks = text.match(/[^.!?;\n]+[.!?;\n]+/g) || [text];
    const mergedChunks: string[] = [];
    let current = "";
    
    for (const chunk of chunks) {
        // Mantém pedaços em torno de 300 caracteres para otimizar latência do TTS
        if ((current + chunk).length < 300) {
            current += " " + chunk;
        } else {
            if (current) mergedChunks.push(current.trim());
            current = chunk;
        }
    }
    if (current) mergedChunks.push(current.trim());
    return mergedChunks.length > 0 ? mergedChunks : [text];
};

// --- Utility: Buffer Stitching ---
const stitchBuffers = (ctx: AudioContext, buffers: AudioBuffer[]): AudioBuffer => {
    if (buffers.length === 0) return ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const totalLength = buffers.reduce((acc, b) => acc + b.length, 0);
    const result = ctx.createBuffer(1, totalLength, ctx.sampleRate);
    const data = result.getChannelData(0);
    let offset = 0;
    for (const b of buffers) {
        data.set(b.getChannelData(0), offset);
        offset += b.length;
    }
    return result;
};

// --- WAV Encoding Helpers ---
function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// --- BLADE RUNNER ENGINE v7: The "Staging Area" Strategy ---

export class AudioStreamController {
    private audioContext: AudioContext;
    private nextStartTime: number = 0;
    private sampleRate = 24000;
    
    // OPFS (Storage)
    private fileHandle: FileSystemFileHandle | null = null;
    private writable: FileSystemWritableFileStream | null = null;
    private totalBytesWritten = 0;
    private useOPFS = true;
    private memoryBuffer: Uint8Array[] = []; // Fallback RAM buffer for download construction

    // Queue & State
    private blockQueue: { block: AudioScriptBlock, index: number }[] = [];
    // Staging Queue: Holds processed audio (PCM) in RAM until the buffer target is met
    private playbackStagingQueue: { data: Float32Array, mood: string }[] = []; 
    
    private processedBlockCount = 0;
    private totalBlocks = 0;
    private voiceName: TtsVoice = 'Aoede';
    private CROSSFADE_DURATION = 2.0; 
    
    // Playback Control
    private hasStartedPlaying = false;
    private BLOCKS_TO_BUFFER = 4; // A Lei dos 4 Blocos

    // Callbacks
    public isProcessing = false;
    private onProgressCallback: (p: number, count: number) => void = () => {};
    private onReadyToPlayCallback: () => void = () => {};
    private onCompleteCallback: (url: string) => void = () => {};
    
    constructor() {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: this.sampleRate });
    }

    private async initStorage() {
        try {
            const root = await navigator.storage.getDirectory();
            const fileName = `prayer_stream_${Date.now()}.wav`;
            this.fileHandle = await root.getFileHandle(fileName, { create: true });
            
            // @ts-ignore 
            this.writable = await this.fileHandle.createWritable();
            
            const header = new Uint8Array(44); 
            await this.writable?.write(header);
            
            this.totalBytesWritten = 0;
            console.log("🚀 Blade Runner Engine: OPFS Storage Initialized.");
        } catch (e) {
            console.warn("⚠️ OPFS não suportado ou falhou. Usando fallback de RAM.", e);
            this.useOPFS = false;
            this.memoryBuffer = [];
        }
    }

    public async startStream(
        blocks: AudioScriptBlock[], 
        voice: TtsVoice, 
        onProgress: (p: number, count: number) => void,
        onReadyToPlay: () => void,
        onComplete: (url: string) => void
    ) {
        this.isProcessing = true;
        this.onProgressCallback = onProgress;
        this.onReadyToPlayCallback = onReadyToPlay;
        this.onCompleteCallback = onComplete;
        this.voiceName = voice;
        this.totalBlocks = blocks.length;
        this.processedBlockCount = 0;
        this.hasStartedPlaying = false;
        this.playbackStagingQueue = [];
        
        this.blockQueue = blocks.map((block, index) => ({ block, index }));
        
        await this.initStorage();
        
        // CRITICAL: Do NOT resume audio context yet. Keep it suspended or just don't schedule.
        // We will resume only when flushing the staging queue.
        
        const safeBufferTarget = Math.min(this.BLOCKS_TO_BUFFER, this.totalBlocks);
        console.log(`🏁 Iniciando Geração. Meta de Buffer Seguro: ${safeBufferTarget} Blocos.`);

        while (this.blockQueue.length > 0 && this.isProcessing) {
            const item = this.blockQueue.shift();
            if (item) {
                // 1. Process Logic
                await this.processAndStoreBlock(item.block);
                this.processedBlockCount++;

                // 2. Progress Calculation
                const progress = (this.processedBlockCount / this.totalBlocks) * 100;
                this.onProgressCallback(progress, this.processedBlockCount);

                // 3. Check Buffer Target
                if (!this.hasStartedPlaying && this.processedBlockCount >= safeBufferTarget) {
                    console.log(`✅ Buffer Blindado Atingido (${this.processedBlockCount}/${safeBufferTarget}). Liberando Represa.`);
                    await this.flushStagingQueue();
                    this.hasStartedPlaying = true;
                    this.onReadyToPlayCallback();
                } else if (this.hasStartedPlaying) {
                    // If already playing, flush immediately (schedule next block)
                    await this.flushStagingQueue();
                }

                // 4. CPU Yielding (Respiração)
                await new Promise(r => setTimeout(r, 100));
            }
        }

        if (this.isProcessing) {
            await this.finalizeStorage();
            const url = await this.getDownloadUrl();
            
            // Fallback: Ensure we play if we finished everything but didn't trigger (e.g. extremely short script)
            if (!this.hasStartedPlaying) {
                await this.flushStagingQueue();
                this.hasStartedPlaying = true;
                this.onReadyToPlayCallback();
            }
            
            this.onCompleteCallback(url);
            this.isProcessing = false;
        }
    }

    private async processAndStoreBlock(block: AudioScriptBlock) {
        try {
            const pcmData = await this.processBlock(block, this.voiceName);
            if (pcmData) {
                // Save to disk immediately (for download)
                await this.writeChunk(pcmData);
                
                // Push to Staging Queue (RAM) for playback scheduling
                // We do NOT schedule on the AudioContext yet to avoid premature playback
                this.playbackStagingQueue.push({ data: pcmData, mood: block.instructions.mood });
            }
        } catch (e) {
            console.error("Error processing block:", e);
        }
    }

    private async flushStagingQueue() {
        // Initialize audio timing if this is the first flush
        if (!this.hasStartedPlaying) {
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            // Set start time slightly in the future to allow scheduling
            this.nextStartTime = this.audioContext.currentTime + 0.25;
        }

        // Drain the queue and schedule everything
        while (this.playbackStagingQueue.length > 0) {
            const item = this.playbackStagingQueue.shift();
            if (item) {
                await this.schedulePlayback(item.data, item.mood);
            }
        }
    }

    private async processBlock(block: AudioScriptBlock, voice: TtsVoice): Promise<Float32Array | null> {
        const textChunks = splitTextIntoChunks(block.text);
        const blockChunkBuffers: AudioBuffer[] = [];

        for (const chunk of textChunks) {
            try {
                let attempts = 0;
                let success = false;
                while(attempts < 3 && !success) {
                    try {
                        const speech = await generateSpeech(chunk, voice);
                        if (speech?.data) {
                            const audioData = decode(speech.data);
                            const buffer = await decodeAudioData(audioData, this.audioContext, this.sampleRate, 1);
                            blockChunkBuffers.push(buffer);
                            success = true;
                        } else {
                            throw new Error("Empty TTS response");
                        }
                    } catch(e) {
                        attempts++;
                        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
                    }
                }
            } catch (e) { console.error("TTS failed for chunk", e); }
            await new Promise(r => setTimeout(r, 20)); 
        }

        if (blockChunkBuffers.length === 0) return null;

        const voiceBuffer = stitchBuffers(this.audioContext, blockChunkBuffers);
        
        const voiceDuration = voiceBuffer.duration;
        const totalDuration = voiceDuration + 1.0; 
        const totalSamples = Math.ceil(totalDuration * this.sampleRate);

        const offlineCtx = new OfflineAudioContext(2, totalSamples, this.sampleRate);
        
        const voiceSource = offlineCtx.createBufferSource();
        voiceSource.buffer = voiceBuffer;
        voiceSource.connect(offlineCtx.destination);
        voiceSource.start(0);
        
        const musicBuffer = createPadBuffer(offlineCtx, totalDuration, block.instructions.mood);
        const musicSource = offlineCtx.createBufferSource();
        musicSource.buffer = musicBuffer;
        const musicGain = offlineCtx.createGain();
        
        const intensity = block.instructions.intensity || 0.5;
        const duckVol = 0.15 * intensity;
        const fullVol = 0.4 * intensity;
        
        musicGain.gain.setValueAtTime(0.3 * intensity, 0);
        musicGain.gain.linearRampToValueAtTime(duckVol, 0.5);
        if (voiceDuration > 1) musicGain.gain.setValueAtTime(duckVol, voiceDuration - 0.5);
        musicGain.gain.linearRampToValueAtTime(fullVol, voiceDuration + 0.5);
        
        musicSource.connect(musicGain);
        musicGain.connect(offlineCtx.destination);
        musicSource.start(0);

        if (block.instructions.binauralFreq) {
            const binBuffer = createBinauralBuffer(offlineCtx, totalDuration, block.instructions.binauralFreq);
            const binSource = offlineCtx.createBufferSource();
            binSource.buffer = binBuffer;
            const binGain = offlineCtx.createGain();
            binGain.gain.value = 0.06;
            binSource.connect(binGain);
            binGain.connect(offlineCtx.destination);
            binSource.start(0);
        }

        const renderedBuffer = await offlineCtx.startRendering();
        
        const L = renderedBuffer.getChannelData(0);
        const R = renderedBuffer.getChannelData(1);
        const interleaved = new Float32Array(L.length * 2);
        for (let i = 0; i < L.length; i++) {
            interleaved[i * 2] = L[i];
            interleaved[i * 2 + 1] = R[i];
        }
        
        return interleaved;
    }

    private async schedulePlayback(data: Float32Array, mood: string) {
        const now = this.audioContext.currentTime;
        // If we drifted too far behind, jump ahead.
        if (this.nextStartTime < now) {
             this.nextStartTime = now + 0.1;
        }

        let startTime = this.nextStartTime;
        let fadeDuration = 0.1; 

        // Apply Crossfade if we are not at the very beginning
        // (Buffer has > 0, but we need to check logical position)
        if (startTime > now + 0.5) { // Only crossfade if we have a continuous stream ahead
            startTime = Math.max(now, this.nextStartTime - this.CROSSFADE_DURATION);
            fadeDuration = this.CROSSFADE_DURATION;
        }

        const buffer = this.audioContext.createBuffer(2, data.length / 2, this.sampleRate);
        const L = buffer.getChannelData(0);
        const R = buffer.getChannelData(1);
        for (let i = 0; i < L.length; i++) {
            L[i] = data[i * 2];
            R[i] = data[i * 2 + 1];
        }

        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        
        const gainNode = this.audioContext.createGain();
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(1, startTime + fadeDuration); 
        gainNode.gain.setValueAtTime(1, startTime + buffer.duration - fadeDuration);
        gainNode.gain.linearRampToValueAtTime(0, startTime + buffer.duration); 
        
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        source.start(startTime);
        
        this.nextStartTime = startTime + buffer.duration;
    }

    private async writeChunk(data: Float32Array) {
        const int16 = new Int16Array(data.length);
        for (let i = 0; i < data.length; i++) {
            const s = Math.max(-1, Math.min(1, data[i]));
            int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        const bytes = new Uint8Array(int16.buffer);

        if (this.useOPFS && this.writable) {
            await this.writable.write(bytes);
        } else {
            this.memoryBuffer.push(bytes);
        }
        this.totalBytesWritten += bytes.length;
    }

    private async finalizeStorage() {
        const header = new ArrayBuffer(44);
        const view = new DataView(header);
        const fileSize = 36 + this.totalBytesWritten;
        
        writeString(view, 0, 'RIFF');
        view.setUint32(4, fileSize, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); 
        view.setUint16(22, 2, true); 
        view.setUint32(24, this.sampleRate, true);
        view.setUint32(28, this.sampleRate * 4, true); 
        view.setUint16(32, 4, true); 
        view.setUint16(34, 16, true); 
        writeString(view, 36, 'data');
        view.setUint32(40, this.totalBytesWritten, true);

        if (this.useOPFS && this.writable && this.fileHandle) {
            // @ts-ignore
            await this.writable.seek(0);
            await this.writable.write(header);
            await this.writable.close();
        } else {
            const finalBuffer = new Uint8Array(44 + this.totalBytesWritten);
            finalBuffer.set(new Uint8Array(header), 0);
            let offset = 44;
            for (const chunk of this.memoryBuffer) {
                finalBuffer.set(chunk, offset);
                offset += chunk.length;
            }
            this.memoryBuffer = [finalBuffer];
        }
    }

    public async getDownloadUrl(): Promise<string> {
        if (this.useOPFS && this.fileHandle) {
            const file = await this.fileHandle.getFile();
            return URL.createObjectURL(file);
        } else if (this.memoryBuffer.length > 0) {
            const blob = new Blob(this.memoryBuffer, { type: 'audio/wav' });
            return URL.createObjectURL(blob);
        }
        return '';
    }

    public pause() {
        if (this.audioContext.state === 'running') this.audioContext.suspend();
    }

    public resume() {
        if (this.audioContext.state === 'suspended') this.audioContext.resume();
    }
    
    public close() {
        this.isProcessing = false;
        this.audioContext.close();
    }
}

export const createAudioStream = () => new AudioStreamController();
