


import React, { useState, useEffect, useCallback, useRef } from 'react';
import { analyzeJournalEntry } from '../services/geminiJournalService.ts';
import { JournalEntry, AgentId, Session, JournalFeedback } from '../types.ts';
import { X, BookHeart, Loader2, Send, ChevronDown, Mic, Volume2, Download } from 'lucide-react';
import { useStore } from '../store.ts';
import { getFriendlyErrorMessage } from '../utils/errorUtils.ts';
import { useWebSpeech } from '../hooks/useWebSpeech.ts';
import { generateSpeech } from '../services/geminiTtsService.ts';
import { decode, encodeWAV } from '../utils/audioUtils.ts';

const FeedbackDisplay: React.FC<{ feedback: JournalFeedback }> = ({ feedback }) => {
    const { addToast } = useStore();
    const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement>(null);

    const handleGenerateAudio = useCallback(async () => {
        if (!feedback || isGeneratingAudio) return;
        const fullText = `Observação: ${feedback.observacao}. Dissonância: ${feedback.dissonancia}. Sugestão: ${feedback.sugestao}`;
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
    }, [feedback, isGeneratingAudio, addToast]);

    useEffect(() => {
        if (audioUrl && audioRef.current) audioRef.current.play();
        return () => { if (audioUrl) URL.revokeObjectURL(audioUrl); };
    }, [audioUrl]);

    return (
        <div className="relative" data-readable-content>
            <div className="absolute top-0 right-0 z-10 flex items-center gap-2">
                <button onClick={handleGenerateAudio} disabled={isGeneratingAudio} className="p-2 bg-gray-900/70 rounded-full text-white hover:bg-gray-700/90 transition-colors" aria-label="Ouvir feedback">
                    {isGeneratingAudio ? <Loader2 className="w-5 h-5 animate-spin" /> : <Volume2 size={20} />}
                </button>
                {audioUrl && (
                    <a href={audioUrl} download="feedback.wav" className="p-2 bg-gray-900/70 rounded-full text-white hover:bg-gray-700/90 transition-colors" aria-label="Baixar áudio">
                        <Download size={20} />
                    </a>
                )}
            </div>
             <audio ref={audioRef} src={audioUrl || ''} hidden />

            <div className="space-y-4">
                <div className="p-4 bg-gray-800 rounded-lg">
                    <h3 className="font-semibold text-lg text-gray-300">Observação do Coração:</h3>
                    <p className="text-gray-400 mt-1">{feedback.observacao}</p>
                </div>
                <div className="p-4 bg-gray-800 rounded-lg">
                    <h3 className="font-semibold text-lg text-gray-300">O Ponto de Dissonância:</h3>
                    <p className="text-gray-400 mt-1">{feedback.dissonancia}</p>
                </div>
                 <div className="p-4 bg-indigo-900/50 border border-indigo-700 rounded-lg">
                    <h3 className="font-semibold text-lg text-indigo-300">Sugestão para Reflexão:</h3>
                    <p className="text-indigo-200 mt-1">{feedback.sugestao}</p>
                </div>
            </div>
        </div>
    );
};


interface TherapeuticJournalProps {
    onExit: (isManual: boolean, result?: any) => void;
}

