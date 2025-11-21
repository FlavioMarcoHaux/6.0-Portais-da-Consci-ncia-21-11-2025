import React, { useState, useCallback, useRef, useEffect } from 'react';
import { analyzeVerbalFrequency, transcribeAudio } from '../services/geminiVerbalFrequencyService.ts';
import { VerbalFrequencyAnalysisResult, ToolId, VerbalFrequencyEntry, AgentId } from '../types.ts';
import { X, Waves, Loader2, Sparkles, Mic, Square, ArrowRight, ChevronDown } from 'lucide-react';
import { useStore } from '../store.ts';
import { getFriendlyErrorMessage } from '../utils/errorUtils.ts';
import { toolMetadata } from '../constants.tsx';

interface VerbalFrequencyAnalysisProps {
    onExit: (isManual: boolean, result?: any) => void;
}

type UIState = 'idle' | 'listening' | 'transcribing' | 'processing' | 'result' | 'error';

const VerbalFrequencyAnalysis: React.FC<VerbalFrequencyAnalysisProps> = ({ onExit }) => {
    const { startSession, toolStates, setToolState, logActivity, lastAgentContext } = useStore();
    
    const vfaState = toolStates.verbalFrequencyAnalysis!;
    const { history, lastResult } = vfaState;
    const agentIdForContext = lastAgentContext ?? AgentId.SELF_KNOWLEDGE;

    const [uiState, setUiState] = useState<UIState>(lastResult ? 'result' : 'idle');
    const [error, setError] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const animationFrameIdRef = useRef<number | null>(null);
    const prevDataRef = useRef<Uint8Array | null>(null);


    const drawVisualizer = useCallback(() => {
        if (!analyserRef.current || !canvasRef.current) return;
        const analyser = analyserRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;
        
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);
        
        const smoothingFactor = 0.8; 
        let smoothedData: Uint8Array;
        if (!prevDataRef.current) {
            smoothedData = dataArray;
        } else {
             smoothedData = new Uint8Array(bufferLength);
             for (let i = 0; i < bufferLength; i++) {
                smoothedData[i] = prevDataRef.current[i] * smoothingFactor + dataArray[i] * (1 - smoothingFactor);
            }
        }
        prevDataRef.current = smoothedData;

        const { width, height } = canvas;
        context.clearRect(0, 0, width, height);
        
        const barWidth = (width / bufferLength) * 5;
        let x = 0;
        
        const gradient = context.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#f472b6'); // pink-400
        gradient.addColorStop(0.5, '#c026d3'); // fuchsia-600
        gradient.addColorStop(1, '#7e22ce'); // purple-700
        
        context.shadowColor = '#c026d3';
        context.shadowBlur = 10;

        for (let i = 0; i < bufferLength; i++) {
            const barHeight = (smoothedData[i] / 255) * height * 1.2;
            context.fillStyle = gradient;
            context.fillRect(x, height - barHeight, barWidth, barHeight);
            x += barWidth + 2;
        }
        animationFrameIdRef.current = requestAnimationFrame(drawVisualizer);
    }, []);

    const cleanupAudio = useCallback(() => {
        if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
        mediaStreamRef.current?.getTracks().forEach(track => track.stop());
        sourceRef.current?.disconnect();
        analyserRef.current?.disconnect();
        audioContextRef.current?.close().catch(()=>{});
        prevDataRef.current = null;
        if (canvasRef.current) canvasRef.current.getContext('2d')?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }, []);

    useEffect(() => () => cleanupAudio(), [cleanupAudio]);

    const handleStartListening = useCallback(async () => {
        setError(null);
        if (uiState === 'listening') return;

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
            analyserRef.current.fftSize = 256;
            sourceRef.current.connect(analyserRef.current);

            animationFrameIdRef.current = requestAnimationFrame(drawVisualizer);
            setUiState('listening');
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

            if (audioBlob.size < 1000) { // Check for a reasonably sized blob
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
                    
                    // Step 1: Transcribe audio
                    setUiState('transcribing');
                    const transcript = await transcribeAudio(audioData);
                    
                    if (!transcript.trim()) {
                        setError("Não foi possível transcrever sua fala. Tente novamente.");
                        setUiState('error');
                        cleanupAudio();
                        return;
                    }

                    // Step 2: Analyze frequency and transcript
                    setUiState('processing');
                    const analysisResult = await analyzeVerbalFrequency(transcript, audioData);
                    
                    const newEntry: VerbalFrequencyEntry = { ...analysisResult, id: `vfa-${Date.now()}`, timestamp: Date.now() };
                    setToolState('verbalFrequencyAnalysis', { history: [newEntry, ...history], lastResult: analysisResult });
                    
                    logActivity({
                        type: 'tool_usage',
                        agentId: agentIdForContext,
                        data: { toolId: 'verbal_frequency_analysis', result: { result: analysisResult } },
                    });
                    setUiState('result');
                };
                 reader.onerror = () => {
                    setError("Erro ao ler o arquivo de áudio.");
                    setUiState('error');
                };
            } catch (err) {
                setError(getFriendlyErrorMessage(err, 'Erro na análise.'));
                setUiState('error');
            } finally {
                cleanupAudio();
            }
        };
        mediaRecorderRef.current.stop();
    }, [cleanupAudio, history, setToolState, logActivity, agentIdForContext]);

    const handleReset = () => {
        setUiState('idle');
        setToolState('verbalFrequencyAnalysis', { ...vfaState, lastResult: null });
        setError(null);
    };

    const formatDate = (timestamp: number) => new Date(timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const renderContent = () => {
        switch (uiState) {
            case 'idle':
                return (
                    <div className="flex flex-col items-center justify-start h-full w-full text-center p-4 animate-fade-in">
                         <p className="text-lg text-gray-300 max-w-md mb-4">Pressione o microfone para começar a falar. Desabafe sobre o que está em sua mente e coração.</p>
                        <p className="text-sm text-gray-500 mb-8">Ao terminar, analisaremos a frequência emocional da sua voz.</p>
                        <button onClick={handleStartListening} className="w-24 h-24 bg-purple-600 rounded-full flex items-center justify-center hover:bg-purple-700 transition-all shadow-lg hover:scale-105" aria-label="Começar a gravar"><Mic size={48} className="text-white" /></button>
                        {history.length > 0 && (
                             <div className="mt-12 pt-8 border-t border-gray-700/50 w-full max-w-2xl">
                                <h2 className="text-2xl font-bold text-center mb-6 text-gray-100">Histórico de Análises</h2>
                                <div className="space-y-4">
                                    {history.map(item => {
                                        const recommendedToolName = item.acao_pac_recomendada;
                                        const recommendedToolEntry = Object.entries(toolMetadata).find(([_, meta]) => meta.title === recommendedToolName);
                                        const recommendedToolId = recommendedToolEntry ? (recommendedToolEntry[0] as ToolId) : null;
                                        return (
                                            <div key={item.id} className="bg-gray-800/50 rounded-lg">
                                                <button onClick={() => setExpandedId(prev => prev === item.id ? null : item.id)} className="w-full flex justify-between items-center p-4 text-left">
                                                    <div className="flex items-center gap-4">
                                                        <div className="text-2xl font-bold text-purple-400">{item.coerencia_score}<span className="text-sm text-gray-500">/10</span></div>
                                                        <div>
                                                            <p className="font-semibold text-gray-200">{item.frequencia_detectada}</p>
                                                            <p className="text-xs text-gray-500">{formatDate(item.timestamp)}</p>
                                                        </div>
                                                    </div>
                                                    <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${expandedId === item.id ? 'rotate-180' : ''}`} />
                                                </button>
                                                {expandedId === item.id && (
                                                    <div className="p-4 border-t border-gray-700/50 animate-fade-in text-left space-y-4">
                                                        <div className="bg-gray-900/50 p-3 rounded-lg">
                                                            <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Insight Imediato</h4>
                                                            <p className="text-gray-200 mt-1">{item.insight_imediato}</p>
                                                        </div>
                                                         {recommendedToolId ? (
                                                            <button onClick={() => startSession({ type: recommendedToolId })} className="w-full bg-purple-900/50 border border-purple-700 p-4 rounded-lg text-left hover:bg-purple-800/60 transition-colors group">
                                                                <h4 className="text-sm font-semibold text-purple-300 uppercase tracking-wider flex items-center gap-2"><Sparkles size={16}/> Ação Recomendada</h4>
                                                                <div className="flex justify-between items-center mt-1"><p className="text-purple-200">Iniciar: <span className="font-bold">{item.acao_pac_recomendada}</span></p><ArrowRight className="w-5 h-5 text-purple-400 group-hover:translate-x-1 transition-transform" /></div>
                                                            </button>
                                                        ) : (
                                                            <div className="bg-purple-900/50 border border-purple-700 p-4 rounded-lg">
                                                                <h4 className="text-sm font-semibold text-purple-300 uppercase tracking-wider flex items-center gap-2"><Sparkles size={16}/> Ação Recomendada</h4>
                                                                <p className="text-purple-200 mt-1">Sugerimos a ferramenta: <span className="font-bold">{item.acao_pac_recomendada}</span></p>
                                                            </div>
                                                        )}
                                                         <p className="text-gray-500 italic text-center text-sm p-2">"{item.mensagem_guia}"</p>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                         )}
                    </div>
                );
            case 'listening':
                return (
                    <div className="flex flex-col items-center justify-between h-full text-center p-6 animate-fade-in">
                        <div className="flex items-center gap-2 text-red-400 animate-pulse"><Mic size={24} /><span className="font-semibold text-lg">Gravando...</span></div>
                        <canvas ref={canvasRef} width="500" height="200" className="w-full max-w-lg h-auto" />
                        <button onClick={handleStopAndAnalyze} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-full text-lg flex items-center gap-2"><Square size={20} /> Parar e Analisar</button>
                    </div>
                );
            case 'transcribing':
            case 'processing':
                return (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <Loader2 className="w-12 h-12 animate-spin text-purple-400" />
                        <p className="text-gray-300 mt-4">{uiState === 'transcribing' ? 'Transcrevendo seu áudio...' : 'Analisando a frequência da sua conversa...'}</p>
                    </div>
                );
            case 'result':
                const result = lastResult;
                if (!result) return null;
                const recommendedToolName = result.acao_pac_recomendada;
                const recommendedToolEntry = Object.entries(toolMetadata).find(([_, meta]) => meta.title === recommendedToolName);
                const recommendedToolId = recommendedToolEntry ? (recommendedToolEntry[0] as ToolId) : null;
                return (
                    <div className="animate-fade-in w-full max-w-2xl mx-auto space-y-6 text-center">
                        <div className="relative w-48 h-48 mx-auto flex items-center justify-center">
                            <svg className="w-full h-full" viewBox="0 0 36 36"><path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#374151" strokeWidth="2" /><path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeDasharray={`${result.coerencia_score * 10}, 100`} /></svg>
                            <div className="absolute"><span className="text-5xl font-bold text-purple-400">{result.coerencia_score}</span><span className="text-gray-400"> / 10</span></div>
                        </div>
                        <h2 className="text-3xl font-bold text-gray-100">Frequência Detectada: {result.frequencia_detectada}</h2>
                        <div className="bg-gray-800/50 p-6 rounded-lg"><h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Insight Imediato</h3><p className="text-lg text-gray-200 mt-2">{result.insight_imediato}</p></div>
                        {recommendedToolId ? (
                            <button onClick={() => startSession({ type: recommendedToolId })} className="w-full bg-purple-900/50 border border-purple-700 p-6 rounded-lg text-left hover:bg-purple-800/60 transition-colors group">
                                <h3 className="text-sm font-semibold text-purple-300 uppercase tracking-wider flex items-center gap-2"><Sparkles size={16}/> Ação de Coerência Recomendada (PAC)</h3>
                                <div className="flex justify-between items-center mt-2"><p className="text-lg text-purple-200">Iniciar: <span className="font-bold">{result.acao_pac_recomendada}</span></p><ArrowRight className="w-6 h-6 text-purple-400 group-hover:translate-x-1 transition-transform" /></div>
                            </button>
                        ) : (
                             <div className="bg-purple-900/50 border border-purple-700 p-6 rounded-lg"><h3 className="text-sm font-semibold text-purple-300 uppercase tracking-wider flex items-center justify-center gap-2"><Sparkles size={16}/> Ação de Coerência Recomendada (PAC)</h3><p className="text-lg text-purple-200 mt-2">Para elevar sua coerência, sugerimos a ferramenta: <span className="font-bold">{result.acao_pac_recomendada}</span></p></div>
                        )}
                        <p className="text-gray-400 italic">"{result.mensagem_guia}"</p>
                        <button onClick={handleReset} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-full text-lg">Analisar Novamente</button>
                    </div>
                );
            case 'error':
                 return (
                    <div className="flex flex-col items-center justify-center h-full text-center p-4">
                        <h2 className="text-2xl text-red-400 mb-4">Ocorreu um Erro</h2>
                        <p className="text-gray-300 mb-6 max-w-md">{error}</p>
                        <button onClick={handleReset} className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-full">Tentar Novamente</button>
                    </div>
                );
        }
    };
    
    return (
        <div className="h-full w-full glass-pane rounded-2xl flex flex-col p-1 animate-fade-in">
            <header className="flex items-center justify-between p-4 border-b border-gray-700/50">
                <div className="flex items-center gap-3"><Waves className="w-8 h-8 text-purple-400" /><h1 className="text-xl font-bold text-gray-200">Análise de Frequência Verbal</h1></div>
                 <button onClick={() => onExit(true)} className="text-gray-400 hover:text-white transition-colors" aria-label="Exit Verbal Frequency Analysis"><X size={24} /></button>
            </header>
            <main className="flex-1 overflow-y-auto p-6 flex flex-col items-center" data-guide-id="tool-verbal_frequency_analysis">
                {renderContent()}
            </main>
        </div>
    );
};

export default VerbalFrequencyAnalysis;