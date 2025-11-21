import React, { useEffect, useCallback, useState, useRef } from 'react';
import { analyzeDissonance } from '../services/geminiDissonanceService.ts';
import { AgentId, Session } from '../types.ts';
import { X, HeartPulse, Loader2, Sparkles, Volume2, Download } from 'lucide-react';
import { useStore } from '../store.ts';
import { getFriendlyErrorMessage } from '../utils/errorUtils.ts';
import { generateSpeech } from '../services/geminiTtsService.ts';
import { decode, encodeWAV } from '../utils/audioUtils.ts';

interface DissonanceAnalyzerProps {
    onExit: (isManual: boolean, result?: any) => void;
}

const DissonanceAnalyzer: React.FC<DissonanceAnalyzerProps> = ({ onExit }) => {
    const { chatHistories, lastAgentContext, setToolState, logActivity, currentSession, toolStates, addToast } = useStore();
    const agentIdForContext = lastAgentContext ?? AgentId.COHERENCE;
    const chatHistory = chatHistories[agentIdForContext] || [];
    
    const analyzerState = toolStates.dissonanceAnalysis!;
    const { result, error, state } = analyzerState;

    const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement>(null);

    const updateState = (newState: Partial<typeof analyzerState>) => {
        setToolState('dissonanceAnalysis', { ...analyzerState, ...newState });
    };

    const handleAnalyze = useCallback(async () => {
        updateState({ state: 'analyzing', error: null, result: null });
        setAudioUrl(null);

        try {
            const analysisResult = await analyzeDissonance(chatHistory);
            updateState({ result: analysisResult, state: 'result' });
            logActivity({
                type: 'tool_usage',
                agentId: agentIdForContext,
                data: {
                    toolId: 'dissonance_analyzer',
                    result: { result: analysisResult },
                },
            });
        } catch (err) {
            const friendlyError = getFriendlyErrorMessage(err, 'Ocorreu um erro desconhecido durante a análise.');
            updateState({ error: friendlyError, state: 'error' });
        }
    }, [chatHistory, updateState, logActivity, agentIdForContext]);
    
    useEffect(() => {
        const session = currentSession as Extract<Session, { type: 'dissonance_analyzer' }>;
        if (session?.autoStart && chatHistory.length > 1 && state === 'idle') {
            handleAnalyze();
        }
    }, [currentSession, handleAnalyze, chatHistory.length, state]);

    const handleGenerateAudio = useCallback(async () => {
        if (!result || isGeneratingAudio) return;
        const fullText = `Tema: ${result.tema}. Padrão: ${result.padrao}. Insight: ${result.insight}`;
        setIsGeneratingAudio(true);
        setAudioUrl(null);
        try {
            const audioResult = await generateSpeech(fullText, 'Kore');
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
    }, [result, isGeneratingAudio, addToast]);
    
    useEffect(() => {
        if (audioUrl && audioRef.current) audioRef.current.play();
        return () => { if (audioUrl) URL.revokeObjectURL(audioUrl); };
    }, [audioUrl]);
    
    const handleReset = () => {
        updateState({ state: 'idle', result: null, error: null });
        setAudioUrl(null);
    };

    return (
        <div className="h-full w-full glass-pane rounded-2xl flex flex-col p-1 animate-fade-in">
            <header className="flex items-center justify-between p-4 border-b border-gray-700/50">
                <div className="flex items-center gap-3">
                    <HeartPulse className="w-8 h-8 text-indigo-400" />
                    <h1 className="text-xl font-bold text-gray-200">Analisador de Dissonância</h1>
                </div>
                <button onClick={() => onExit(true)} className="text-gray-400 hover:text-white transition-colors" aria-label="Exit Dissonance Analyzer"><X size={24} /></button>
            </header>
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col items-center justify-center text-center" data-guide-id="tool-dissonance_analyzer">
                {state === 'analyzing' && (
                    <>
                        <Loader2 className="w-12 h-12 animate-spin text-indigo-400" />
                        <p className="text-gray-300 mt-4">Analisando sua conversa em busca de padrões...</p>
                    </>
                )}

                {state === 'error' && (
                    <div className="text-red-400 p-4">
                        <h3 className="font-bold mb-2">Erro na Análise:</h3>
                        <p>{error}</p>
                        <button onClick={handleAnalyze} className="mt-4 bg-gray-600 text-white font-bold py-2 px-6 rounded-full">Tentar Novamente</button>
                    </div>
                )}
                
                {state === 'idle' && (
                    <div className="max-w-xl">
                        <p className="text-lg text-gray-400 mb-6">Sua conversa com o mentor pode revelar padrões de pensamento e crenças limitantes. Vamos analisá-la.</p>
                        <button onClick={handleAnalyze} disabled={chatHistory.length <= 1} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800/50 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-full text-lg">Analisar Conversa</button>
                        {chatHistory.length <= 1 && <p className="text-xs text-gray-500 mt-2">Converse um pouco com seu mentor antes de analisar.</p>}
                    </div>
                )}

                {state === 'result' && result && (
                    <div className="animate-fade-in w-full max-w-2xl space-y-6 relative" data-readable-content>
                        <div className="absolute top-0 right-0 z-10 flex items-center gap-2">
                            <button onClick={handleGenerateAudio} disabled={isGeneratingAudio} className="p-2 bg-gray-800/70 rounded-full text-white hover:bg-gray-700/90 transition-colors" aria-label="Ouvir análise">
                                {isGeneratingAudio ? <Loader2 className="w-5 h-5 animate-spin" /> : <Volume2 size={20} />}
                            </button>
                            {audioUrl && (
                                <a href={audioUrl} download="analise.wav" className="p-2 bg-gray-800/70 rounded-full text-white hover:bg-gray-700/90 transition-colors" aria-label="Baixar áudio">
                                    <Download size={20} />
                                </a>
                            )}
                        </div>
                        <audio ref={audioRef} src={audioUrl || ''} hidden />

                        <div className="glass-pane p-4 sm:p-6 rounded-lg">
                            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Tema Emocional Central</h3>
                            <p className="text-xl text-gray-100 mt-2">{result.tema}</p>
                        </div>
                        <div className="glass-pane p-4 sm:p-6 rounded-lg">
                            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Padrão de Dissonância</h3>
                            <p className="text-xl text-gray-100 mt-2">{result.padrao}</p>
                        </div>
                        <div className="bg-indigo-900/50 border border-indigo-700 p-4 sm:p-6 rounded-lg">
                            <h3 className="text-sm font-semibold text-indigo-300 uppercase tracking-wider flex items-center gap-2"><Sparkles size={16}/> Insight Terapêutico</h3>
                            <p className="text-lg text-indigo-200 mt-2">{result.insight}</p>
                        </div>
                         <div className="flex items-center justify-center gap-4 pt-4">
                            <button onClick={handleReset} className="text-indigo-400 font-semibold">Analisar Novamente</button>
                            <button onClick={() => onExit(false, { toolId: 'dissonance_analyzer', result })} className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-full">Concluir</button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default DissonanceAnalyzer;