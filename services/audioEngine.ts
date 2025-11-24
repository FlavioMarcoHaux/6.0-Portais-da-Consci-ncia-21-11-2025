
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

// --- BLADE RUNNER ENGINE v3: Asymmetric Pipeline with Cruise Control ---

export class AudioStreamController {
    private audioContext: AudioContext;
    private nextStartTime: number = 0;
    private sampleRate = 24000;
    
    // OPFS (Storage)
    private fileHandle: FileSystemFileHandle | null = null;
    private writable: FileSystemWritableFileStream | null = null;
    private totalBytesWritten = 0;
    private useOPFS = true;
    private memoryBuffer: Uint8Array[] = []; // Fallback RAM buffer

    // Asymmetric Pipeline Queue
    private blockQueue: { block: AudioScriptBlock, index: number }[] = [];
    private isProcessingQueue = false;
    private processedBlockCount = 0;
    private totalBlocks = 0;
    private voiceName: TtsVoice = 'Aoede';
    private CROSSFADE_DURATION = 2.0; // Seconds overlap

    // State
    public isProcessing = false;
    private onProgressCallback: (p: number) => void = () => {};
    private onReadyToPlayCallback: () => void = () => {};
    private cruiseControlInterval: number | null = null;
    
    constructor() {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: this.sampleRate });
    }

    /**
     * Inicializa o sistema de arquivos privado (OPFS) para gravação direta em disco.
     */
    private async initStorage() {
        try {
            const root = await navigator.storage.getDirectory();
            // Cria um arquivo temporário único para esta sessão
            const fileName = `prayer_stream_${Date.now()}.wav`;
            this.fileHandle = await root.getFileHandle(fileName, { create: true });
            
            // @ts-ignore - TypeScript definitions might be outdated for OPFS
            this.writable = await this.fileHandle.createWritable();
            
            // Escreve o cabeçalho WAV (Placeholder de 44 bytes)
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

    /**
     * Inicia o pipeline assimétrico.
     */
    public async startStream(
        blocks: AudioScriptBlock[], 
        voice: TtsVoice, 
        onProgress: (p: number) => void,
        onReadyToPlay: () => void
    ) {
        this.isProcessing = true;
        this.onProgressCallback = onProgress;
        this.onReadyToPlayCallback = onReadyToPlay;
        this.voiceName = voice;
        this.totalBlocks = blocks.length;
        this.processedBlockCount = 0;
        
        // Populate Queue
        this.blockQueue = blocks.map((block, index) => ({ block, index }));
        
        await this.initStorage();
        
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
        this.nextStartTime = this.audioContext.currentTime + 0.2;

        // WARM START: Process first 2 blocks immediately (High Priority)
        console.log("🔥 Warm Start: Processing initial blocks...");
        await this.processNext(); // Block 1 (Intro)
        this.onReadyToPlayCallback(); // Trigger play ASAP
        await this.processNext(); // Block 2 (Stabilization)

        // CRUISE CONTROL: Start monitoring for the rest
        this.startCruiseControl();
    }

    /**
     * Cruise Control Loop: Monitors buffer health and decides when to process.
     */
    private startCruiseControl() {
        this.cruiseControlInterval = window.setInterval(async () => {
            if (this.blockQueue.length === 0 && !this.isProcessingQueue) {
                this.stopCruiseControl();
                await this.finalizeStorage();
                this.isProcessing = false;
                this.onProgressCallback(100);
                return;
            }

            if (this.isProcessingQueue) return;

            // Calculate Audio Buffer Health (Time remaining in scheduled audio)
            const timeRemaining = this.nextStartTime - this.audioContext.currentTime;
            
            // Logic:
            // If buffer < 180s (3 mins), generate!
            // If buffer > 300s (5 mins), sleep (save battery/cpu).
            if (timeRemaining < 180) {
                // console.log(`⚡ Cruise Control: Buffer low (${timeRemaining.toFixed(1)}s). Processing next block.`);
                await this.processNext();
            } else {
                // console.log(`💤 Cruise Control: Buffer healthy (${timeRemaining.toFixed(1)}s). Sleeping.`);
            }
            
            // Update Progress UI based on blocks processed, not just time
            const progress = (this.processedBlockCount / this.totalBlocks) * 100;
            this.onProgressCallback(progress);

        }, 1000); // Check every second
    }

    private stopCruiseControl() {
        if (this.cruiseControlInterval) {
            clearInterval(this.cruiseControlInterval);
            this.cruiseControlInterval = null;
        }
    }

    private async processNext() {
        if (this.blockQueue.length === 0 || this.isProcessingQueue) return;
        
        this.isProcessingQueue = true;
        const item = this.blockQueue.shift();
        
        if (item) {
            try {
                const pcmData = await this.processBlock(item.block, this.voiceName);
                if (pcmData) {
                    // Caminho A: Playback com Crossfade
                    await this.schedulePlayback(pcmData, item.block.instructions.mood);
                    
                    // Caminho B: Storage
                    await this.writeChunk(pcmData);
                }
                this.processedBlockCount++;
            } catch (e) {
                console.error("Error processing block:", e);
            }
        }
        this.isProcessingQueue = false;
    }

    /**
     * Processa um bloco de texto: TTS -> Mixagem com Música -> PCM Raw
     */
    private async processBlock(block: AudioScriptBlock, voice: TtsVoice): Promise<Float32Array | null> {
        // 1. Chunking e TTS
        const textChunks = splitTextIntoChunks(block.text);
        const tempCtx = new OfflineAudioContext(1, 48000, this.sampleRate); // Dummy
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
            await new Promise(r => setTimeout(r, 50)); // Rate limit throttle
        }

        if (blockChunkBuffers.length === 0) return null;

        const voiceBuffer = stitchBuffers(this.audioContext, blockChunkBuffers);
        
        // 2. Timings e Música
        const voiceDuration = voiceBuffer.duration;
        // We don't rely on pauseAfter for spacing anymore, we rely on Crossfade. 
        // So we just ensure the music covers the voice + crossfade tail.
        const totalDuration = voiceDuration + 1.0; // Small tail
        const totalSamples = Math.ceil(totalDuration * this.sampleRate);

        // 3. Mixagem Offline (Voice + Music)
        const offlineCtx = new OfflineAudioContext(2, totalSamples, this.sampleRate);
        
        // Voz
        const voiceSource = offlineCtx.createBufferSource();
        voiceSource.buffer = voiceBuffer;
        voiceSource.connect(offlineCtx.destination);
        voiceSource.start(0);
        
        // Música
        const musicBuffer = createPadBuffer(offlineCtx, totalDuration, block.instructions.mood);
        const musicSource = offlineCtx.createBufferSource();
        musicSource.buffer = musicBuffer;
        const musicGain = offlineCtx.createGain();
        
        // Automação de Volume (Ducking)
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

        // Binaural
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
        
        // Retorna dados estéreo intercalados (Interleaved L-R-L-R)
        const L = renderedBuffer.getChannelData(0);
        const R = renderedBuffer.getChannelData(1);
        const interleaved = new Float32Array(L.length * 2);
        for (let i = 0; i < L.length; i++) {
            interleaved[i * 2] = L[i];
            interleaved[i * 2 + 1] = R[i];
        }
        
        return interleaved;
    }

    /**
     * Caminho A: Agenda o áudio com CROSSFADE.
     */
    private async schedulePlayback(data: Float32Array, mood: string) {
        const now = this.audioContext.currentTime;
        
        // Safety Buffer Check
        if (this.nextStartTime < now && this.processedBlockCount > 0) {
             console.warn("⚠️ Gap Detected. Resetting clock.");
             this.nextStartTime = now + 0.1;
        }

        // --- CROSSFADE LOGIC ---
        // Instead of starting AT nextStartTime, we start BEFORE it to overlap.
        // But if it's the very first block, we don't overlap.
        let startTime = this.nextStartTime;
        let fadeDuration = 0.5; // Default short fade

        if (this.processedBlockCount > 0) {
            // Overlap logic: Start 'CROSSFADE_DURATION' earlier than the end of previous
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
        
        // Envelope Automation
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(1, startTime + fadeDuration); // Fade In
        // Fade Out at the end to ensure clean mix if next block comes
        gainNode.gain.setValueAtTime(1, startTime + buffer.duration - fadeDuration);
        gainNode.gain.linearRampToValueAtTime(0, startTime + buffer.duration); 
        
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        source.start(startTime);
        
        // Update cursor: Point to where the NEXT block should logically end relative to this one
        // Effectively: Start Time + Duration - Overlap Amount (because next one will subtract overlap too)
        // Simplified: We just track the absolute end, and the NEXT schedule call subtracts.
        this.nextStartTime = startTime + buffer.duration;
    }

    /**
     * Caminho B: Escreve o chunk PCM no disco (OPFS).
     */
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

    /**
     * Finaliza o arquivo WAV.
     */
    private async finalizeStorage() {
        const header = new ArrayBuffer(44);
        const view = new DataView(header);
        const fileSize = 36 + this.totalBytesWritten;
        
        writeString(view, 0, 'RIFF');
        view.setUint32(4, fileSize, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); // PCM
        view.setUint16(22, 2, true); // Stereo
        view.setUint32(24, this.sampleRate, true);
        view.setUint32(28, this.sampleRate * 4, true); // ByteRate
        view.setUint16(32, 4, true); // BlockAlign
        view.setUint16(34, 16, true); // BitsPerSample
        writeString(view, 36, 'data');
        view.setUint32(40, this.totalBytesWritten, true);

        if (this.useOPFS && this.writable && this.fileHandle) {
            // @ts-ignore
            await this.writable.seek(0);
            await this.writable.write(header);
            await this.writable.close();
            console.log("🚀 Blade Runner Engine: Finalized.");
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
        this.stopCruiseControl();
        this.audioContext.close();
    }
}

export const createAudioStream = () => new AudioStreamController();
