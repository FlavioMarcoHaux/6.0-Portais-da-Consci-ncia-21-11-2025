
import { AudioScriptBlock } from '../types.ts';
import { generateSpeech, TtsVoice } from './geminiTtsService.ts';
import { decode, decodeAudioData } from '../utils/audioUtils.ts';

// --- Sound Synthesis Helpers ---

const createPadBuffer = (ctx: BaseAudioContext, duration: number, mood: string): AudioBuffer => {
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
            sample += Math.sin(2 * Math.PI * f * t) * 0.1;
            sample += Math.sin(2 * Math.PI * (f * 1.01) * t) * 0.1; 
            sample += (Math.random() * 2 - 1) * 0.005;
        });

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

// --- Smart Splitter for Chunking ---
// Divides long text into smaller chunks to maintain TTS quality
const splitTextIntoChunks = (text: string): string[] => {
    // Split by sentence terminators to keep intonation natural
    const chunks = text.match(/[^.!?;\n]+[.!?;\n]+/g) || [text];
    
    const mergedChunks: string[] = [];
    let current = "";
    
    for (const chunk of chunks) {
        // Keep chunks around ~300 chars for optimal TTS speed/quality balance
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

// Stitch multiple audio buffers into one continuous buffer
const stitchBuffers = (ctx: AudioContext, buffers: AudioBuffer[]): AudioBuffer => {
    if (buffers.length === 0) return ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); // 1s silence
    const totalLength = buffers.reduce((acc, b) => acc + b.length, 0);
    const result = ctx.createBuffer(1, totalLength, ctx.sampleRate);
    const data = result.getChannelData(0);
    let offset = 0;
    for (const b of buffers) {
        data.set(b.getChannelData(0), offset);
        offset += b.length;
    }
    return result;
}

// Helper for WAV header
function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export const renderAudioSession = async (
    blocks: AudioScriptBlock[],
    voice: TtsVoice,
    onProgress: (progress: number) => void
): Promise<string> => {
    const sampleRate = 24000; 
    // Temporary context for decoding. Closed after use.
    const tempCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate });
    
    // Store raw PCM data (Int16) instead of AudioBuffers to save RAM
    const pcmChunks: Uint8Array[] = [];
    
    const totalSteps = blocks.length; 

    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        
        // 1. Text Chunking & TTS Generation
        const textChunks = splitTextIntoChunks(block.text);
        const blockChunkBuffers: AudioBuffer[] = [];

        for (const chunk of textChunks) {
            try {
                // Retry logic
                let attempts = 0;
                let success = false;
                while(attempts < 3 && !success) {
                    try {
                        const speech = await generateSpeech(chunk, voice);
                        if (speech?.data) {
                            const audioData = decode(speech.data);
                            const buffer = await decodeAudioData(audioData, tempCtx, sampleRate, 1);
                            blockChunkBuffers.push(buffer);
                            success = true;
                        } else {
                            throw new Error("Empty response");
                        }
                    } catch(e) {
                        attempts++;
                        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
                    }
                }
            } catch (e) {
                console.error(`TTS Chunk failed in block ${i}`);
            }
            // Small delay to prevent rate limits
            await new Promise(resolve => setTimeout(resolve, 50)); 
        }

        // 2. Stitch chunks into a single voice track for this block
        const voiceBuffer = stitchBuffers(tempCtx, blockChunkBuffers);
        
        // 3. Calculate Timings
        const voiceDuration = voiceBuffer.duration;
        
        // Dynamic Pause Logic: 
        // If text is short but target duration is long, fill with music.
        // But cap silence at 30s to avoid "dead air" sensation.
        let pauseDuration = block.instructions.pauseAfter || 2; 
        
        if (block.targetDuration) {
            const remainingTime = block.targetDuration - voiceDuration;
            if (remainingTime > 0) {
                pauseDuration = Math.min(remainingTime, 30); // Cap silence at 30s
            }
        }
        
        const blockTotalDuration = voiceDuration + pauseDuration;
        // Ensure at least minimal duration
        const safeDuration = Math.max(blockTotalDuration, voiceDuration + 1); 
        const blockTotalSamples = Math.ceil(safeDuration * sampleRate);

        // 4. Mix Voice + Music (Offline)
        // Processing block-by-block keeps RAM usage low
        const offlineCtx = new OfflineAudioContext(2, blockTotalSamples, sampleRate);
        
        // Voice Track
        const voiceSource = offlineCtx.createBufferSource();
        voiceSource.buffer = voiceBuffer;
        voiceSource.connect(offlineCtx.destination);
        voiceSource.start(0);
        
        // Music Track
        const musicBuffer = createPadBuffer(offlineCtx, safeDuration, block.instructions.mood);
        const musicSource = offlineCtx.createBufferSource();
        musicSource.buffer = musicBuffer;
        const musicGain = offlineCtx.createGain();
        
        // Ducking (Volume automation)
        const intensity = block.instructions.intensity || 0.5;
        const duckVol = 0.15 * intensity;
        const fullVol = 0.4 * intensity;
        
        musicGain.gain.setValueAtTime(0.3 * intensity, 0);
        musicGain.gain.linearRampToValueAtTime(duckVol, 0.5); // Fade down for voice
        if (voiceDuration > 1) {
            musicGain.gain.setValueAtTime(duckVol, voiceDuration - 0.5); 
        }
        musicGain.gain.linearRampToValueAtTime(fullVol, voiceDuration + 0.5); // Swell up after voice
        
        musicSource.connect(musicGain);
        musicGain.connect(offlineCtx.destination);
        musicSource.start(0);
        
        // Binaural Track (Optional)
        if (block.instructions.binauralFreq) {
            const binBuffer = createBinauralBuffer(offlineCtx, safeDuration, block.instructions.binauralFreq);
            const binSource = offlineCtx.createBufferSource();
            binSource.buffer = binBuffer;
            const binGain = offlineCtx.createGain();
            binGain.gain.value = 0.06; 
            binSource.connect(binGain);
            binGain.connect(offlineCtx.destination);
            binSource.start(0);
        }
        
        const renderedBlock = await offlineCtx.startRendering();
        
        // 5. Convert to PCM Int16 immediately to free memory
        const L = renderedBlock.getChannelData(0);
        const R = renderedBlock.getChannelData(1);
        const interleaved = new Int16Array(L.length * 2);
        
        for (let s = 0; s < L.length; s++) {
            // Clip and convert
            const pcmL = Math.max(-1, Math.min(1, L[s]));
            const pcmR = Math.max(-1, Math.min(1, R[s]));
            interleaved[s * 2] = pcmL < 0 ? pcmL * 0x8000 : pcmL * 0x7FFF;
            interleaved[s * 2 + 1] = pcmR < 0 ? pcmR * 0x8000 : pcmR * 0x7FFF;
        }
        
        pcmChunks.push(new Uint8Array(interleaved.buffer));
        
        onProgress(((i + 1) / totalSteps) * 100);
        
        // Allow UI update
        await new Promise(r => setTimeout(r, 10));
    }
    
    tempCtx.close();
    
    // 6. Binary Stitching (Concatenation)
    const totalBytes = pcmChunks.reduce((acc, c) => acc + c.length, 0);
    const wavBuffer = new Uint8Array(44 + totalBytes);
    const view = new DataView(wavBuffer.buffer);
    
    // Write WAV Header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + totalBytes, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 2, true); // Stereo
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 4, true); // ByteRate
    view.setUint16(32, 4, true); // BlockAlign
    view.setUint16(34, 16, true); // BitsPerSample
    writeString(view, 36, 'data');
    view.setUint32(40, totalBytes, true);
    
    // Write Data
    let offset = 44;
    for (const chunk of pcmChunks) {
        wavBuffer.set(chunk, offset);
        offset += chunk.length;
    }
    
    return URL.createObjectURL(new Blob([wavBuffer], { type: 'audio/wav' }));
};
