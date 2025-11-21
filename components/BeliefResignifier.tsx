import React, { useEffect, useState, useCallback, useRef } from 'react';
import { X, MessageSquareHeart, Sparkles, Volume2, Download, Loader2 } from 'lucide-react';
import { AgentId, Session } from '../types.ts';
import { useStore } from '../store.ts';
import { generateSpeech } from '../services/geminiTtsService.ts';
import { decode, encodeWAV } from '../utils/audioUtils.ts';
import { getFriendlyErrorMessage } from '../utils/errorUtils.ts';

interface BeliefResignifierProps {
    onExit: (isManual: boolean, result?: any) => void;
}

const BeliefResignifier: React.FC<BeliefResignifierProps> = ({ onExit }) => {
    const { logActivity, lastAgentContext, currentSession, toolStates, setToolState, addToast } = useStore();
    const resignifierState = toolStates.beliefResignifier!;
    const { belief, reframed, state } = resignifierState;

    const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement>(null);

    const updateState = (newState: Partial<typeof resignifierState>) => {
        setToolState('beliefResignifier', { ...resignifierState, ...newState });
    };

    useEffect(() => {
        const session = currentSession as Extract<Session, { type: 'belief_resignifier' }>;
        if (state === 'config' && session?.initialBelief) {
            updateState({ belief: session.initialBelief });
        }
    }, [currentSession, state]);
    
    // Simple mock function. In a real scenario, this would call a Gemini service.
    const handleResignify = () => {
        if (!belief.trim()) return;
        updateState({ state: 'reframing' });
        setAudioUrl(null);

        // Simulate API call
        setTimeout(() => {
            const newReframed = `Em vez de "${belief}", considere a perspectiva: "Eu sou um canal para a abundância fluir. O dinheiro é energia que eu uso para criar valor para mim e para os outros. Minha prosperidade é ilimitada."`;
            updateState({ reframed: newReframed, state: 'result' });
            
            const agentIdForContext = lastAgentContext ?? AgentId.EMOTIONAL_FINANCE;
            logActivity({
                type: 'tool_usage',
                agentId: agentIdForContext,
                data: {
                    toolId: 'belief_resignifier',
                    result: { belief, reframed: newReframed },
                },
            });
        }, 1000);
    };
    
    const handleGenerateAudio = useCallback(async () => {
        if (!reframed || isGeneratingAudio) return;
        setIsGeneratingAudio(true);
        setAudioUrl(null);
        try {
            const audioResult = await generateSpeech(reframed, 'Puck');
            if (audioResult) {
                const pcmBytes = decode(audioResult.data);
                const wavBlob = encodeWAV(pcmBytes, 24000, 1, 16);
                const url = URL.createObjectURL(wavBlob);
                setAudioUrl(url);
            } else {
                throw new Error("A geração de áudio não retornou dados.");
            }
        } catch (err) {
            addToast(getFriendlyErrorMessage(err, "Falha ao gerar o áudio."), 'error');
        } finally {
            setIsGeneratingAudio(false);
        }
    }, [reframed, isGeneratingAudio, addToast]);

    useEffect(() => {
        if (audioUrl && audioRef.current) audioRef.current.play();
        return () => { if (audioUrl) URL.revokeObjectURL(audioUrl); };
    }, [audioUrl]);

    return (
        <div className="h-full w-full glass-pane rounded-2xl flex flex-col p-1 animate-fade-in">
            <header className="flex items-center justify-between p-4 border-b border-gray-700/50">
                <div className="flex items-center gap-3">
                    <MessageSquareHeart className="w-8 h-8 text-pink-400" />
                    <h1 className="text-xl font-bold text-gray-200">Ressignificador de Crenças</h1>
                </div>
                <button onClick={() => onExit(true)} className="text-gray-400 hover:text-white transition-colors"><X size={24} /></button>
            </header>
            <main className="flex-1 flex flex-col items-center justify-center text-center p-4 sm:p-6" data-guide-id="tool-belief_resignifier">
                 <p className="text-lg text-gray-400 mb-6 max-w-2xl">
                    Escreva uma crença limitante que você tem sobre dinheiro. Vamos transformá-la em uma afirmação de poder.
                </p>
                <div className="w-full max-w-xl">
                    <input 
                        type="text"
                        value={belief}
                        onChange={(e) => updateState({ belief: e.target.value })}
                        placeholder="Ex: 'Dinheiro é difícil de ganhar'"
                        className="w-full bg-gray-800/80 border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-pink-500/80 text-lg"
                    />
                    <button onClick={handleResignify} disabled={!belief.trim() || state === 'reframing'} className="mt-4 w-full bg-pink-600 hover:bg-pink-700 disabled:bg-pink-800/50 text-white font-bold py-3 px-8 rounded-full text-lg flex items-center justify-center mx-auto">
                        <Sparkles className="mr-2" />
                        {state === 'reframing' ? 'Ressignificando...' : 'Ressignificar'}
                    </button>
                </div>
                {state === 'result' && reframed && (
                    <div className="mt-10 p-4 sm:p-6 bg-gray-800/50 rounded-lg max-w-2xl animate-fade-in relative" data-readable-content>
                         <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
                            <button onClick={handleGenerateAudio} disabled={isGeneratingAudio} className="p-2 bg-gray-900/70 rounded-full text-white hover:bg-gray-700/90 transition-colors" aria-label="Ouvir afirmação">
                                {isGeneratingAudio ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 size={18} />}
                            </button>
                            {audioUrl && (
                                <a href={audioUrl} download="afirmacao.wav" className="p-2 bg-gray-900/70 rounded-full text-white hover:bg-gray-700/90 transition-colors" aria-label="Baixar áudio">
                                    <Download size={18} />
                                </a>
                            )}
                        </div>
                        <audio ref={audioRef} src={audioUrl || ''} hidden />
                        <p className="text-xl text-pink-300">{reframed}</p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default BeliefResignifier;