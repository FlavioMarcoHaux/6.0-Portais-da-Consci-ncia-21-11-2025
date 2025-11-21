import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store.ts';
import { CoherenceVector, AgentId, Session } from '../types.ts';
import { generateGuidedPrayer, recommendPrayerTheme } from '../services/geminiPrayerService.ts';
import { renderAudioSession } from '../services/audioEngine.ts';
import { getFriendlyErrorMessage } from '../utils/errorUtils.ts';
import { X, Sparkles, BookOpen, Volume2, Loader2, Download, RefreshCw, Sun, Moon, Brain, Play, Pause } from 'lucide-react';

interface GuidedPrayerProps {
    onExit: (isManual: boolean, result?: any) => void;
}

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
    const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    
    // New State for Options
    const [duration, setDuration] = useState(15);
    const [prayerType, setPrayerType] = useState<'diurna' | 'noturna' | 'terapeutica'>('diurna');
    
    const audioRef = useRef<HTMLAudioElement>(null);
    const wasAutoStarted = useRef(false);

    const suggestions = useMemo(() => getPrayerSuggestions(coherenceVector), [coherenceVector]);

    const handleGenerate = useCallback(async (inputTheme: string) => {
        updateState({ state: 'generating', error: null, blocks: [] });
        try {
            const generatedBlocks = await generateGuidedPrayer(inputTheme, duration, prayerType, chatHistory);
            updateState({ blocks: generatedBlocks, state: 'display' });
        } catch (err) {
            const friendlyError = getFriendlyErrorMessage(err, "Falha ao gerar a oração.");
            updateState({ error: friendlyError, state: 'error' });
        }
    }, [chatHistory, updateState, duration, prayerType]);

    const handleGenerateAudio = useCallback(async () => {
        if (!blocks || blocks.length === 0) return;
        setIsGeneratingAudio(true);
        updateState({ audioDataUrl: null, error: null, progress: 0 });
        try {
            const voiceName = prayerType === 'diurna' ? 'Kore' : (prayerType === 'noturna' ? 'Fenrir' : 'Zephyr');
            
            const url = await renderAudioSession(blocks, voiceName, (p) => {
                updateState({ progress: p });
            });
            
            updateState({ audioDataUrl: url, error: null });
        } catch (err) {
            const friendlyError = getFriendlyErrorMessage(err, "Falha ao renderizar o áudio.");
            updateState({ error: friendlyError });
        } finally {
            setIsGeneratingAudio(false);
        }
    }, [blocks, updateState, prayerType]);

    useEffect(() => {
        const session = currentSession as Extract<Session, { type: 'guided_prayer' }>;
        
        if (session?.replayData) {
            const { theme, blocks, audioDataUrl } = session.replayData;
            updateState({ state: 'display', theme, blocks, audioDataUrl, error: null });
            wasAutoStarted.current = true;
            setIsAutoSuggesting(false);
            return;
        }

        if (state !== 'config') return;

        const recommendAndFetch = async () => {
            if (session?.autoStart && session.initialTheme) {
                wasAutoStarted.current = true;
                updateState({ theme: session.initialTheme });
                handleGenerate(session.initialTheme);
                return;
            }

            if (session?.initialTheme) {
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

    useEffect(() => {
        if (blocks && blocks.length > 0 && wasAutoStarted.current) {
            handleGenerateAudio();
            wasAutoStarted.current = false; 
        }
    }, [blocks, handleGenerateAudio]);

    // Auto-play when audio is ready if it was requested
    useEffect(() => {
        if (audioDataUrl && audioRef.current) {
            // Reset playback state
            setIsPlaying(false);
        }
    }, [audioDataUrl]);


    useEffect(() => {
        const url = audioDataUrl;
        return () => {
            if (url && url.startsWith('blob:')) {
                URL.revokeObjectURL(url);
            }
        };
    }, [audioDataUrl]);

    const handleReset = () => {
        updateState({ state: 'config', theme: '', blocks: [], audioDataUrl: null, error: null, progress: 0 });
        wasAutoStarted.current = false;
        setIsPlaying(false);
    };
    
    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
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
                     <div className="max-w-xl w-full space-y-8">
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
                );
            case 'generating':
                const isLong = duration >= 30;
                return (
                    <div className="flex flex-col items-center text-center max-w-md">
                        <Loader2 className="w-12 h-12 animate-spin text-yellow-400" />
                        <h3 className="text-xl font-bold text-yellow-300 mt-6">Canalizando sua Oração</h3>
                        <p className="mt-4 text-gray-300">O "Arquiteto da Fé" está estruturando uma jornada profunda de {duration} minutos com foco em '{theme}'...</p>
                        {isLong && <p className="text-xs text-gray-500 mt-4 animate-pulse">Sessões longas exigem mais tempo para garantir a densidade do conteúdo. Por favor, aguarde.</p>}
                    </div>
                );
            case 'error':
                 return (
                    <div className="text-center">
                        <h2 className="text-2xl text-red-400 mb-4">Ocorreu um Erro</h2>
                        <p className="text-gray-300 mb-6">{error}</p>
                        <button onClick={handleReset} className="bg-yellow-600 text-black font-bold py-2 px-6 rounded-full">Tentar Novamente</button>
                    </div>
                );
            case 'display':
                return (
                    <div className="animate-fade-in w-full max-w-3xl mx-auto text-center flex flex-col h-full">
                        <h2 className="text-2xl font-bold text-center mb-4 text-yellow-300 flex-shrink-0">Intenção: "{theme}"</h2>

                        {!audioDataUrl && !isGeneratingAudio && blocks.length > 0 && (
                            <div className="mb-4 flex-shrink-0">
                                <button onClick={handleGenerateAudio} className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-full flex items-center justify-center mx-auto transition-colors shadow-lg">
                                    <Volume2 size={20} className="mr-2" />
                                    Produzir Experiência de Áudio ({duration} min)
                                </button>
                            </div>
                        )}
                        {isGeneratingAudio && (
                            <div className="mb-4 w-full max-w-sm mx-auto flex-shrink-0">
                                <div className="flex justify-between items-center text-sm text-gray-400 mb-1">
                                    <span>Mixando áudio (Voz + Música)...</span>
                                    <span>{Math.round(progress || 0)}%</span>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-2.5">
                                    <div className="bg-yellow-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress || 0}%` }}></div>
                                </div>
                            </div>
                        )}

                        {audioDataUrl && (
                            <div className="mb-4 p-4 bg-gray-800/60 rounded-lg animate-fade-in flex flex-col items-center gap-4 flex-shrink-0 border border-yellow-500/20">
                                <audio
                                    ref={audioRef}
                                    src={audioDataUrl}
                                    onEnded={() => setIsPlaying(false)}
                                    className="hidden"
                                />
                                <div className="flex items-center gap-6">
                                     <button onClick={togglePlay} className="w-16 h-16 bg-yellow-500 hover:bg-yellow-400 text-black rounded-full flex items-center justify-center transition-transform hover:scale-105 shadow-lg">
                                        {isPlaying ? <Pause size={32} /> : <Play size={32} className="ml-1" />}
                                     </button>
                                </div>
                                <a 
                                    href={audioDataUrl} 
                                    download={`Oração - ${theme}.wav`}
                                    className="text-sm text-gray-400 hover:text-white flex items-center gap-2 transition-colors"
                                >
                                    <Download size={16} />
                                    Baixar Arquivo de Áudio ({duration}min)
                                </a>
                            </div>
                        )}
                        
                        <div className="bg-gray-900/50 p-6 rounded-lg overflow-y-auto text-left flex-1 min-h-0 border border-gray-800" data-readable-content>
                             {blocks.map((block, i) => (
                                <div key={i} className="mb-6">
                                    <p className="whitespace-pre-wrap text-gray-200 leading-relaxed text-lg font-serif">{block.text}</p>
                                    <div className="text-xs text-gray-600 mt-2 italic flex gap-2">
                                        <span>Mood: {block.instructions.mood}</span>
                                        <span>•</span>
                                        <span>Intensidade: {block.instructions.intensity}</span>
                                        <span>•</span>
                                        <span>Time-Box: {block.targetDuration || 'Auto'}s</span>
                                    </div>
                                </div>
                             ))}
                        </div>
                        
                        <div className="text-center mt-6 flex items-center justify-center gap-4 flex-shrink-0">
                            <button onClick={handleReset} className="text-yellow-400 font-semibold flex items-center gap-2"><RefreshCw size={16} />Nova Oração</button>
                            <button onClick={handleFinishSession} className="bg-yellow-600 text-black font-bold py-2 px-6 rounded-full">
                                Concluir Sessão
                            </button>
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
            <main className="flex-1 overflow-hidden p-4 sm:p-6 flex items-center justify-center" data-guide-id="tool-guided_prayer">
                {renderContent()}
            </main>
        </div>
    );
};

export default GuidedPrayer;