const TherapeuticJournal: React.FC<TherapeuticJournalProps> = ({ onExit }) => {
    const { toolStates, setToolState, logActivity, lastAgentContext, currentSession } = useStore();
    const [isLoading, setIsLoading] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    
    const journalState = toolStates.therapeuticJournal;
    const entry = journalState?.currentEntry || '';
    const feedback = journalState?.currentFeedback || null;
    const history = journalState?.history || [];
    const error = journalState?.error || null;
    const agentIdForContext = lastAgentContext ?? AgentId.COHERENCE;

    const {
        transcript,
        isListening,
        startListening,
        stopListening,
        error: speechError,
    } = useWebSpeech();
    
    // Store base text to append transcript
    const [baseEntry, setBaseEntry] = useState('');

    const setJournalEntry = (newEntry: string) => {
        setToolState('therapeuticJournal', { ...journalState!, currentEntry: newEntry });
    };

    useEffect(() => {
        const session = currentSession as Extract<Session, { type: 'therapeutic_journal' }>;
        if (session?.initialEntry) {
            setJournalEntry(session.initialEntry);
        }
    }, [currentSession]);

    useEffect(() => {
        if (isListening) {
            setJournalEntry(baseEntry + (baseEntry ? ' ' : '') + transcript);
        }
    }, [transcript, isListening, baseEntry]);

    const handleAnalyze = async () => {
        if (!entry.trim()) return;
        setIsLoading(true);
        // Clear previous feedback and error for the current entry
        setToolState('therapeuticJournal', { ...journalState!, currentFeedback: null, error: null });

        try {
            const analysisResult = await analyzeJournalEntry(entry);
            const newHistoryEntry: JournalEntry = {
                id: `journal-${Date.now()}`,
                entry: entry,
                feedback: analysisResult,
                timestamp: Date.now(),
            };
            setToolState('therapeuticJournal', {
                ...journalState!,
                currentEntry: '', // Clear entry after saving
                currentFeedback: analysisResult,
                history: [newHistoryEntry, ...history],
                error: null,
            });
            logActivity({
                type: 'tool_usage',
                agentId: agentIdForContext,
                data: {
                    toolId: 'therapeutic_journal',
                    result: { entry: newHistoryEntry },
                },
            });
        } catch (err) {
            const errorMsg = getFriendlyErrorMessage(err, 'Ocorreu um erro desconhecido durante a análise.');
            setToolState('therapeuticJournal', { ...journalState!, currentFeedback: null, error: errorMsg });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleReset = () => {
        setToolState('therapeuticJournal', { 
            ...journalState!, 
            currentEntry: '', 
            currentFeedback: null, 
            error: null 
        });
        setIsLoading(false);
    };
    
    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };
    
    const toggleListening = () => {
        if (isListening) {
            stopListening();
        } else {
            setBaseEntry(entry); // Save current text
            startListening();
        }
    };

    return (
        <div className="h-full w-full glass-pane rounded-2xl flex flex-col p-1 animate-fade-in">
            <header className="flex items-center justify-between p-4 border-b border-gray-700/50">
                <div className="flex items-center gap-3">
                    <BookHeart className="w-8 h-8 text-indigo-400" />
                    <h1 className="text-xl font-bold text-gray-200">Diário Terapêutico</h1>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={() => onExit(true)} className="text-gray-400 hover:text-white transition-colors" aria-label="Exit Therapeutic Journal">
                        <X size={24} />
                    </button>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 no-scrollbar" data-guide-id="tool-therapeutic_journal">
                <div className="max-w-3xl mx-auto">
                    {isLoading && (
                        <div className="flex flex-col items-center justify-center h-full">
                            <Loader2 className="w-12 h-12 animate-spin text-indigo-400" />
                            <p className="text-gray-300 mt-4">Analisando suas reflexões...</p>
                        </div>
                    )}

                    {error && (
                        <div className="text-center text-red-400 p-4">
                            <h3 className="font-bold mb-2">Erro na Análise:</h3>
                            <p>{error}</p>
                            <button onClick={handleAnalyze} className="mt-4 bg-gray-600 text-white font-bold py-2 px-6 rounded-full">
                                Tentar Novamente
                            </button>
                        </div>
                    )}

                    {!isLoading && feedback && (
                        <div className="animate-fade-in">
                            <h2 className="text-2xl font-bold text-center mb-6 text-gray-100">Feedback do seu Mentor</h2>
                            <FeedbackDisplay feedback={feedback} />
                            <div className="text-center mt-6 flex items-center justify-center gap-4">
                                <button onClick={handleReset} className="text-indigo-400 font-semibold py-2 px-6">
                                    Escrever Nova Entrada
                                </button>
                                <button onClick={() => onExit(false, { toolId: 'therapeutic_journal', result: { feedback } })} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-full">
                                    Concluir
                                </button>
                            </div>
                        </div>
                    )}

                    {!isLoading && !feedback && (
                        <div>
                            <p className="text-center text-lg text-gray-400 mb-6">
                                Escreva sobre seu dia, seus sentimentos ou um sonho. Seu mentor oferecerá um insight para aumentar sua coerência.
                            </p>
                            <div className="relative">
                                <textarea
                                    value={entry}
                                    onChange={(e) => setJournalEntry(e.target.value)}
                                    placeholder={isListening ? "Ouvindo..." : "Comece a escrever aqui..."}
                                    className="w-full h-64 bg-gray-800/80 border border-gray-600 rounded-xl p-4 pr-12 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/80 text-lg"
                                />
                                 <button
                                    onClick={toggleListening}
                                    className={`absolute top-3 right-3 p-2 rounded-full transition-colors ${isListening ? 'bg-red-500/20 text-red-500 animate-pulse' : 'text-gray-400 hover:text-white'}`}
                                    aria-label={isListening ? 'Parar ditado' : 'Iniciar ditado'}
                                >
                                    <Mic size={20} />
                                </button>
                            </div>
                             {speechError && <p className="text-center text-red-400 text-xs mt-2">{speechError}</p>}
                            <div className="text-center mt-6">
                                <button
                                    onClick={handleAnalyze}
                                    disabled={!entry.trim()}
                                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800/50 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-full transition-colors text-lg flex items-center justify-center mx-auto"
                                >
                                    <Send size={20} className="mr-2" />
                                    Salvar e Analisar
                                </button>
                            </div>
                        </div>
                    )}

                    {history.length > 0 && (
                        <div className="mt-12 pt-8 border-t border-gray-700/50">
                            <h2 className="text-2xl font-bold text-center mb-6 text-gray-100">Histórico do Diário</h2>
                            <div className="space-y-4">
                                {history.map(item => (
                                    <div key={item.id} className="bg-gray-800/50 rounded-lg">
                                        <button 
                                            onClick={() => setExpandedId(prev => prev === item.id ? null : item.id)}
                                            className="w-full flex justify-between items-center p-4 text-left"
                                        >
                                            <span className="font-semibold text-gray-300">{formatDate(item.timestamp)}</span>
                                            <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${expandedId === item.id ? 'rotate-180' : ''}`} />
                                        </button>
                                        {expandedId === item.id && (
                                            <div className="p-4 border-t border-gray-700/50 animate-fade-in" data-readable-content>
                                                <h3 className="font-semibold text-gray-200 mb-2">Sua Reflexão:</h3>
                                                <p className="whitespace-pre-wrap text-gray-400 mb-6">{item.entry}</p>
                                                <FeedbackDisplay feedback={item.feedback} />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default TherapeuticJournal;