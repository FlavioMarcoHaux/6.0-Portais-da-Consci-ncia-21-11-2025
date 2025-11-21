import React, { useState, useCallback, useRef, useEffect } from 'react';
import { analyzeVoiceJournal } from '../services/geminiVoiceJournalService.ts';
import { transcribeAudio } from '../services/geminiVerbalFrequencyService.ts';
import { VoiceJournalAnalysisResult, ToolId, VoiceJournalEntry, AgentId } from '../types.ts';
import { X, Mic, Loader2, Sparkles, Square, ArrowRight, ChevronDown, Save, Volume2, Download } from 'lucide-react';
import { useStore } from '../store.ts';
import { getFriendlyErrorMessage } from '../utils/errorUtils.ts';
import { toolMetadata } from '../constants.tsx';
import { generateSpeech } from '../services/geminiTtsService.ts';
import { decode, encodeWAV } from '../utils/audioUtils.ts';

interface VoiceTherapeuticJournalProps {
    onExit: (isManual: boolean, result?: any) => void;
}

type UIState = 'idle' | 'recording' | 'transcribing' | 'processing' | 'result' | 'error';

const VoiceTherapeuticJournal: React.FC<VoiceTherapeuticJournalProps> = ({ onExit }) => {
    const { startSession, toolStates, setToolState, logActivity, lastAgentContext, addToast } = useStore();
    
    const journalState = toolStates.voiceTherapeuticJournal!;
    const { history, lastResult, lastTranscript } = journalState;
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

    const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement>(null);

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
        context.strokeStyle = 'rgb(167, 139, 250)'; // purple-400
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
        }
        
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
                    const transcript = await transcribeAudio(audioData);
                    
                    if (!transcript.trim()) {
                        setError("Não foi possível transcrever sua fala. Tente novamente.");
                        setUiState('error');
                        cleanupAudio();
                        return;
                    }

                    setUiState('processing');
                    const analysisResult = await analyzeVoiceJournal(transcript, audioData);
                    
                    const newEntry: VoiceJournalEntry = { ...analysisResult, id: `vj-${Date.now()}`, timestamp: Date.now(), transcript: transcript };
                    setToolState('voiceTherapeuticJournal', { history: [newEntry, ...history], lastResult: analysisResult, lastTranscript: transcript, error: null });
                    
                    logActivity({
                        type: 'tool_usage',
                        agentId: agentIdForContext,
                        data: { toolId: 'voice_therapeutic_journal', result: { result: analysisResult } },
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

    const handleGenerateAudio = useCallback(async () => {
        if (!lastResult || isGeneratingAudio) return;
        const { verbalFrequency, journalFeedback, synthesis } = lastResult;
        const fullText = `
            Análise da sua voz: Frequência detectada de ${verbalFrequency.frequencia_detectada}. Sua coerência foi de ${verbalFrequency.coerencia_score} de 10. ${verbalFrequency.insight_imediato}.
            Análise do conteúdo: ${journalFeedback.observacao}. O ponto de dissonância foi: ${journalFeedback.dissonancia}. A sugestão é: ${journalFeedback.sugestao}.
            Síntese final: ${synthesis.combined_insight}. A recomendação é: ${synthesis.recommended_next_step.justification}.
        `;
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
    }, [lastResult, isGeneratingAudio, addToast]);

    useEffect(() => {
        if (audioUrl && audioRef.current) {
            audioRef.current.play();
        }
        return () => {
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
            }
        };
    }, [audioUrl]);

    const handleReset = () => {
        setUiState('idle');
        setToolState('voiceTherapeuticJournal', { ...journalState, lastResult: null, lastTranscript: null, error: null });
        setError(null);
    };

    const formatDate = (timestamp: number) => new Date(timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const renderContent = () => {
        switch (uiState) {
            case 'idle':
                return (
                    <div className="flex flex-col items-center justify-start h-full w-full text-center p-4 animate-fade-in">
                         <p className="text-lg text-gray-300 max-w-md mb-4">Pressione o microfone para gravar sua reflexão. Sua voz e suas palavras serão analisadas.</p>
                        <p className="text-sm text-gray-500 mb-8">Ao terminar, você receberá um feedback holístico sobre sua coerência emocional e mental.</p>
                        <button onClick={handleStartRecording} className="w-24 h-24 bg-purple-600 rounded-full flex items-center justify-center hover:bg-purple-700 transition-all shadow-lg hover:scale-105" aria-label="Começar a gravar"><Mic size={48} className="text-white" /></button>
                        {history.length > 0 && (
                             <div className="mt-12 pt-8 border-t border-gray-700/50 w-full max-w-2xl">
                                <h2 className="text-2xl font-bold text-center mb-6 text-gray-100">Histórico de Análises</h2>
                                <div className="space-y-4">
                                    {history.map(item => (
                                        <div key={item.id} className="bg-gray-800/50 rounded-lg">
                                            <button onClick={() => setExpandedId(prev => prev === item.id ? null : item.id)} className="w-full flex justify-between items-center p-4 text-left">
                                                <div className="flex items-center gap-4">
                                                    <div className="text-2xl font-bold text-purple-400">{item.verbalFrequency.coerencia_score}<span className="text-sm text-gray-500">/10</span></div>
                                                    <div>
                                                        <p className="font-semibold text-gray-200">{item.verbalFrequency.frequencia_detectada}</p>
                                                        <p className="text-xs text-gray-500">{formatDate(item.timestamp)}</p>
                                                    </div>
                                                </div>
                                                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${expandedId === item.id ? 'rotate-180' : ''}`} />
                                            </button>
                                            {expandedId === item.id && (
                                                <div className="p-4 border-t border-gray-700/50 animate-fade-in text-left space-y-4">
                                                    {/* Display full result here */}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                         )}
                    </div>
                );
            case 'recording':
                return (
                    <div className="flex flex-col items-center justify-between h-full text-center p-6 animate-fade-in">
                        <div className="flex items-center gap-2 text-red-400 animate-pulse"><Mic size={24} /><span className="font-semibold text-lg">Gravando sua voz...</span></div>
                        <canvas ref={canvasRef} width="500" height="150" className="w-full max-w-lg h-auto my-4" />
                        <p className="text-gray-400 flex-1">Fale livremente. Sua transcrição aparecerá após a análise.</p>
                        <button onClick={handleStopAndAnalyze} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-full text-lg flex items-center gap-2"><Square size={20} /> Parar e Analisar</button>
                    </div>
                );
            case 'transcribing':
            case 'processing':
                return (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <Loader2 className="w-12 h-12 animate-spin text-purple-400" />
                        <p className="text-gray-300 mt-4">{uiState === 'transcribing' ? 'Transcrevendo seu áudio...' : 'Analisando sua voz e alma...'}</p>
                    </div>
                );
            case 'result':
                if (!lastResult || lastTranscript === null) return null;
                const { verbalFrequency, journalFeedback, synthesis } = lastResult;
                return (
                    <div className="animate-fade-in w-full max-w-3xl mx-auto space-y-6 text-center" data-readable-content>
                        <audio ref={audioRef} src={audioUrl || ''} hidden />
                        <h2 className="text-3xl font-bold text-gray-100 relative">
                            Sua Análise Holística
                            <div className="absolute top-0 right-0 z-10 flex items-center gap-2">
                                <button onClick={handleGenerateAudio} disabled={isGeneratingAudio} className="p-2 bg-gray-800/70 rounded-full text-white hover:bg-gray-700/90 transition-colors" aria-label="Ouvir análise">
                                    {isGeneratingAudio ? <Loader2 className="w-5 h-5 animate-spin" /> : <Volume2 size={20} />}
                                </button>
                                {audioUrl && (
                                    <a href={audioUrl} download="analise_diario_voz.wav" className="p-2 bg-gray-800/70 rounded-full text-white hover:bg-gray-700/90 transition-colors" aria-label="Baixar áudio">
                                        <Download size={20} />
                                    </a>
                                )}
                            </div>
                        </h2>
                        {/* Transcript */}
                        <div className="bg-gray-800/50 p-6 rounded-lg text-left">
                            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Sua Transcrição</h3>
                            <p className="text-gray-300 italic">"{lastTranscript}"</p>
                        </div>
                        {/* Verbal Frequency */}
                        <div className="bg-gray-800/50 p-6 rounded-lg text-left">
                            <h3 className="text-sm font-semibold text-purple-300 uppercase tracking-wider mb-2">Frequência da Voz (Como você falou)</h3>
                             <div className="flex items-center gap-4">
                                <div className="text-center">
                                    <p className="text-4xl font-bold text-purple-400">{verbalFrequency.coerencia_score}<span className="text-lg text-gray-500">/10</span></p>
                                    <p className="text-xs text-gray-400">Coerência</p>
                                </div>
                                <div className="flex-1">
                                    <p><strong className="text-gray-300">Frequência Detectada:</strong> {verbalFrequency.frequencia_detectada}</p>
                                    <p><strong className="text-gray-300">Insight da Voz:</strong> {verbalFrequency.insight_imediato}</p>
                                </div>
                            </div>
                        </div>
                        {/* Journal Feedback */}
                         <div className="bg-gray-800/50 p-6 rounded-lg text-left">
                             <h3 className="text-sm font-semibold text-indigo-300 uppercase tracking-wider mb-2">Conteúdo do Diário (O que você falou)</h3>
                             <p><strong className="text-gray-300">Observação:</strong> {journalFeedback.observacao}</p>
                             <p><strong className="text-gray-300">Dissonância:</strong> {journalFeedback.dissonancia}</p>
                             <p><strong className="text-gray-300">Sugestão para Reflexão:</strong> {journalFeedback.sugestao}</p>
                        </div>
                        {/* Synthesis */}
                        <div className="bg-purple-900/50 border border-purple-700 p-6 rounded-lg text-left">
                             <h3 className="text-sm font-semibold text-yellow-300 uppercase tracking-wider flex items-center gap-2 mb-2"><Sparkles size={16}/> Síntese e Próximo Passo</h3>
                             <p className="mb-2"><strong className="text-gray-300">Insight Combinado:</strong> {synthesis.combined_insight}</p>
                             <p><strong className="text-gray-300">Recomendação:</strong> {synthesis.recommended_next_step.justification}</p>
                        </div>
                        <div className="flex items-center justify-center gap-4">
                            <button onClick={handleReset} className="text-purple-400 font-semibold">Gravar Outro</button>
                            <button onClick={() => onExit(false, { toolId: 'voice_therapeutic_journal', result: { result: lastResult } })} className="bg-purple-600 text-white font-bold py-2 px-6 rounded-full">Concluir</button>
                        </div>
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
                <div className="flex items-center gap-3"><Mic className="w-8 h-8 text-purple-400" /><h1 className="text-xl font-bold text-gray-200">Diário de Voz Terapêutico</h1></div>
                 <button onClick={() => onExit(true)} className="text-gray-400 hover:text-white transition-colors"><X size={24} /></button>
            </header>
            <main className="flex-1 overflow-y-auto p-6 flex flex-col items-center" data-guide-id="tool-voice_therapeutic_journal">
                {renderContent()}
            </main>
        </div>
    );
};

export default VoiceTherapeuticJournal;