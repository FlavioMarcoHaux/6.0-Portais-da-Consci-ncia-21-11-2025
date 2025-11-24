
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

// --- BLADE RUNNER ENGINE: Audio Stream Controller ---

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

    // State
    public isProcessing = false;
    private onProgressCallback: (p: number) => void = () => {};
    private onReadyToPlayCallback: () => void = () => {};
    
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
            // Preencheremos os tamanhos corretos ao finalizar (seek).
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
     * Inicia o pipeline de geração, streaming e gravação.
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
        
        await this.initStorage();
        
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
        this.nextStartTime = this.audioContext.currentTime + 0.5; // Pequeno buffer inicial

        let completedBlocks = 0;
        
        for (let i = 0; i < blocks.length; i++) {
            // Pipeline: Texto -> TTS -> Mixagem -> PCM
            const pcmData = await this.processBlock(blocks[i], voice);
            
            if (pcmData) {
                // Bifurcação do Pipeline:
                
                // 1. Caminho A: Playback Imediato (AudioContext)
                await this.schedulePlayback(pcmData, blocks[i].instructions.mood);
                if (i === 0) this.onReadyToPlayCallback(); // Avisa UI que pode tocar

                // 2. Caminho B: Gravação em Disco (OPFS)
                await this.writeChunk(pcmData);
            }

            completedBlocks++;
            this.onProgressCallback((completedBlocks / blocks.length) * 100);
            
            // Yield para UI não travar
            await new Promise(r => setTimeout(r, 20));
        }

        await this.finalizeStorage();
        this.isProcessing = false;
    }

    /**
     * Processa um bloco de texto: TTS -> Mixagem com Música -> PCM Raw
     */
    private async processBlock(block: AudioScriptBlock, voice: TtsVoice): Promise<Float32Array | null> {
        // 1. Chunking e TTS
        const textChunks = splitTextIntoChunks(block.text);
        // Decodificador temporário
        const tempCtx = new OfflineAudioContext(1, 48000, this.sampleRate); // Dummy para ter acesso a decodeAudioData
        const blockChunkBuffers: AudioBuffer[] = [];

        for (const chunk of textChunks) {
            try {
                let attempts = 0;
                let success = false;
                while(attempts < 3 && !success) {
                    try {
                        const speech = await generateSpeech(chunk, voice);
                        if (speech?.data) {
                            // Precisamos usar um AudioContext real para decodificar
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
        let pauseDuration = block.instructions.pauseAfter || 2;
        if (block.targetDuration) {
            const remaining = block.targetDuration - voiceDuration;
            if (remaining > 0) pauseDuration = Math.min(remaining, 20); // Cap silence at 20s
        }
        
        const totalDuration = Math.max(voiceDuration + pauseDuration, voiceDuration + 1);
        const totalSamples = Math.ceil(totalDuration * this.sampleRate);

        // 3. Mixagem Offline (Voice + Music)
        // Usamos OfflineAudioContext para renderizar rápido sem tocar
        const offlineCtx = new OfflineAudioContext(2, totalSamples, this.sampleRate);
        
        // Voz
        const voiceSource = offlineCtx.createBufferSource();
        voiceSource.buffer = voiceBuffer;
        voiceSource.connect(offlineCtx.destination);
        voiceSource.start(0);
        
        // Música (Gerada proceduralmente para economizar banda)
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
     * Caminho A: Agenda o áudio para tocar no AudioContext principal.
     */
    private async schedulePlayback(data: Float32Array, mood: string) {
        const now = this.audioContext.currentTime;
        const safetyGap = 3.0; // Seconds before audio runs out to start triggering filler

        // --- SAFETY BUFFER / GAP FILLER LOGIC ---
        // If nextStartTime is too close to now (or in the past), we are lagging.
        // We must insert a pad buffer to fill the gap until the voice is ready.
        // We add a small crossfade.
        
        if (this.nextStartTime < now + safetyGap) {
            console.warn("⚠️ Audio Lag Detected! Inserting Safety Filler.");
            const fillerDuration = 6; // Insert 6 seconds of pad
            const fillerBuffer = createPadBuffer(this.audioContext, fillerDuration, mood);
            
            const fillerSource = this.audioContext.createBufferSource();
            fillerSource.buffer = fillerBuffer;
            
            const fillerGain = this.audioContext.createGain();
            // Fade In/Out for the filler
            fillerGain.gain.setValueAtTime(0, now);
            fillerGain.gain.linearRampToValueAtTime(0.5, now + 1);
            fillerGain.gain.setValueAtTime(0.5, now + fillerDuration - 1);
            fillerGain.gain.linearRampToValueAtTime(0, now + fillerDuration);
            
            fillerSource.connect(fillerGain);
            fillerGain.connect(this.audioContext.destination);
            
            // Start filler effectively now (or at tail of previous)
            const fillerStart = Math.max(now, this.nextStartTime);
            fillerSource.start(fillerStart);
            
            // Push nextStartTime forward so the actual voice block comes after the filler
            // We overlap slightly (1s) for crossfade
            this.nextStartTime = fillerStart + fillerDuration - 1.0; 
        }

        // --- Standard Playback ---
        // Converte Float32Array de volta para AudioBuffer para tocar
        const buffer = this.audioContext.createBuffer(2, data.length / 2, this.sampleRate);
        const L = buffer.getChannelData(0);
        const R = buffer.getChannelData(1);
        for (let i = 0; i < L.length; i++) {
            L[i] = data[i * 2];
            R[i] = data[i * 2 + 1];
        }

        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        
        // Add a GainNode for crossfading entry
        const gainNode = this.audioContext.createGain();
        gainNode.gain.setValueAtTime(0, this.nextStartTime);
        gainNode.gain.linearRampToValueAtTime(1, this.nextStartTime + 0.5); // Short fade-in to avoid clicks
        
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        // Schedule
        const startTime = Math.max(this.nextStartTime, now + 0.1);
        source.start(startTime);
        
        this.nextStartTime = startTime + buffer.duration;
    }

    /**
     * Caminho B: Escreve o chunk PCM no disco (OPFS).
     */
    private async writeChunk(data: Float32Array) {
        // Converter Float32 (-1.0 a 1.0) para Int16 (PCM)
        const int16 = new Int16Array(data.length);
        for (let i = 0; i < data.length; i++) {
            const s = Math.max(-1, Math.min(1, data[i]));
            int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        const bytes = new Uint8Array(int16.buffer);

        if (this.useOPFS && this.writable) {
            await this.writable.write(bytes);
        } else {
            // Fallback RAM
            this.memoryBuffer.push(bytes);
        }
        
        this.totalBytesWritten += bytes.length;
    }

    /**
     * Finaliza o arquivo WAV escrevendo o cabeçalho correto.
     */
    private async finalizeStorage() {
        const header = new ArrayBuffer(44);
        const view = new DataView(header);
        
        // WAV Header Construction
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
            // Seek to beginning to overwrite placeholder header
            // @ts-ignore
            await this.writable.seek(0);
            await this.writable.write(header);
            await this.writable.close();
            console.log("🚀 Blade Runner Engine: File Saved to OPFS successfully.");
        } else {
            // Fallback: Concatenate all RAM buffers
            // Note: This is RAM heavy, but it's the only way if OPFS fails
            const finalBuffer = new Uint8Array(44 + this.totalBytesWritten);
            finalBuffer.set(new Uint8Array(header), 0);
            let offset = 44;
            for (const chunk of this.memoryBuffer) {
                finalBuffer.set(chunk, offset);
                offset += chunk.length;
            }
            // Store as a Blob URL temporarily if needed, but for now we rely on getDownloadUrl
            this.memoryBuffer = [finalBuffer]; // Hack to store result
        }
    }

    public async getDownloadUrl(): Promise<string> {
        if (this.useOPFS && this.fileHandle) {
            const file = await this.fileHandle.getFile();
            return URL.createObjectURL(file);
        } else if (this.memoryBuffer.length > 0) {
            // Fallback RAM buffer (either chunks or finalized single buffer)
            // If not finalized, we might have issue, but finalizeStorage handles it.
            const blob = new Blob(this.memoryBuffer, { type: 'audio/wav' });
            return URL.createObjectURL(blob);
        }
        return '';
    }

    // Controles de Playback
    public pause() {
        if (this.audioContext.state === 'running') this.audioContext.suspend();
    }

    public resume() {
        if (this.audioContext.state === 'suspended') this.audioContext.resume();
    }
    
    public close() {
        this.audioContext.close();
        // Cleanup OPFS file? Maybe keep it for download.
    }
}

// Wrapper para compatibilidade com código existente (se necessário), 
// mas a UI deve usar a classe diretamente para streaming.
export const createAudioStream = () => new AudioStreamController();
