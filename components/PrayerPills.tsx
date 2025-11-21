import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { generatePrayerPill } from '../services/geminiPrayerPillsService.ts';
import { generateSpeech } from '../services/geminiTtsService.ts';
import { useStore } from '../store.ts';
import { CoherenceVector, AgentId, Session } from '../types.ts';
import { decode, encodeWAV } from '../utils/audioUtils.ts';
import { getFriendlyErrorMessage } from '../utils/errorUtils.ts';
import { X, Sparkles, Loader2, Volume2, Download } from 'lucide-react';

interface PrayerPillsProps {
    onExit: (isManual: boolean, result?: any) => void;
}

const getPrayerSuggestions = (vector: CoherenceVector): string[] => {
    const suggestions: { key: keyof Omit<CoherenceVector, 'alinhamentoPAC'>, value: number, themes: string[] }[] = [
        { key: 'proposito', value: vector.proposito.dissonancia, themes: ["Conexão espiritual", "Propósito"] },
        { key: 'emocional', value: vector.emocional.dissonancia, themes: ["Paz interior", "Aliviar ansiedade"] },
        { key: 'somatico', value: vector.somatico.dissonancia, themes: ["Cura e saúde", "Força"] },
        { key: 'recursos', value: vector.recursos.dissonancia, themes: ["Prosperidade", "Gratidão"] },
    ];
    const sortedStates = suggestions.sort((a, b) => b.value - a.value); // Sort by highest dissonance
    const finalSuggestions = new Set<string>();

    sortedStates.slice(0, 2).forEach(state => {
        state.themes.forEach(theme => finalSuggestions.add(theme));
    });

    let i = 2;
    while (finalSuggestions.size < 4 && i < sortedStates.length) {
        sortedStates[i].themes.forEach(theme => finalSuggestions.add(theme));
        i++;
    }

    return Array.from(finalSuggestions).slice(0, 4);
};

