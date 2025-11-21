import React, { useState, useEffect, useRef, FormEvent, useCallback } from 'react';
import { X, Stethoscope, Send, Loader2, Volume2, Download } from 'lucide-react';
import { useStore } from '../store.ts';
import { Message } from '../types.ts';
import { generateSpeech } from '../services/geminiTtsService.ts';
import { decode, encodeWAV } from '../utils/audioUtils.ts';
import { getFriendlyErrorMessage } from '../utils/errorUtils.ts';

// Helper to convert simple markdown (bold, lists) to HTML
const markdownToHtml = (text: string) => {
    if (!text) return { __html: '' };
  
    const lines = text.split('\n');
    const newLines = [];
    let inList = false;

    for (const line of lines) {
        let processedLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        if (processedLine.trim().startsWith('* ')) {
            if (!inList) {
                newLines.push('<ul class="chat-ul">');
                inList = true;
            }
            newLines.push(`<li>${processedLine.trim().substring(2)}</li>`);
        } else {
            if (inList) {
                newLines.push('</ul>');
                inList = false;
            }
            newLines.push(processedLine);
        }
    }

    if (inList) {
        newLines.push('</ul>');
    }

    return { __html: newLines.join('\n') };
};

const AudioPlayer: React.FC<{ text: string }> = ({ text }) => {
    const { addToast } = useStore();
    const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement>(null);

    const handleGenerateAudio = useCallback(async () => {
        if (!text || isGeneratingAudio) return;
        setIsGeneratingAudio(true);
        setAudioUrl(null);
        try {
            const audioResult = await generateSpeech(text, 'Fenrir');
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
    }, [text, isGeneratingAudio, addToast]);

    useEffect(() => {
        if (audioUrl && audioRef.current) audioRef.current.play();
        return () => { if (audioUrl) URL.revokeObjectURL(audioUrl); };
    }, [audioUrl]);

    return (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
            <button onClick={handleGenerateAudio} disabled={isGeneratingAudio} className="p-1.5 bg-gray-800/70 rounded-full text-white hover:bg-gray-700/90 transition-colors" aria-label="Ouvir diagnóstico">
                {isGeneratingAudio ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 size={16} />}
            </button>
            {audioUrl && (
                <a href={audioUrl} download="diagnostico.wav" className="p-1.5 bg-gray-800/70 rounded-full text-white hover:bg-gray-700/90 transition-colors" aria-label="Baixar áudio">
                    <Download size={16} />
                </a>
            )}
            <audio ref={audioRef} src={audioUrl || ''} hidden />
        </div>
    );
};


interface DoshaDiagnosisProps {
    onExit: (isManual: boolean, result?: any) => void;
}

const DoshaDiagnosis: React.FC<DoshaDiagnosisProps> = ({ onExit }) => {
    const { toolStates, isLoadingMessage, handleDoshaSendMessage, startSession } = useStore();
    const doshaState = toolStates.doshaDiagnosis;

    const messages = doshaState?.messages || [];
    const isFinished = doshaState?.isFinished || false;
    const error = doshaState?.error || null;
    
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoadingMessage || isFinished) return;
        handleDoshaSendMessage(input.trim());
        setInput('');
    };

    const handleGoToRoutineAligner = () => {
        startSession({ type: 'routine_aligner' });
    };

    return (
        <div className="h-full w-full glass-pane rounded-2xl flex flex-col p-1 animate-fade-in">
            <header className="flex items-center justify-between p-4 border-b border-gray-700/50">
                <div className="flex items-center gap-3">
                    <Stethoscope className="w-8 h-8 text-green-400" />
                    <h1 className="text-xl font-bold text-gray-200">Diagnóstico Informacional</h1>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={() => onExit(true)} className="text-gray-400 hover:text-white transition-colors" aria-label="Exit Dosha Diagnosis">
                        <X size={24} />
                    </button>
                </div>
            </header>
            <main className="flex-1 flex flex-col overflow-hidden relative" data-guide-id="tool-dosh_diagnosis">
                <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar" data-readable-content>
                    {messages.map((message, index) => {
                        const isLastAgentMessage = isFinished && index === messages.length - 1 && message.sender === 'agent';
                        return (
                            <div key={message.id} className={`flex items-start gap-3 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-xl px-4 py-3 rounded-2xl relative ${message.sender === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-gray-700 text-gray-200 rounded-bl-none'}`}>
                                    {isLastAgentMessage && <AudioPlayer text={message.text} />}
                                    <div className="text-sm whitespace-pre-wrap" dangerouslySetInnerHTML={markdownToHtml(message.text)} />
                                </div>
                            </div>
                        );
                    })}
                    {isLoadingMessage && (
                         <div className="flex justify-start">
                            <div className="max-w-xl px-4 py-3 rounded-2xl bg-gray-700 text-gray-200 rounded-bl-none">
                                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                            </div>
                        </div>
                    )}
                    {error && (
                         <div className="flex justify-start">
                             <div className="max-w-xl px-4 py-3 rounded-2xl bg-red-900/50 border border-red-500/50 text-red-300 rounded-bl-none">
                                 <p className="text-sm">{error}</p>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
                
                {isFinished && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-center p-4 animate-fade-in">
                        <div className="relative bg-gray-800/80 border border-gray-700 p-8 rounded-2xl shadow-2xl max-w-md" data-readable-content>
                             <button
                                onClick={() => onExit(true)}
                                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                                aria-label="Fechar pop-up"
                            >
                                <X size={24} />
                            </button>
                             <h3 className="text-2xl font-bold text-gray-100 mb-3">Diagnóstico Concluído!</h3>
                             <p className="text-gray-300 mb-6">Seu padrão de dissonância foi identificado. O próximo passo é criar sua rotina personalizada para restaurar a harmonia.</p>
                            <button 
                                onClick={handleGoToRoutineAligner}
                                className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-full text-lg transition-colors shadow-lg hover:scale-105"
                            >
                                Ir para o Alinhador de Rotina
                            </button>
                        </div>
                    </div>
                )}

                <div className="p-4 border-t border-gray-700/50">
                    <form onSubmit={handleSubmit} className="flex items-center gap-3">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={isFinished ? "Diagnóstico concluído." : "Digite sua resposta..."}
                            disabled={isLoadingMessage || isFinished}
                            className="flex-1 bg-gray-800/80 border border-gray-600 rounded-full px-5 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/80 disabled:opacity-50"
                        />
                        <button
                            type="submit"
                            disabled={isLoadingMessage || isFinished || !input.trim()}
                            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800/50 text-white w-12 h-12 rounded-full flex items-center justify-center transition-colors"
                        >
                            <Send size={20} />
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );
};

export default DoshaDiagnosis;