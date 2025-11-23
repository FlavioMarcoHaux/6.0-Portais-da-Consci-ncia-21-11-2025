
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store.ts';
import { CoherenceVector, AgentId, Session } from '../types.ts';
import { generateGuidedPrayer, recommendPrayerTheme } from '../services/geminiPrayerService.ts';
import { createAudioStream, AudioStreamController } from '../services/audioEngine.ts';
import { getFriendlyErrorMessage } from '../utils/errorUtils.ts';
import { X, BookOpen, Loader2, Download, RefreshCw, Sun, Moon, Brain, Play, Pause, Zap, Settings2, FastForward, Rewind } from 'lucide-react';

interface GuidedPrayerProps {
    onExit: (isManual: boolean, result?: any) => void;
}

// --- Advanced Player Component ---
interface AdvancedPlayerProps {
    src: string;
    onReset: () => void;
    onFinish: () => void;
    theme: string;
    duration: number;
}

const AdvancedAudioPlayer: React.FC<AdvancedPlayerProps> = ({ src, onReset, onFinish, theme, duration }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [totalDuration, setTotalDuration] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1.0);
    const [showSpeedMenu, setShowSpeedMenu] = useState(false);

    const formatTime = (time: number) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            setTotalDuration(audioRef.current.duration);
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        if (audioRef.current) {
            audioRef.current.currentTime = time;
            setCurrentTime(time);
        }
    };

    const changeSpeed = (rate: number) => {
        if (audioRef.current) {
            audioRef.current.playbackRate = rate;
            setPlaybackRate(rate);
            setShowSpeedMenu(false);
        }
    };

    const skip = (seconds: number) => {
        if (audioRef.current) {
            audioRef.current.currentTime += seconds;
        }
    };

    return (
        <div className="w-full bg-gray-800/90 backdrop-blur-md rounded-2xl p-6 border border-yellow-500/30 shadow-2xl animate-fade-in">
            <audio
                ref={audioRef}
                src={src}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => setIsPlaying(false)}
            />

            {/* Title Area */}
            <div className="text-center mb-6">
                <h3 className="text-yellow-400 text-xs font-bold uppercase tracking-widest mb-1">Tocando Agora</h3>
                <h2 className="text-white text-xl font-bold line-clamp-1">{theme}</h2>
            </div>

            {/* Waveform Visualization (Static Placeholder for aesthetic) */}
            <div className="flex items-center justify-center gap-1 h-12 mb-6 opacity-50">
                {[...Array(20)].map((_, i) => (
                    <div 
                        key={i} 
                        className="w-1 bg-yellow-500 rounded-full transition-all duration-300"
                        style={{ 
                            height: isPlaying ? `${Math.random() * 100}%` : '20%',
                            opacity: Math.random() * 0.5 + 0.5 
                        }}
                    />
                ))}
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
                <input
                    type="range"
                    min="0"
                    max={totalDuration || 100}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500 hover:accent-yellow-400"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-2 font-mono">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(totalDuration)}</span>
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between relative">
                {/* Speed Control */}
                <div className="relative">
                    <button 
                        onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                        className="text-xs font-bold text-yellow-500 bg-yellow-500/10 px-3 py-1.5 rounded-lg hover:bg-yellow-500/20 transition-colors"
                    >
                        {playbackRate}x
                    </button>
                    {showSpeedMenu && (
                        <div className="absolute bottom-full left-0 mb-2 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden flex flex-col min-w-[80px] z-20">
                            {[0.75, 1.0, 1.25, 1.5, 1.75].map(rate => (
                                <button
                                    key={rate}
                                    onClick={() => changeSpeed(rate)}
                                    className={`px-4 py-2 text-sm text-left hover:bg-gray-800 ${playbackRate === rate ? 'text-yellow-400 font-bold' : 'text-gray-300'}`}
                                >
                                    {rate}x
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Playback Buttons */}
                <div className="flex items-center gap-6">
                    <button onClick={() => skip(-10)} className="text-gray-400 hover:text-white transition-colors">
                        <Rewind size={24} />
                    </button>
                    
                    <button 
                        onClick={togglePlay}
                        className="w-16 h-16 bg-yellow-500 hover:bg-yellow-400 text-black rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105"
                    >
                        {isPlaying ? <Pause size={32} fill="black" /> : <Play size={32} fill="black" className="ml-1" />}
                    </button>

                    <button onClick={() => skip(10)} className="text-gray-400 hover:text-white transition-colors">
                        <FastForward size={24} />
                    </button>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                    <a 
                        href={src} 
                        download={`Oração - ${theme}.wav`}
                        className="p-2 text-gray-400 hover:text-yellow-400 transition-colors"
                        title="Baixar"
                    >
                        <Download size={20} />
                    </a>
                </div>
            </div>

            <div className="mt-8 pt-4 border-t border-gray-700/50 flex justify-between items-center">
                <button onClick={onReset} className="text-sm text-gray-500 hover:text-white flex items-center gap-2">
                    <RefreshCw size={14} /> Nova Oração
                </button>
                <button onClick={onFinish} className="text-sm font-bold text-green-400 hover:text-green-300">
                    Concluir Sessão
                </button>
            </div>
        </div>
    );
};

// --- Main Component ---

const getPrayerSuggestions = (vector: CoherenceVector): string[] => {
    const suggestions: { key: keyof Omit<CoherenceVector, 'alinhamentoPAC'>, value: number, themes: string[] }[] = [
        { key: 'proposito', value: vector.proposito.dissonancia, themes: ["encontrar meu propósito", "fortalecer a fé"] },
        { key: 'emocional', value: vector.emocional.dissonancia, themes: ["paz para um coração ansioso", "cura emocional"] },
        { key: 'somatico', value: vector.somatico.dissonancia, themes: ["restauração da saúde", "força para o corpo"] },
        { key: 'recursos', value: vector.recursos.dissonancia, themes: ["abertura de caminhos financeiros", "sabedoria para prosperar"] },
    ];
    const sortedStates = suggestions.sort((a, b) => b.value - a.value);
    const finalSuggestions = new Set<string>();
    sortedStates.slice(0, 2).forEach(state => {
        state.themes.forEach(theme => finalSuggestions.add(theme));
    });
    return Array.from(finalSuggestions).slice(0, 4);
};


const GuidedPrayer: React.FC<GuidedPrayerProps> = ({ onExit }) => {
    const { coherenceVector, chatHistories, lastAgentContext, logActivity, currentSession, toolStates, setToolState } = useStore();
    
    const prayerState = toolStates.guidedPrayer!;
    const updateState = (newState: Partial<typeof prayerState>) => {
        setToolState('guidedPrayer', { ...prayerState, ...newState });
    };
    const { theme, blocks, audioDataUrl, error, state, progress } = prayerState;

    const isVoiceOrigin = currentSession?.origin === 'voice';
    const agentIdForContext = isVoiceOrigin ? null : lastAgentContext ?? AgentId.COHERENCE;
    const chatHistory = agentIdForContext ? (chatHistories[agentIdForContext] || []) : [];

    const [isAutoSuggesting, setIsAutoSuggesting] = useState(false);
    const [isPlayingStream, setIsPlayingStream] = useState(false); // For the simplified stream player
    const [isReadyToPlay, setIsReadyToPlay] = useState(false); 
    const [isDownloadReady, setIsDownloadReady] = useState(false);
    const [isStartingAudio, setIsStartingAudio] = useState(false); // Feedback imediato
    
    // New State for Options
    const [duration, setDuration] = useState(15);
    const [prayerType, setPrayerType] = useState<'diurna' | 'noturna' | 'terapeutica'>('diurna');
    
    // Audio Engine Ref
    const streamControllerRef = useRef<AudioStreamController | null>(null);
    
    const wasAutoStarted = useRef(false);
    const hasConsumedInitialTheme = useRef(false);

    const suggestions = useMemo(() => getPrayerSuggestions(coherenceVector), [coherenceVector]);

    const handleGenerate = useCallback(async (inputTheme: string) => {
        // Cleanup previous audio if exists
        if (audioDataUrl && audioDataUrl.startsWith('blob:')) {
            URL.revokeObjectURL(audioDataUrl);
        }
        
        updateState({ state: 'generating', error: null, blocks: [], audioDataUrl: null, progress: 0 });
        setIsReadyToPlay(false);
        setIsDownloadReady(false);
        setIsStartingAudio(false);
        
        try {
            const generatedBlocks = await generateGuidedPrayer(inputTheme, duration, prayerType, chatHistory);
            updateState({ blocks: generatedBlocks, state: 'display' });
        } catch (err) {
            const friendlyError = getFriendlyErrorMessage(err, "Falha ao gerar a oração.");
            updateState({ error: friendlyError, state: 'error' });
        }
    }, [chatHistory, updateState, duration, prayerType, audioDataUrl]);

    const handleStartStream = useCallback(async () => {
        if (!blocks || blocks.length === 0) return;
        
        // Initialize Blade Runner Engine
        if (streamControllerRef.current) {
            streamControllerRef.current.close();
        }
        streamControllerRef.current = createAudioStream();
        
        updateState({ audioDataUrl: null, error: null, progress: 0 });
        setIsStartingAudio(true); 
        setIsReadyToPlay(false);
        setIsDownloadReady(false);
        setIsPlayingStream(true); 
        
        try {
            const voiceName = prayerType === 'diurna' ? 'Kore' : (prayerType === 'noturna' ? 'Fenrir' : 'Zephyr');
            
            await streamControllerRef.current.startStream(
                blocks, 
                voiceName, 
                (p) => updateState({ progress: p }), // On Progress
                () => {
                    // On Ready To Play (First Chunk Ready)
                    setIsReadyToPlay(true);
                    setIsStartingAudio(false); 
                }
            );
            
            // Finished
            const downloadUrl = await streamControllerRef.current.getDownloadUrl();
            updateState({ audioDataUrl: downloadUrl, progress: 100 });
            
            // Switch to Advanced Player mode logic
            setIsDownloadReady(true);
            setIsPlayingStream(false); // Stop stream indicator, let advanced player take over if needed
            streamControllerRef.current.close(); // Close stream context to free resources for HTML5 audio
            
        } catch (err) {
            const friendlyError = getFriendlyErrorMessage(err, "Falha no streaming de áudio.");
            updateState({ error: friendlyError });
            setIsPlayingStream(false);
            setIsStartingAudio(false);
        }
    }, [blocks, updateState, prayerType]);

    useEffect(() => {
        const session = currentSession as Extract<Session, { type: 'guided_prayer' }>;
        
        if (session?.replayData) {
            const { theme, blocks, audioDataUrl } = session.replayData;
            updateState({ state: 'display', theme, blocks, audioDataUrl, error: null });
            wasAutoStarted.current = true;
            setIsAutoSuggesting(false);
            hasConsumedInitialTheme.current = true;
            setIsReadyToPlay(true);
            setIsDownloadReady(true);
            return;
        }

        if (state !== 'config') return;
        if (hasConsumedInitialTheme.current) return;

        const recommendAndFetch = async () => {
            if (session?.autoStart && session.initialTheme) {
                wasAutoStarted.current = true;
                hasConsumedInitialTheme.current = true;
                updateState({ theme: session.initialTheme });
                handleGenerate(session.initialTheme);
                return;
            }

            if (session?.initialTheme) {
                hasConsumedInitialTheme.current = true;
                updateState({ theme: session.initialTheme });
                setIsAutoSuggesting(false);
                return;
            }

            if (chatHistory && chatHistory.length > 1) {
                setIsAutoSuggesting(true);
                try {
                    const recommended = await recommendPrayerTheme(coherenceVector, chatHistory);
                    updateState({ theme: recommended });
                } catch (err) {
                    console.error("Failed to recommend theme:", err);
                    updateState({ theme: '' }); 
                } finally {
                    setIsAutoSuggesting(false);
                }
            }
        };
        recommendAndFetch();
    }, [currentSession, coherenceVector, chatHistory, handleGenerate, state, updateState]);

    // Auto-start stream if auto-started session
    useEffect(() => {
        if (blocks && blocks.length > 0 && wasAutoStarted.current && !isDownloadReady) {
            handleStartStream();
            wasAutoStarted.current = false; 
        }
    }, [blocks, handleStartStream, isDownloadReady]);

    // Cleanup
    useEffect(() => {
        const url = audioDataUrl;
        return () => {
            if (url && url.startsWith('blob:')) {
                URL.revokeObjectURL(url);
            }
            if (streamControllerRef.current) {
                streamControllerRef.current.close();
            }
        };
    }, [audioDataUrl]);

    const handleReset = () => {
        if (audioDataUrl && audioDataUrl.startsWith('blob:')) {
            URL.revokeObjectURL(audioDataUrl);
        }
        if (streamControllerRef.current) {
            streamControllerRef.current.close();
            streamControllerRef.current = null;
        }
        hasConsumedInitialTheme.current = true;
        
        setToolState('guidedPrayer', (prev) => ({
            ...prev!, 
            state: 'config', 
            theme: '', 
            blocks: [], 
            audioDataUrl: null, 
            error: null, 
            progress: 0 
        }));
        
        wasAutoStarted.current = false;
        setIsPlayingStream(false);
        setIsReadyToPlay(false);
        setIsDownloadReady(false);
        setIsStartingAudio(false);
    };
    
    const toggleStreamPlay = () => {
        if (!streamControllerRef.current) return;
        
        if (isPlayingStream) {
            streamControllerRef.current.pause();
        } else {
            streamControllerRef.current.resume();
        }
        setIsPlayingStream(!isPlayingStream);
    };

    const handleFinishSession = () => {
        const prayerText = blocks.map(b => b.text).join('\n\n');
        logActivity({
            type: 'tool_usage',
            agentId: agentIdForContext ?? AgentId.GUIDE,
            data: {
                toolId: 'guided_prayer',
                result: { theme, prayerText, blocks, audioDataUrl },
            },
        });
        onExit(false, { toolId: 'guided_prayer', result: { theme, prayerText, blocks, audioDataUrl } });
    };

    const renderContent = () => {
        switch (state) {
            case 'config':
                return (
                     <div className="flex-1 overflow-y-auto p-4 sm:p-6 no-scrollbar">
                         <div className="max-w-xl w-full mx-auto space-y-8 pb-8">
                            <p className="text-lg text-gray-300 text-center">Configure sua sessão de oração guiada.</p>
                            
                            {/* Type Selector */}
                             <div className="grid grid-cols-3 gap-2">
                                <button 
                                    onClick={() => setPrayerType('diurna')}
                                    className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${prayerType === 'diurna' ? 'bg-yellow-600/20 border-yellow-500 text-yellow-300' : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
                                >
                                    <Sun size={20} />
                                    <span className="text-xs font-bold">Diurna (Poder)</span>
                                </button>
                                <button 
                                    onClick={() => setPrayerType('noturna')}
                                    className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${prayerType === 'noturna' ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
                                >
                                    <Moon size={20} />
                                    <span className="text-xs font-bold">Noturna (Paz)</span>
                                </button>
                                <button 
                                    onClick={() => setPrayerType('terapeutica')}
                                    className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${prayerType === 'terapeutica' ? 'bg-purple-600/20 border-purple-500 text-purple-300' : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
                                >
                                    <Brain size={20} />
                                    <span className="text-xs font-bold">Terapêutica</span>
                                </button>
                            </div>

                            {/* Duration Chips */}
                            <div>
                                <label className="block text-sm text-gray-400 mb-3 text-center">Duração da Prática</label>
                                <div className="flex flex-wrap justify-center gap-2">
                                    {[5, 10, 15, 20, 30, 45, 60].map(min => (
                                        <button
                                            key={min}
                                            onClick={() => setDuration(min)}
                                            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all border border-transparent ${duration === min ? 'bg-gradient-to-r from-yellow-600 to-orange-600 text-white shadow-lg scale-105' : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:border-gray-500'}`}
                                        >
                                            {min} min
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <textarea 
                                value={theme} 
                                onChange={(e) => updateState({ theme: e.target.value })} 
                                placeholder={isAutoSuggesting ? "Analisando..." : "Qual é a sua intenção? (Ex: Gratidão, Cura, Resposta...)"} 
                                className="w-full bg-gray-800/80 border border-gray-600 rounded-xl p-4 resize-none focus:outline-none focus:ring-2 focus:ring-yellow-500/80 text-lg min-h-[100px]" 
                                disabled={isAutoSuggesting} 
                            />
                            
                            <button onClick={() => handleGenerate(theme)} disabled={!theme.trim() || isAutoSuggesting} className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-800/50 disabled:cursor-not-allowed text-black font-bold py-4 px-8 rounded-xl transition-colors text-lg shadow-lg">Gerar Oração Guiada</button>
                            
                            <div className="text-center">
                                 <p className="text-xs text-gray-500 mb-2">Sugestões para agora:</p>
                                 <div className="flex flex-wrap items-center justify-center gap-2">
                                    {suggestions.map(suggestion => (<button key={suggestion} onClick={() => updateState({ theme: suggestion })} className="px-3 py-1 bg-gray-800 border border-gray-700 text-gray-400 rounded-full text-xs hover:bg-gray-700 hover:border-yellow-500/50 transition-colors disabled:opacity-50" disabled={isAutoSuggesting}>{suggestion}</button>))}
                                </div>
                            </div>
                         </div>
                     </div>
                );
            case 'generating':
                return (
                    <div className="flex-1 flex flex-col items-center justify-center p-4">
                        <div className="flex flex-col items-center text-center max-w-md">
                            <Loader2 className="w-12 h-12 animate-spin text-yellow-400" />
                            <h3 className="text-xl font-bold text-yellow-300 mt-6">Canalizando sua Oração</h3>
                            <p className="mt-4 text-gray-300">O "Arquiteto da Fé" está estruturando uma jornada profunda de {duration} minutos com foco em '{theme}'...</p>
                        </div>
                    </div>
                );
            case 'error':
                 return (
                    <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
                        <h2 className="text-2xl text-red-400 mb-4">Ocorreu um Erro</h2>
                        <p className="text-gray-300 mb-6">{error}</p>
                        <button onClick={handleReset} className="bg-yellow-600 text-black font-bold py-2 px-6 rounded-full">Tentar Novamente</button>
                    </div>
                );
            case 'display':
                const isStreaming = (progress! > 0 && progress! < 100) || isStartingAudio;

                return (
                    <div className="flex-1 flex flex-col h-full min-h-0 p-4 sm:p-6 overflow-hidden animate-fade-in">
                        <div className="w-full max-w-3xl mx-auto text-center flex flex-col h-full">
                            
                            {/* Phase 1: Start / Streaming / Loading */}
                            {!isDownloadReady && (
                                <>
                                    <h2 className="text-2xl font-bold text-center mb-4 text-yellow-300 flex-shrink-0">Intenção: "{theme}"</h2>
                                    <div className="mb-6 p-6 bg-gray-800/60 rounded-2xl flex flex-col items-center gap-4 flex-shrink-0 border border-yellow-500/20 shadow-lg relative overflow-hidden">
                                        {!isReadyToPlay && !isStreaming && (
                                            <button onClick={handleStartStream} className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-4 px-8 rounded-full flex items-center justify-center transition-colors shadow-lg text-lg group">
                                                <Zap size={24} className="mr-3 text-yellow-400 group-hover:animate-pulse" />
                                                Iniciar Experiência ({duration} min)
                                            </button>
                                        )}

                                        {(isStreaming || isReadyToPlay) && (
                                            <>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Loader2 size={16} className="animate-spin text-yellow-400" />
                                                    <span className="text-xs font-bold text-yellow-400 uppercase tracking-widest">
                                                        {isStartingAudio ? 'Conectando com o fluxo...' : 'Gerando...'}
                                                    </span>
                                                </div>

                                                <div className="relative">
                                                    <button 
                                                        onClick={toggleStreamPlay} 
                                                        disabled={isStartingAudio}
                                                        className="w-20 h-20 bg-yellow-500 hover:bg-yellow-400 disabled:bg-yellow-500/50 disabled:cursor-not-allowed text-black rounded-full flex items-center justify-center transition-transform hover:scale-105 shadow-xl relative z-10"
                                                    >
                                                        {isPlayingStream ? <Pause size={40} /> : <Play size={40} className="ml-1" />}
                                                    </button>
                                                </div>

                                                <div className="w-full max-w-sm mt-4">
                                                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                                                        <span>Construindo Áudio</span>
                                                        <span>{Math.round(progress || 0)}%</span>
                                                    </div>
                                                    <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden relative">
                                                        <div 
                                                            className="bg-yellow-500 h-1.5 rounded-full transition-all duration-300 relative z-10" 
                                                            style={{ width: `${progress || 0}%` }}
                                                        >
                                                            {isStreaming && <div className="absolute inset-0 bg-white/30 animate-pulse"></div>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </>
                            )}

                            {/* Phase 2: Advanced Player (Ready) */}
                            {isDownloadReady && audioDataUrl && (
                                <div className="mb-6">
                                    <AdvancedAudioPlayer 
                                        src={audioDataUrl} 
                                        onReset={handleReset} 
                                        onFinish={handleFinishSession}
                                        theme={theme}
                                        duration={duration * 60} // Approx duration for visuals
                                    />
                                </div>
                            )}
                            
                            {/* Text Content - Only show if not in full player mode or if user wants to read */}
                            {!isDownloadReady && (
                                <div className="bg-gray-900/50 p-6 rounded-lg overflow-y-auto text-left flex-1 min-h-0 border border-gray-800 shadow-inner" data-readable-content>
                                     {blocks.map((block, i) => (
                                        <div key={i} className="mb-6 animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
                                            <p className="whitespace-pre-wrap text-gray-200 leading-relaxed text-lg font-serif opacity-90">{block.text}</p>
                                        </div>
                                     ))}
                                </div>
                            )}
                            
                            {!isDownloadReady && (
                                <div className="text-center mt-6 flex items-center justify-center gap-4 flex-shrink-0">
                                    <button onClick={handleReset} className="text-yellow-400 font-semibold flex items-center gap-2"><RefreshCw size={16} />Nova Oração</button>
                                </div>
                            )}
                        </div>
                    </div>
                );
        }
    }

    return (
        <div className="h-full w-full glass-pane rounded-2xl flex flex-col p-1 animate-fade-in">
            <header className="flex items-center justify-between p-4 border-b border-gray-700/50">
                <div className="flex items-center gap-3"><BookOpen className="w-8 h-8 text-yellow-300" /><h1 className="text-xl font-bold text-gray-200">Oração Guiada</h1></div>
                <div className="flex items-center gap-4">
                    <button onClick={() => onExit(true)} className="text-gray-400 hover:text-white transition-colors"><X size={24} /></button>
                </div>
            </header>
            <main className="flex-1 flex flex-col min-h-0" data-guide-id="tool-guided_prayer">
                {renderContent()}
            </main>
        </div>
    );
};

export default GuidedPrayer;