const PrayerPills: React.FC<PrayerPillsProps> = ({ onExit }) => {
    const { 
        coherenceVector, 
        chatHistories, 
        lastAgentContext, 
        logActivity, 
        currentSession,
        toolStates,
        setToolState,
    } = useStore();
    
    const prayerPillsState = toolStates.prayerPills!;
    const updateState = (newState: Partial<typeof prayerPillsState>) => {
        setToolState('prayerPills', { ...prayerPillsState, ...newState });
    };
    const { theme, pillText, audioDataUrl, error, state } = prayerPillsState;
    
    const isVoiceOrigin = currentSession?.origin === 'voice';
    const agentIdForContext = isVoiceOrigin ? null : lastAgentContext ?? AgentId.COHERENCE;
    const chatHistory = agentIdForContext ? (chatHistories[agentIdForContext] || []) : [];

    const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
    
    const wasAutoStarted = useRef(false);
    const audioRef = useRef<HTMLAudioElement>(null);

    const suggestions = useMemo(() => getPrayerSuggestions(coherenceVector), [coherenceVector]);

    const handleGenerate = useCallback(async (inputTheme: string) => {
        if (!inputTheme.trim()) return;
        updateState({ theme: inputTheme, state: 'generating', error: null, pillText: '', audioDataUrl: null });
        window.scrollTo(0, 0);
        try {
            const result = await generatePrayerPill(inputTheme, chatHistory);
            updateState({ pillText: result, state: 'display' });
            logActivity({
                type: 'tool_usage',
                agentId: agentIdForContext ?? AgentId.GUIDE,
                data: {
                    toolId: 'prayer_pills',
                    result: { theme: inputTheme, pill: result },
                },
            });
        } catch (err) {
            const friendlyError = getFriendlyErrorMessage(err, "Falha ao gerar a pílula de oração.");
            updateState({ error: friendlyError, state: 'error' });
        }
    }, [chatHistory, agentIdForContext, logActivity, updateState]);

    useEffect(() => {
        const session = currentSession as Extract<Session, { type: 'prayer_pills' }>;
        
        if (state !== 'config') return;

        if (session?.autoStart && session.initialTheme) {
            wasAutoStarted.current = true;
            updateState({ theme: session.initialTheme }); 
            handleGenerate(session.initialTheme);
        } else if (session?.initialTheme) {
            updateState({ theme: session.initialTheme });
        }
    }, [currentSession, handleGenerate, state, updateState]);
    
    const handleGenerateAudio = useCallback(async () => {
        if (!pillText) return;
        setIsGeneratingAudio(true);
        updateState({ audioDataUrl: null, error: null });
        try {
            const result = await generateSpeech(pillText, 'Kore');
            if (result) {
                const pcmBytes = decode(result.data);
                const wavBlob = encodeWAV(pcmBytes, 24000, 1, 16);
                const url = URL.createObjectURL(wavBlob);
                updateState({ audioDataUrl: url, error: null });
            } else {
                throw new Error("A geração de áudio não retornou dados.");
            }
        } catch (err) {
            const friendlyError = getFriendlyErrorMessage(err, "Falha ao gerar áudio.");
            updateState({ error: friendlyError });
        } finally {
            setIsGeneratingAudio(false);
        }
    }, [pillText, updateState]);
    
    useEffect(() => {
        const url = audioDataUrl;
        return () => {
            if (url && url.startsWith('blob:')) {
                URL.revokeObjectURL(url);
            }
        };
    }, [audioDataUrl]);

    useEffect(() => {
        if (pillText && wasAutoStarted.current) {
            handleGenerateAudio();
        }
    }, [pillText, handleGenerateAudio]);

    useEffect(() => {
        if (audioDataUrl && audioRef.current) {
            audioRef.current.play();
        }
    }, [audioDataUrl]);
    
    const handleGenerateRandom = () => {
        const randomTheme = "um tema universal de fé e esperança, escolhido para mim neste momento";
        updateState({ theme: '' });
        handleGenerate(randomTheme);
    };

    const handleReset = () => {
        updateState({ state: 'config', theme: '', pillText: '', audioDataUrl: null, error: null });
        wasAutoStarted.current = false;
    };

    return (
        <div className="h-full w-full glass-pane rounded-2xl flex flex-col p-1 animate-fade-in">
            <header className="flex items-center justify-between p-4 border-b border-gray-700/50">
                <h1 className="text-xl font-bold text-gray-200">Pílulas de Oração</h1>
                <div className="flex items-center gap-4">
                    <button onClick={() => onExit(true)} className="text-gray-400 hover:text-white transition-colors" aria-label="Exit Prayer Pills"><X size={24} /></button>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto p-2 sm:p-6 no-scrollbar" data-guide-id="tool-prayer_pills">
                 <div className="max-w-3xl mx-auto text-center">
                    
                    {state === 'config' && (
                        <>
                            <p className="text-gray-400 mt-2">Receba uma dose rápida de inspiração. Deixe a oração escolher um tema universal para você, ou defina sua própria intenção.</p>
                            <div className="my-6"><button onClick={handleGenerateRandom} className="w-full max-w-sm mx-auto bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-8 rounded-lg transition-colors text-lg">Dose Rápida</button></div>
                            <div className="flex items-center my-6"><div className="flex-grow border-t border-gray-600"></div><span className="flex-shrink mx-4 text-gray-500">ou</span><div className="flex-grow border-t border-gray-600"></div></div>
                            <div className="space-y-4">
                                <label htmlFor="theme-input" className="block text-gray-300">Defina sua intenção:</label>
                                <div className="flex flex-col sm:flex-row items-center gap-3">
                                    <input id="theme-input" type="text" value={theme} onChange={(e) => updateState({ theme: e.target.value })} placeholder="ex: 'força' ou 'gratidão'" className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/80 text-base" />
                                    <button onClick={() => handleGenerate(theme)} disabled={!theme.trim()} className="w-full sm:w-auto bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700/50 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors flex-shrink-0">Gerar Pílula</button>
                                </div>
                            </div>
                            <div className="my-6">
                                <h3 className="text-sm text-gray-400 mb-3">Ou comece com uma sugestão:</h3>
                                <div className="flex flex-wrap items-center justify-center gap-2">
                                    {suggestions.map(suggestion => (<button key={suggestion} onClick={() => handleGenerate(suggestion)} className="px-4 py-2 bg-gray-700/80 border border-gray-600/90 text-gray-300 rounded-full text-sm hover:bg-gray-600/80 hover:border-cyan-500/50 transition-colors"><Sparkles className="inline w-4 h-4 mr-2 text-cyan-500/80" />{suggestion}</button>))}
                                </div>
                            </div>
                        </>
                    )}
                    
                    {error && <p className="text-red-400 mt-4">{error}</p>}
                </div>

                {state === 'generating' && (<div className="text-center my-8"><div className="w-8 h-8 border-4 border-dashed rounded-full animate-spin border-cyan-500 mx-auto"></div><p className="text-gray-400 mt-4">Gerando sua pílula...</p></div>)}

                {state === 'display' && pillText && (
                    <div className="animate-fade-in mt-10 max-w-3xl mx-auto border-t border-gray-700 pt-8">
                        <h2 className="text-2xl font-bold text-center mb-6 text-gray-200">Sua Pílula de Oração</h2>
                        <div className="bg-gray-800/50 p-4 rounded-lg relative" data-readable-content>
                             <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
                                <button onClick={handleGenerateAudio} disabled={isGeneratingAudio} className="p-2 bg-gray-900/70 rounded-full text-white hover:bg-gray-700/90 transition-colors" aria-label="Ouvir pílula">
                                    {isGeneratingAudio ? <Loader2 className="w-5 h-5 animate-spin" /> : <Volume2 size={20} />}
                                </button>
                                {audioDataUrl && (
                                    <a href={audioDataUrl} download="pilula_oracao.wav" className="p-2 bg-gray-900/70 rounded-full text-white hover:bg-gray-700/90 transition-colors" aria-label="Baixar áudio">
                                        <Download size={20} />
                                    </a>
                                )}
                            </div>
                             <audio 
                                ref={audioRef}
                                src={audioDataUrl || ''} 
                                autoPlay={wasAutoStarted.current} 
                                onPlay={() => { wasAutoStarted.current = false; }} 
                                hidden 
                            />
                            <p className="whitespace-pre-wrap text-gray-200 leading-relaxed text-center text-xl">{pillText}</p>
                        </div>
                         <div className="text-center mt-8 flex items-center justify-center gap-4">
                             <button onClick={handleReset} className="text-cyan-400 font-semibold">Gerar Outra</button>
                            <button 
                                onClick={() => onExit(false, { toolId: 'prayer_pills', result: { theme, pill: pillText } })} 
                                className="bg-cyan-600 text-white font-bold py-2 px-6 rounded-full"
                            >
                                Concluir
                            </button>
                        </div>
                    </div>
                )}
                 {state === 'error' && (
                    <div className="text-center mt-8">
                        <button onClick={handleReset} className="bg-gray-600 text-white font-bold py-2 px-6 rounded-full">Tentar Novamente</button>
                    </div>
                 )}
            </main>
        </div>
    );
};

export default PrayerPills;
