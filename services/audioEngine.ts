
import { AudioScriptBlock } from '../types.ts';
import { generateSpeech, TtsVoice } from './geminiTtsService.ts';
import { decode, decodeAudioData, encodeWAV } from '../utils/audioUtils.ts';

// --- Sound Synthesis Helpers ---

// Create a "Pad" sound (Ambient Drone) using oscillators
const createPadBuffer = (ctx: BaseAudioContext, duration: number, mood: string): AudioBuffer => {
    const sampleRate = ctx.sampleRate;
    const buffer = ctx.createBuffer(2, sampleRate * duration, sampleRate);
    const L = buffer.getChannelData(0);
    const R = buffer.getChannelData(1);

    // Fundamental frequencies based on mood
    let frequencies = [146.83, 185.00, 220.00]; // D Minor (Deep/Sad/Ethereal default)
    if (mood === 'warm' || mood === 'nature') frequencies = [146.83, 185.00, 220.00, 293.66]; // D Major ish
    if (mood === 'epic') frequencies = [98.00, 146.83, 196.00]; // G power chord low
    
    // Generate simple additive synthesis
    for (let i = 0; i < buffer.length; i++) {
        let sample = 0;
        const t = i / sampleRate;
        
        frequencies.forEach(f => {
            // Add slight detuning for richness
            sample += Math.sin(2 * Math.PI * f * t) * 0.1;
            sample += Math.sin(2 * Math.PI * (f * 1.01) * t) * 0.1; 
            // Add some "breath" (noise)
            sample += (Math.random() * 2 - 1) * 0.005;
        });

        // Simple envelope (fade in/out)
        let envelope = 1;
        if (t < 2) envelope = t / 2;
        if (t > duration - 2) envelope = (duration - t) / 2;
        
        L[i] = sample * envelope * 0.5;
        R[i] = sample * envelope * 0.5; 
    }
    
    return buffer;
};

// Create Binaural Beats
const createBinauralBuffer = (ctx: BaseAudioContext, duration: number, freqHz: number): AudioBuffer => {
    const sampleRate = ctx.sampleRate;
    const buffer = ctx.createBuffer(2, sampleRate * duration, sampleRate);
    const L = buffer.getChannelData(0);
    const R = buffer.getChannelData(1);
    
    const baseFreq = 200; // Carrier frequency
    
    for (let i = 0; i < buffer.length; i++) {
        const t = i / sampleRate;
        // Left Ear: Base
        L[i] = Math.sin(2 * Math.PI * baseFreq * t) * 0.1;
        // Right Ear: Base + Target Frequency
        R[i] = Math.sin(2 * Math.PI * (baseFreq + freqHz) * t) * 0.1;
    }
    return buffer;
};

