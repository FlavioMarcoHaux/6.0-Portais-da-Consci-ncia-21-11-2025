// components/ArchetypeJourney.tsx
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { analyzeNarrative } from '../services/geminiArchetypeService.ts';
import { transcribeAudio } from '../services/geminiVerbalFrequencyService.ts';
import { AgentId, ArchetypeAnalysisResult, ArchetypeJourneyEntry, Session, ToolId } from '../types.ts';
import { X, Map, Loader2, Send, Sparkles, Mic, RefreshCw, Volume2, Download, Square, ChevronDown } from 'lucide-react';
import { useStore } from '../store.ts';
import { getFriendlyErrorMessage } from '../utils/errorUtils.ts';
import { generateSpeech } from '../services/geminiTtsService.ts';
import { decode, encodeWAV } from '../utils/audioUtils.ts';

interface ArchetypeJourneyProps {
    onExit: (isManual: boolean, result?: any) => void;
}

type UIState = 'idle' | 'recording' | 'transcribing' | 'analyzing' | 'result' | 'error';

const OracleCard: React.FC<{
    title: string;
    archetype: string;
    text: string;
    isFlipped: boolean;
    action?: { toolId: ToolId, payload: string, buttonText: string };
    onActionClick?: (session: Session) => void;
}> = ({ title, archetype, text, isFlipped, action, onActionClick }) => {
    
    const handleAction = () => {
        if (!action || !onActionClick) return;
        let sessionConfig: Session;
        switch (action.toolId) {
            case 'meditation':
                sessionConfig = { type: 'meditation', initialPrompt: action.payload };
                break;
            case 'guided_prayer':
                sessionConfig = { type: 'guided_prayer', initialTheme: action.payload };
                break;
            case 'therapeutic_journal':
                 sessionConfig = { type: 'therapeutic_journal', initialEntry: action.payload };
                break;
            default:
                sessionConfig = { type: action.toolId as any };
        }
        onActionClick(sessionConfig);
    }
    
    return (
        <div className="w-full h-64 [perspective:1000px]">
            <div 
                className="relative w-full h-full [transform-style:preserve-3d] transition-transform duration-700 ease-in-out"
                style={{ transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
            >
                {/* Card Back */}
                <div className="absolute w-full h-full [backface-visibility:hidden] bg-gray-800/50 border border-purple-500/30 rounded-lg flex items-center justify-center">
                    <Sparkles className="w-12 h-12 text-purple-400 opacity-50" />
                </div>
                
                {/* Card Front */}
                <div className="absolute w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)] bg-gray-800/80 border border-purple-500/50 rounded-lg p-4 flex flex-col">
                    <h3 className="font-bold text-sm text-purple-300 uppercase tracking-wider">{title}</h3>
                    <h4 className="font-semibold text-lg text-gray-100">{archetype}</h4>
                    <p className="text-sm text-gray-400 mt-2 flex-1 overflow-y-auto no-scrollbar">{text}</p>
                    {action && onActionClick && (
                        <button onClick={handleAction} className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-full text-sm">
                            {action.buttonText}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};


const ArchetypeJourney: React.FC<ArchetypeJourneyProps> = ({ onExit }) => {
    const { logActivity, lastAgentContext, toolStates, setToolState, addToast, coherenceVector, startSession } = useStore();
    const journeyState = toolStates.archetypeJourney!;
    const { history, lastResult, lastNarrative } = journeyState;
    const agentIdForContext = lastAgentContext ?? AgentId.SELF_KNOWLEDGE;

    const [uiState, setUiState] = useState<UIState>(lastResult ? 'result' : 'idle');
    const [error, setError] = useState<string | null>(null);
    const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [flippedCards, setFlippedCards] = useState([false, false, false]);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const animationFrameIdRef = useRef<number | null>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    
    useEffect(() => {
        if (uiState === 'result') {
            setFlippedCards([false, false, false]);
            const timer1 = setTimeout(() => setFlippedCards(prev => [true, prev[1], prev[2]]), 300);
            const timer2 = setTimeout(() => setFlippedCards(prev => [prev[0], true, prev[2]]), 900);
            const timer3 = setTimeout(() => setFlippedCards(prev => [prev[0], prev[1], true]), 1500);
            return () => {
                clearTimeout(timer1);
                clearTimeout(timer2);
                clearTimeout(timer3);
            };
        }
    }, [uiState]);

    const drawVisualizer = useCallback(() => {
        if (!analyserRef.current || !canvasRef.current) return;
        const analyser = analyserRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;
        
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteTimeDomainData(dataArray);

        const { width, height } = canvas;
        context.clearRect(0, 0, width, height);
        
        context.lineWidth = 2;
        context.strokeStyle = 'rgb(192, 132, 252)'; // purple-400
        context.beginPath();

        const sliceWidth = width * 1.0 / bufferLength;
        let x = 0;

        for(let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * height/2;

            if(i === 0) {
                context.moveTo(x, y);
            } else {
                context.lineTo(x, y);
            }
            x += sliceWidth;
        }
        context.lineTo(canvas.width, canvas.height/2);
        context.stroke();
        
        animationFrameIdRef.current = requestAnimationFrame(drawVisualizer);
    }, []);

    const cleanupAudio = useCallback(() => {
        if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
        mediaStreamRef.current?.getTracks().forEach(track => track.stop());
        sourceRef.current?.disconnect();
        analyserRef.current?.disconnect();
        audioContextRef.current?.close().catch(()=>{});
        if (canvasRef.current) canvasRef.current.getContext('2d')?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }, []);
    
    useEffect(() => () => cleanupAudio(), [cleanupAudio]);

    const handleStartRecording = useCallback(async () => {
        setError(null);
        if (uiState === 'recording') return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;
            
            recordedChunksRef.current = [];
            mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) recordedChunksRef.current.push(event.data);
            };
            
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 2048;
            sourceRef.current.connect(analyserRef.current);

            animationFrameIdRef.current = requestAnimationFrame(drawVisualizer);
            setUiState('recording');
            mediaRecorderRef.current.start();
        } catch (err) {
            setError(getFriendlyErrorMessage(err, 'Erro ao acessar o microfone.'));
            setUiState('error');
        }
    }, [drawVisualizer, uiState]);

    const handleStopAndAnalyze = useCallback(async () => {
        if (mediaRecorderRef.current?.state !== 'recording') {
            cleanupAudio();
            return;
        };
        
        mediaRecorderRef.current.onstop = async () => {
            const audioBlob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
            recordedChunksRef.current = [];

            if (audioBlob.size < 1000) {
                cleanupAudio();
                setError("Nenhum áudio foi gravado. Por favor, tente falar algo.");
                setUiState('error');
                return;
            }

            try {
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = async () => {
                    const base64Audio = (reader.result as string).split(',')[1];
                    if (!base64Audio) {
                        setError("Falha ao processar o áudio gravado.");
                        setUiState('error');
                        cleanupAudio();
                        return;
                    }
                    
                    const audioData = { data: base64Audio, mimeType: audioBlob.type };
                    
                    setUiState('transcribing');
                    const narrative = await transcribeAudio(audioData);
                    
                    if (!narrative.trim()) {
                        setError("Não foi possível transcrever sua fala. Tente novamente.");
                        setUiState('error');
                        cleanupAudio();
                        return;
                    }

                    setUiState('analyzing');
                    const analysisResult = await analyzeNarrative(narrative, coherenceVector);
                    
                    const newEntry: ArchetypeJourneyEntry = { id: `aj-${Date.now()}`, narrative, result: analysisResult, timestamp: Date.now() };
                    setToolState('archetypeJourney', { history: [newEntry, ...history], lastResult: analysisResult, lastNarrative: narrative, error: null });
                    
                    logActivity({
                        type: 'tool_usage',
                        agentId: agentIdForContext,
                        data: { toolId: 'archetype_journey', result: newEntry },
                    });
                    setUiState('result');
                };
            } catch (err) {
                setError(getFriendlyErrorMessage(err, 'Erro na análise.'));
                setUiState('error');
            } finally {
                cleanupAudio();
            }
        };
        mediaRecorderRef.current.stop();
    }, [cleanupAudio, history, setToolState, logActivity, agentIdForContext, coherenceVector]);

    const handleGenerateAudio = useCallback(async (feedback: ArchetypeAnalysisResult) => {
        if (!feedback || isGeneratingAudio) return;
        const fullText = `Seu Desafio: ${feedback.lente.title}. ${feedback.lente.text}. Sua Jornada: ${feedback.jornada.title}. ${feedback.jornada.text}. Seu Potencial: ${feedback.potencial.title}. ${feedback.potencial.text}. O próximo passo é: ${feedback.acao.buttonText}.`;
        setIsGeneratingAudio(true);
        setAudioUrl(null);
        try {
            const audioResult = await generateSpeech(fullText, 'Zephyr');
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
    }, [isGeneratingAudio, addToast]);

    useEffect(() => {
        if (audioUrl && audioRef.current) audioRef.current.play();
        return () => { if (audioUrl) URL.revokeObjectURL(audioUrl); };
    }, [audioUrl]);
    
    const handleReset = () => {
        setUiState('idle');
        setToolState('archetypeJourney', { ...journeyState, lastResult: null, lastNarrative: null, error: null });
        setError(null);
    };
    
    const formatDate = (timestamp: number) => new Date(timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    return (
        <div className="h-full w-full glass-pane rounded-2xl flex flex-col p-1 animate-fade-in">
            <header className="flex items-center justify-between p-4 border-b border-gray-700/50">
                <div className="flex items-center gap-3">
                    <Map className="w-8 h-8 text-purple-400" />
                    <h1 className="text-xl font-bold text-gray-200">Oráculo dos Arquétipos</h1>
                </div>
                <button onClick={() => onExit(true)} className="text-gray-400 hover:text-white transition-colors" aria-label="Exit Archetype Journey"><X size={24} /></button>
            </header>
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 no-scrollbar" data-guide-id="tool-archetype_journey">
                 <div className="max-w-4xl mx-auto">
                    {(uiState === 'idle' || uiState === 'error') && (
                        <div className="text-center">
                            <p className="text-lg text-gray-400 mb-6">Descreva por voz um desafio ou uma situação atual. O Oráculo irá revelar a jornada mítica por trás da sua experiência.</p>
                             <button onClick={handleStartRecording} className="w-24 h-24 bg-purple-600 rounded-full flex items-center justify-center hover:bg-purple-700 transition-all shadow-lg hover:scale-105" aria-label="Começar a gravar"><Mic size={48} className="text-white" /></button>
                             {uiState === 'error' && <p className="text-red-400 mt-4">{error}</p>}
                        </div>
                    )}

                    {uiState === 'recording' && (
                        <div className="flex flex-col items-center justify-between h-full text-center p-6 animate-fade-in">
                            <div className="flex items-center gap-2 text-red-400 animate-pulse"><Mic size={24} /><span className="font-semibold text-lg">Gravando sua narrativa...</span></div>
                            <canvas ref={canvasRef} width="500" height="150" className="w-full max-w-lg h-auto my-4" />
                            <p className="text-gray-400 flex-1">Fale livremente sobre seu desafio.</p>
                            <button onClick={handleStopAndAnalyze} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-full text-lg flex items-center gap-2"><Square size={20} /> Parar e Revelar</button>
                        </div>
                    )}
                    
                    {(uiState === 'transcribing' || uiState === 'analyzing') && (
                         <div className="flex flex-col items-center justify-center h-64">
                            <Loader2 className="w-12 h-12 animate-spin text-purple-400" />
                            <p className="text-gray-300 mt-4">{uiState === 'transcribing' ? 'Transcrevendo sua jornada...' : 'Consultando o Oráculo...'}</p>
                        </div>
                    )}

                    {uiState === 'result' && lastResult && lastNarrative && (
                         <div className="animate-fade-in max-w-4xl mx-auto relative" data-readable-content>
                            <h2 className="text-2xl font-bold text-center mb-6 text-gray-100 flex items-center justify-center gap-3">
                                Sua Leitura Arquetípica
                                <button onClick={() => handleGenerateAudio(lastResult)} disabled={isGeneratingAudio} className="p-2 bg-gray-800/70 rounded-full text-white hover:bg-gray-700/90 transition-colors" aria-label="Ouvir análise">
                                    {isGeneratingAudio ? <Loader2 className="w-5 h-5 animate-spin" /> : <Volume2 size={20} />}
                                </button>
                                {audioUrl && (
                                    <a href={audioUrl} download="jornada.wav" className="p-2 bg-gray-800/70 rounded-full text-white hover:bg-gray-700/90 transition-colors" aria-label="Baixar áudio">
                                        <Download size={20} />
                                    </a>
                                )}
                            </h2>
                            <audio ref={audioRef} src={audioUrl || ''} hidden />

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <OracleCard title="O Desafio" archetype={lastResult.lente.title} text={lastResult.lente.text} isFlipped={flippedCards[0]} />
                                <OracleCard title="A Jornada" archetype={lastResult.jornada.title} text={lastResult.jornada.text} isFlipped={flippedCards[1]} />
                                <OracleCard title="O Potencial" archetype={lastResult.potencial.title} text={lastResult.potencial.text} isFlipped={flippedCards[2]} action={lastResult.acao} onActionClick={startSession} />
                            </div>

                            <div className="bg-gray-800/50 p-4 rounded-lg text-left mt-6">
                                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Sua Narrativa</h3>
                                <p className="text-gray-300 italic">"{lastNarrative}"</p>
                            </div>

                            <div className="text-center mt-6 flex items-center justify-center gap-4">
                                <button onClick={handleReset} className="text-purple-400 font-semibold py-2 px-6 flex items-center gap-2"><RefreshCw size={16} /> Nova Leitura</button>
                                 <button onClick={() => onExit(false)} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-full">Concluir</button>
                            </div>
                        </div>
                    )}
                    
                    {history.length > 0 && (
                        <div className="mt-12 pt-8 border-t border-gray-700/50">
                            <h2 className="text-2xl font-bold text-center mb-6 text-gray-100">Histórico de Jornadas</h2>
                             <div className="space-y-4">
                                {history.map(item => (
                                    <div key={item.id} className="bg-gray-800/50 rounded-lg">
                                        <button 
                                            onClick={() => setExpandedId(prev => prev === item.id ? null : item.id)}
                                            className="w-full flex justify-between items-center p-4 text-left"
                                        >
                                            <div>
                                                <p className="font-semibold text-gray-300">{item.result.lente.title}</p>
                                                <p className="text-xs text-gray-500">{formatDate(item.timestamp)}</p>
                                            </div>
                                            <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${expandedId === item.id ? 'rotate-180' : ''}`} />
                                        </button>
                                        {expandedId === item.id && (
                                            <div className="p-4 border-t border-gray-700/50 animate-fade-in space-y-3" data-readable-content>
                                                <div className="p-3 bg-gray-900/50 rounded-lg"><h4 className="font-semibold text-gray-400">Sua Narrativa:</h4><p className="whitespace-pre-wrap text-gray-300 italic">"{item.narrative}"</p></div>
                                                <div className="p-3 bg-gray-900/50 rounded-lg"><h4 className="font-semibold text-gray-400">A Jornada (Transição):</h4><p>{item.result.jornada.text}</p></div>
                                                <div className="p-3 bg-gray-900/50 rounded-lg"><h4 className="font-semibold text-gray-400">O Potencial (Ressonância):</h4><p>{item.result.potencial.text}</p></div>
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

export default ArchetypeJourney;