export const renderAudioSession = async (
    blocks: AudioScriptBlock[],
    voice: TtsVoice,
    onProgress: (progress: number) => void
): Promise<string> => {
    const sampleRate = 24000; // Optimized for Voice/Web Audio stability
    const tempCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate });
    const audioBuffers: AudioBuffer[] = [];
    
    // 1. Generate TTS Audio for all blocks
    for (let i = 0; i < blocks.length; i++) {
        onProgress((i / blocks.length) * 50); // First 50% is TTS generation
        const block = blocks[i];
        try {
            const speech = await generateSpeech(block.text, voice);
            if (speech?.data) {
                const audioData = decode(speech.data);
                const buffer = await decodeAudioData(audioData, tempCtx, sampleRate, 1);
                audioBuffers.push(buffer);
            } else {
                audioBuffers.push(tempCtx.createBuffer(1, sampleRate, sampleRate)); 
            }
        } catch (e) {
            console.error("TTS Generation failed for block", i, e);
            audioBuffers.push(tempCtx.createBuffer(1, sampleRate, sampleRate));
        }
    }
    
    // 2. Calculate Total Duration and Timeline with INTELLIGENT Time-Boxing
    let totalSamples = 0;
    const timeline: { start: number; buffer: AudioBuffer; block: AudioScriptBlock; pauseDuration: number }[] = [];
    
    let currentTime = 0;
    for (let i = 0; i < audioBuffers.length; i++) {
        const buffer = audioBuffers[i];
        const block = blocks[i];
        
        const ttsDuration = buffer.duration;
        
        // --- INTELLIGENT TIME-BOXING LOGIC ---
        // Se o texto gerado for muito curto, NÃO force um silêncio gigante para preencher o tempo.
        // Isso evita a sensação de "TDAH" ou desconexão.
        // Aceitamos que a oração fique um pouco mais curta que o alvo se o conteúdo acabou,
        // mas mantemos um fluxo musical agradável.
        
        let pauseDuration = block.instructions.pauseAfter || 5; // Default natural pause
        
        if (block.targetDuration) {
            const remainingTime = block.targetDuration - ttsDuration;
            // Se sobrar tempo, adicione pausa, MAS com um teto máximo de 20s.
            // Se o texto foi curto demais, o usuário ouvirá 20s de música e passará para o próximo bloco,
            // mantendo o fluxo, em vez de esperar 2 minutos no silêncio.
            if (remainingTime > 0) {
                pauseDuration = Math.min(remainingTime, 20); 
            }
        }
        // -------------------------
        
        timeline.push({ start: currentTime, buffer, block, pauseDuration });
        
        currentTime += ttsDuration + pauseDuration;
    }
    
    // Add a tail for decay
    totalSamples = Math.ceil((currentTime + 5) * sampleRate);

    // 3. Offline Rendering
    const offlineCtx = new OfflineAudioContext(2, totalSamples, sampleRate);
    
    // A. Render TTS Tracks
    timeline.forEach(item => {
        const source = offlineCtx.createBufferSource();
        source.buffer = item.buffer;
        source.connect(offlineCtx.destination);
        source.start(item.start);
    });
    
    // B. Render Music/Atmosphere Layer
    const musicBuffer = createPadBuffer(offlineCtx, currentTime + 5, blocks[0].instructions.mood);
    const musicSource = offlineCtx.createBufferSource();
    musicSource.buffer = musicBuffer;
    const musicGain = offlineCtx.createGain();
    musicSource.connect(musicGain);
    musicGain.connect(offlineCtx.destination);
    
    // C. Render Binaural Layer
    const avgFreq = blocks[0].instructions.binauralFreq || 4;
    const binauralBuffer = createBinauralBuffer(offlineCtx, currentTime + 5, avgFreq);
    const binauralSource = offlineCtx.createBufferSource();
    binauralSource.buffer = binauralBuffer;
    const binauralGain = offlineCtx.createGain();
    binauralGain.gain.value = 0.05; 
    binauralSource.connect(binauralGain);
    binauralGain.connect(offlineCtx.destination);
    
    // D. Automation
    musicGain.gain.setValueAtTime(0.3, 0);
    
    timeline.forEach(item => {
        const speechStart = item.start;
        const speechEnd = item.start + item.buffer.duration;
        const pauseEnd = speechEnd + item.pauseDuration;
        const intensity = item.block.instructions.intensity;
        
        // Duck during speech
        musicGain.gain.linearRampToValueAtTime(0.2 * intensity, speechStart + 0.5); 
        musicGain.gain.linearRampToValueAtTime(0.2 * intensity, speechEnd - 0.5);
        
        // Swell during pause
        if (item.pauseDuration > 2) {
             musicGain.gain.linearRampToValueAtTime(0.5 * intensity, speechEnd + 1);
             musicGain.gain.linearRampToValueAtTime(0.5 * intensity, pauseEnd - 1);
        }
    });
    
    musicSource.start(0);
    binauralSource.start(0);

    onProgress(75);

    // 4. Final Render
    const renderedBuffer = await offlineCtx.startRendering();
    
    onProgress(90);

    // 5. Convert to WAV
    const L = renderedBuffer.getChannelData(0);
    const R = renderedBuffer.getChannelData(1);
    const interleaved = new Float32Array(L.length + R.length);
    for (let i = 0; i < L.length; i++) {
        interleaved[i * 2] = L[i];
        interleaved[i * 2 + 1] = R[i];
    }
    
    const int16Buffer = new Int16Array(interleaved.length);
    for (let i = 0; i < interleaved.length; i++) {
        const s = Math.max(-1, Math.min(1, interleaved[i]));
        int16Buffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    const wavBlob = encodeWAV(new Uint8Array(int16Buffer.buffer), sampleRate, 2, 16);
    
    onProgress(100);
    return URL.createObjectURL(wavBlob);
};
