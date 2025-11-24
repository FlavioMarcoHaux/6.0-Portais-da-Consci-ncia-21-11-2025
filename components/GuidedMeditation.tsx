import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Meditation, AgentId, Session, ActivityLogEntry } from '../types.ts';
import { generateMeditationScript, summarizeChatForMeditation } from '../services/geminiScriptService.ts';
import { generateSpeech } from '../services/geminiTtsService.ts';
import { decode, decodeAudioData } from '../utils/audioUtils.ts';
import { getFriendlyErrorMessage } from '../utils/errorUtils.ts';
import MeditationGuideChat from './MeditationGuideChat.tsx';
import MeditationPreview from './MeditationPreview.tsx';
import { useStore } from '../store.ts';
import { X, Pause, Play, Loader2, RefreshCw, SkipBack, SkipForward, RotateCcw, CheckCircle } from 'lucide-react';

interface GuidedMeditationProps {
    onExit: (isManual: boolean, result?: any) => void;
}

const GuidedMeditation: React.FC<GuidedMeditationProps> = ({ onExit }) => {
    const { 
        lastAgentContext, 
        currentSession,
        logActivity,
        toolStates,
        setToolState,
        chatHistories,
        coherenceVector,
        addToast,
        activityLog,
        startSession
    } = useStore(state => ({
        lastAgentContext: state.lastAgentContext,
        currentSession: state.currentSession,
        logActivity: state.logActivity,
        toolStates: state.toolStates,
        setToolState: state.setToolState,
        chatHistories: state.chatHistories,
        coherenceVector: state.coherenceVector,
        addToast: state.addToast,
        activityLog: state.activityLog,
        startSession: state.startSession,
    }));
    
    const meditationState = toolStates.meditation!;
    const { currentChunkIndex: currentPhraseIndex } = meditationState;
    
    // Store style locally as it persists only for the session config
    const [style, setStyle] = useState<'relax' | 'power_up'>('relax');

    const updateState = useCallback((newState: Partial<typeof meditationState>) => {
        setToolState('meditation', (prevState) => ({ ...prevState!, ...newState }));
    }, [setToolState]);

    const setCurrentPhraseIndex = (updater: (prev: number) => number) => {
        updateState({ currentChunkIndex: updater(meditationState.currentChunkIndex ?? 0) });
    };

    const isVoiceOrigin = currentSession?.origin === 'voice';
    const agentIdForContext = isVoiceOrigin ? null : lastAgentContext ?? AgentId.COHERENCE;
    const chatHistory = agentIdForContext ? (chatHistories[agentIdForContext] || []) : [];

    const [initialPrompt, setInitialPrompt] = useState('');
    const [isSummarizing, setIsSummarizing] = useState(true);

    const [audioQueue, setAudioQueue] = useState<AudioBuffer[]>([]);
    const [generationProgress, setGenerationProgress] = useState(0);

    const audioContextRef = useRef<AudioContext | null>(null);
    const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
    
    const wasAutoStarted = useRef(false);

    const handleCreateMeditation = useCallback(async (prompt: string, duration: number, selectedStyle: 'relax' | 'power_up') => {
        setStyle(selectedStyle);
        updateState({ state: 'generating', error: null, script: null, prompt });
        try {
            const script = await generateMeditationScript(prompt, duration, selectedStyle, chatHistory);
            updateState({ script, state: 'preview' });
        } catch (err) {
            const friendlyError = getFriendlyErrorMessage(err, "Falha ao criar a meditação.");
            updateState({ error: friendlyError, state: 'error' });
        }
    }, [chatHistory, updateState]);

    useEffect(() => {
        const session = currentSession as Extract<Session, { type: 'meditation' }>;
        
        if (session?.replayData) {
            const { script, generatedAudioParts } = session.replayData;
            updateState({
                state: 'preview',
                script,
                generatedAudioParts,
                prompt: script.title,
                error: null,
                currentChunkIndex: 0,
            });
            wasAutoStarted.current = true;
            setIsSummarizing(false);
            return;
        }
        
        if (meditationState.state !== 'config') {
            setIsSummarizing(false);
            return;
        }

        const generateSummary = async () => {
            if (session?.autoStart && session.initialPrompt && session.initialPrompt.trim()) {
                wasAutoStarted.current = true;
                handleCreateMeditation(session.initialPrompt, 5, 'relax'); // Default auto-start to relax
                return;
            }

            if (session?.initialPrompt) {
                setInitialPrompt(session.initialPrompt);
                setIsSummarizing(false);
                return;
            }

            if (chatHistory && chatHistory.length > 1) {
                setIsSummarizing(true);
                try {
                    const summary = await summarizeChatForMeditation(chatHistory, coherenceVector, toolStates);
                    setInitialPrompt(summary);
                } catch (e) {
                    console.error("Failed to summarize chat:", e);
                    setInitialPrompt(''); 
                } finally {
                    setIsSummarizing(false);
                }
            } else {
                setIsSummarizing(false);
                setInitialPrompt('');
            }
        };
        generateSummary();
    }, [currentSession, meditationState.state, handleCreateMeditation, chatHistory, coherenceVector, toolStates, updateState]);

    // Rehydration logic
    useEffect(() => {
        const rehydrateAudio = async () => {
            if (
                (meditationState.state === 'ready' || meditationState.state === 'playing' || meditationState.state === 'paused') &&
                meditationState.script &&
                meditationState.generatedAudioParts &&
                audioQueue.length === 0
            ) {
                try {
                    const wasPaused = meditationState.state === 'paused';
                    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
                        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                        if (wasPaused && audioContextRef.current.state === 'running') {
                            await audioContextRef.current.suspend();
                        } else if (!wasPaused && audioContextRef.current.state === 'suspended') {
                            await audioContextRef.current.resume();
                        }
                    }

                    const decodedAudios = await Promise.all(
                        meditationState.generatedAudioParts.map(async (b64part) => {
                            const bytes = decode(b64part);
                            return decodeAudioData(bytes, audioContextRef.current!, 24000, 1);
                        })
                    );
                    setAudioQueue(decodedAudios);
                } catch (err) {
                    const friendlyError = getFriendlyErrorMessage(err, "Falha ao restaurar a meditação.");
                    updateState({ error: friendlyError, state: 'error' });
                }
            }
        };
        rehydrateAudio();
    }, [meditationState.state, meditationState.script, meditationState.generatedAudioParts, audioQueue.length, updateState]);


    useEffect(() => {
        return () => {
            if (audioContextRef.current?.state !== 'closed') {
                audioContextRef.current?.close().catch(e => console.error("Error closing AudioContext:", e));
            }
        };
    }, []);
    
    const handleStartMeditation = useCallback(async () => {
        if (!meditationState.script) return;
        updateState({ currentChunkIndex: 0 });
        
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
        }

        updateState({ state: 'generating' }); 
        setGenerationProgress(0);
        try {
            const audioContext = audioContextRef.current;
            
            if (meditationState.generatedAudioParts && meditationState.generatedAudioParts.length > 0) {
                const decodedAudios = await Promise.all(
                    meditationState.generatedAudioParts.map(async (b64part) => {
                        const bytes = decode(b64part);
                        return decodeAudioData(bytes, audioContext, 24000, 1);
                    })
                );
                setAudioQueue(decodedAudios);
                updateState({ state: 'ready' }); // Go to ready instead of playing directly
                return;
            }
            
            const scriptParts = meditationState.script.script;
            const totalParts = scriptParts.length;
            if (totalParts === 0) {
                updateState({ state: 'preview', error: "O roteiro da meditação está vazio." });
                return;
            }
    
            // Select voice and context based on style
            const voice = style === 'power_up' ? 'Zephyr' : 'Aoede';
            const ttsContext = style === 'power_up' ? 'meditation-power' : 'meditation-relax';
    
            const results: { index: number, buffer: AudioBuffer, b64: string }[] = [];
            let completedCount = 0;

            // Concurrency Control & Retry Logic
            const activePromises: Promise<void>[] = [];
            const MAX_CONCURRENCY = 2; // Decreased from 3 for stability

            for (let i = 0; i < totalParts; i++) {
                 if (useStore.getState().toolStates.meditation?.state !== 'generating') break;
                 
                 const task = async () => {
                    const part = scriptParts[i];
                    let attempts = 0;
                    let success = false;
                    while(attempts < 5 && !success) { // Increased max retries
                         if (useStore.getState().toolStates.meditation?.state !== 'generating') return;
                        try {
                            const audioObject = await generateSpeech(part.text, voice, ttsContext, meditationState.prompt);
                            if (audioObject?.data) {
                                const bytes = decode(audioObject.data);
                                const buffer = await decodeAudioData(bytes, audioContext, 24000, 1);
                                results.push({ index: i, buffer, b64: audioObject.data });
                                success = true;
                            } else {
                                throw new Error("Empty response");
                            }
                        } catch(e) {
                            attempts++;
                            // Exponential backoff: 2s, 4s, 8s...
                            const delay = 1000 * Math.pow(2, attempts);
                            await new Promise(resolve => setTimeout(resolve, delay));
                        }
                    }
                    if (!success) throw new Error(`Failed to generate part ${i}`);
                    
                    completedCount++;
                    setGenerationProgress((completedCount / totalParts) * 100);
                 };

                 const p = task().then(() => {
                     activePromises.splice(activePromises.indexOf(p), 1);
                 });
                 activePromises.push(p);
                 
                 if (activePromises.length >= MAX_CONCURRENCY) {
                     await Promise.race(activePromises);
                 }
                 
                 // Small throttle to prevent immediate burst even if concurrency slot opens
                 await new Promise(resolve => setTimeout(resolve, 300));
            }
            
            await Promise.all(activePromises);

            if (useStore.getState().toolStates.meditation?.state !== 'generating') return;

            // Sort results to ensure audio order matches script order
            results.sort((a, b) => a.index - b.index);
            
            if (results.length !== totalParts) throw new Error("Alguns trechos de áudio não puderam ser gerados.");

            updateState({ generatedAudioParts: results.map(r => r.b64) });
            setAudioQueue(results.map(r => r.buffer));
            updateState({ state: 'ready' }); // Go to ready instead of playing directly
        } catch (err) {
             const friendlyError = getFriendlyErrorMessage(err, "Falha ao gerar o áudio da meditação.");
             updateState({ error: friendlyError, state: 'error' });
        }
    }, [meditationState.script, updateState, meditationState.prompt, meditationState.generatedAudioParts, style]);

    useEffect(() => {
        if (meditationState.state === 'preview' && wasAutoStarted.current) {
            handleStartMeditation();
            wasAutoStarted.current = false;
        }
    }, [meditationState.state, handleStartMeditation]);

    useEffect(() => {
        if (meditationState.state !== 'playing' || audioQueue.length === 0) {
            return;
        }

        if (currentPhraseIndex >= audioQueue.length) {
            updateState({ state: 'finished' });
            return;
        }

        const audioContext = audioContextRef.current;
        if (!audioContext) return;
        
        const source = audioContext.createBufferSource();
        source.buffer = audioQueue[currentPhraseIndex];
        source.connect(audioContext.destination);
        
        const onPlaybackEnd = () => {
            setCurrentPhraseIndex(prevIndex => prevIndex + 1);
        };
        source.addEventListener('ended', onPlaybackEnd);
        
        source.start();
        sourceNodeRef.current = source;

        return () => {
            source.removeEventListener('ended', onPlaybackEnd);
            try {
                source.stop();
            } catch (e) {}
        };
    }, [meditationState.state, audioQueue, currentPhraseIndex, updateState]);


    const handlePlayPause = () => {
        const audioContext = audioContextRef.current;
        if (!audioContext) return;

        if (meditationState.state === 'ready') {
             // Start first play
             audioContext.resume();
             updateState({ state: 'playing' });
        } else if (meditationState.state === 'playing') {
            audioContext.suspend();
            updateState({ state: 'paused' });
        } else if (meditationState.state === 'paused') {
            audioContext.resume();
            updateState({ state: 'playing' });
        }
    };

    const handleRestart = () => {
         setCurrentPhraseIndex(() => 0);
         if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
             audioContextRef.current.resume();
             updateState({ state: 'playing' });
         } else if (meditationState.state !== 'playing') {
             updateState({ state: 'playing' });
         }
    };

    const handleSkipForward = () => {
        setCurrentPhraseIndex(prev => Math.min(audioQueue.length - 1, prev + 1));
    };

    const handleSkipBack = () => {
        setCurrentPhraseIndex(prev => Math.max(0, prev - 1));
    };
    
    const handleFinishSession = () => {
        if (!meditationState.script) return;

        logActivity({
            type: 'tool_usage',
            agentId: agentIdForContext ?? AgentId.GUIDE,
            data: {
                toolId: 'meditation',
                result: {
                    prompt: meditationState.prompt,
                    script: meditationState.script,
                    generatedAudioParts: meditationState.generatedAudioParts,
                },
            },
        });

        onExit(false, { toolId: 'meditation', result: { prompt: meditationState.prompt, script: meditationState.script, generatedAudioParts: meditationState.generatedAudioParts } });
    };

    const handleSafeExit = () => {
        // Auto-save logic for safety
        if (meditationState.script && meditationState.generatedAudioParts && meditationState.generatedAudioParts.length > 0) {
             addToast("Salvando meditação em 'Minha Jornada'...", 'info');
             logActivity({
                type: 'tool_usage',
                agentId: agentIdForContext ?? AgentId.GUIDE,
                data: {
                    toolId: 'meditation',
                    result: {
                        prompt: meditationState.prompt,
                        script: meditationState.script,
                        generatedAudioParts: meditationState.generatedAudioParts,
                    },
                },
            });
        }
        onExit(true);
    };

    const handleReset = () => {
        if (sourceNodeRef.current) {
            try { sourceNodeRef.current.stop(); } catch(e) {}
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        updateState({ state: 'config', script: null, generatedAudioParts: null, error: null, prompt: '', currentChunkIndex: 0 });
        setAudioQueue([]);
        setGenerationProgress(0);
    };

    const handleReturnToConfig = () => {
        updateState({ state: 'config' });
    };
    
    const recentMeditations = useMemo(() => {
        return activityLog
            .filter(entry => 
                entry.type === 'tool_usage' && 
                entry.data.toolId === 'meditation' && 
                entry.data.result?.script &&
                entry.data.result?.generatedAudioParts?.length > 0
            )
            .slice(0, 3); // Get latest 3
    }, [activityLog]);

    const handleReplay = (replayData: any) => {
        if (replayData.script && replayData.generatedAudioParts) {
            startSession({
                type: 'meditation',
                replayData: {
                    script: replayData.script,
                    generatedAudioParts: replayData.generatedAudioParts,
                }
            });
        }
    };


    const renderContent = () => {
        if (['preview', 'ready', 'playing', 'paused'].includes(meditationState.state) && !meditationState.script) {
            handleReset();
            return <MeditationGuideChat onCreate={handleCreateMeditation} onExit={handleSafeExit} initialPrompt={initialPrompt} isSummarizing={isSummarizing} recentMeditations={recentMeditations} onReplay={handleReplay} />;
        }

        switch (meditationState.state) {
            case 'config':
                return <MeditationGuideChat onCreate={handleCreateMeditation} onExit={handleSafeExit} initialPrompt={initialPrompt} isSummarizing={isSummarizing} recentMeditations={recentMeditations} onReplay={handleReplay} />;
            case 'generating':
                const isGeneratingScript = !meditationState.script;
                const isReplaying = !!meditationState.generatedAudioParts;
                const progressText = isGeneratingScript 
                    ? "Canalizando o roteiro da sua jornada..." 
                    : isReplaying
                    ? "Recuperando a frequência da sua meditação..."
                    : "Sintetizando a voz do seu guia...";
                
                const hasLongWait = isGeneratingScript && (meditationState.script as any)?.chapters?.length > 2; // Simple heuristic for long generation

                return (
                    <div className="h-full w-full flex flex-col items-center justify-center glass-pane rounded-2xl p-4 text-center">
                        <div className="w-12 h-12 border-4 border-dashed rounded-full animate-spin border-indigo-500"></div>
                        <p className="ml-4 text-lg mt-4">{progressText}</p>
                        {hasLongWait && (
                             <p className="text-xs text-indigo-400 mt-2 animate-pulse">Estruturando meditação de longa duração. Isso pode levar um momento...</p>
                        )}
                        {!isGeneratingScript && !isReplaying && (
                            <div className="w-64 mt-2">
                                <div className="flex justify-between items-center text-sm text-gray-400 mb-1">
                                    <span>Progresso</span>
                                    <span>{Math.round(generationProgress)}%</span>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-2.5">
                                    <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${generationProgress}%`, transition: 'width 0.2s ease-out' }}></div>
                                </div>
                            </div>
                        )}
                        <p className="text-sm text-gray-400 mt-4">Por favor, aguarde.</p>
                    </div>
                );
            case 'preview':
                return <MeditationPreview meditation={meditationState.script!} onStart={handleStartMeditation} onGoBack={handleReturnToConfig} onExit={handleSafeExit} isLoading={meditationState.state === 'generating'} />;
            case 'ready':
                 return (
                     <div className="relative h-full w-full flex flex-col items-center justify-center p-6 text-center">
                         <div className="absolute inset-0 bg-black/60 -z-10" />
                         <header className="absolute top-4 right-4">
                             <button onClick={handleSafeExit} className="bg-gray-700/50 hover:bg-gray-600/50 text-white p-2 rounded-full transition-colors"><X size={24} /></button>
                         </header>
                         
                         <CheckCircle className="w-20 h-20 text-green-500 mb-6 animate-bounce" />
                         <h2 className="text-3xl font-bold text-white mb-4">Sua meditação está pronta</h2>
                         <p className="text-lg text-gray-300 mb-8 max-w-md">Tudo preparado. Encontre uma posição confortável e pressione Play quando quiser começar.</p>
                         
                         <button
                             onClick={handlePlayPause}
                             className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold w-24 h-24 rounded-full transition-all flex items-center justify-center shadow-lg hover:scale-105"
                         >
                             <Play size={40} className="ml-1" />
                         </button>
                     </div>
                 );
            case 'playing':
            case 'paused':
                 const currentPart = meditationState.script!.script[currentPhraseIndex];
                 if (!currentPart) return null;
                 const currentText = currentPart.text;
                 const progress = audioQueue.length > 0 ? ((currentPhraseIndex + 1) / audioQueue.length) * 100 : 0;

                 return (
                     <div className="relative h-full w-full flex flex-col">
                         <div className="absolute inset-0 bg-black/60 -z-10" />
                         <header className="flex items-center justify-end gap-4 p-4 flex-shrink-0">
                             <button onClick={handleSafeExit} className="bg-gray-700/50 hover:bg-gray-600/50 text-white p-2 rounded-full transition-colors"><X size={24} /></button>
                         </header>
                         <main className="flex-1 min-h-0 flex flex-col items-center justify-center text-center p-6">
                            <div className="overflow-y-auto no-scrollbar max-h-full w-full">
                                <p className="text-xl md:text-2xl text-gray-200 max-w-3xl mx-auto animate-fade-in whitespace-pre-wrap">{currentText}</p>
                            </div>
                        </main>
                         <footer className="w-full max-w-3xl mx-auto p-6 flex-shrink-0">
                             <div className="flex justify-between text-xs text-gray-400 mb-2">
                                 <span>Parte {currentPhraseIndex + 1} de {audioQueue.length}</span>
                                 <span>{Math.round(progress)}%</span>
                             </div>
                             <div className="w-full bg-gray-700/50 rounded-full h-1.5 mb-6">
                                 <div className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                             </div>
                             
                             <div className="flex items-center justify-center gap-6 md:gap-8">
                                <button onClick={handleRestart} className="text-gray-400 hover:text-white p-2 rounded-full transition-colors" title="Reiniciar">
                                    <RotateCcw size={24} />
                                </button>
                                
                                <button onClick={handleSkipBack} disabled={currentPhraseIndex === 0} className="text-gray-300 hover:text-white p-2 rounded-full transition-colors disabled:opacity-30">
                                     <SkipBack size={32} />
                                </button>

                                 <button onClick={handlePlayPause} className="bg-indigo-600 hover:bg-indigo-700 text-white w-16 h-16 rounded-full flex items-center justify-center transition-transform hover:scale-105 shadow-lg">
                                     {meditationState.state === 'playing' ? <Pause size={32} /> : <Play size={32} className="ml-1"/>}
                                 </button>

                                <button onClick={handleSkipForward} disabled={currentPhraseIndex >= audioQueue.length - 1} className="text-gray-300 hover:text-white p-2 rounded-full transition-colors disabled:opacity-30">
                                     <SkipForward size={32} />
                                </button>

                                <button onClick={handleReset} className="text-gray-400 hover:text-white p-2 rounded-full transition-colors" title="Criar Nova Meditação">
                                    <RefreshCw size={24} />
                                </button>
                             </div>
                         </footer>
                     </div>
                 );
            case 'finished':
                return (
                    <div className="relative h-full w-full flex flex-col p-6 items-center justify-center text-center">
                        <div className="absolute inset-0 bg-black/60 -z-10" />
                        <h2 className="text-3xl font-bold text-white mb-4">Meditação Concluída</h2>
                        <p className="text-lg text-gray-300 mb-8">Permaneça neste estado de paz por alguns instantes.</p>
                        <button
                            onClick={handleFinishSession}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-full transition-colors text-lg"
                        >
                            Concluir Sessão
                        </button>
                        <button
                            onClick={handleRestart}
                             className="mt-4 text-indigo-400 font-semibold py-2 px-4 flex items-center gap-2 hover:bg-indigo-500/10 rounded-lg"
                        >
                            <RotateCcw size={18} /> Ouvir Novamente
                        </button>
                        <button
                            onClick={handleReset}
                            className="mt-2 text-gray-400 font-semibold py-2 px-4 rounded-full hover:bg-gray-700/50"
                        >
                            Criar Nova Meditação
                        </button>
                    </div>
                );
            case 'error':
                return (
                    <div className="h-full w-full flex flex-col items-center justify-center glass-pane rounded-2xl p-4 text-center">
                        <h2 className="text-2xl text-red-400 mb-4">Ocorreu um Erro</h2>
                        <p className="text-gray-300 mb-6">{meditationState.error}</p>
                        <button onClick={handleReset} className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-full">Tentar Novamente</button>
                    </div>
                );
            default:
                return null;
        }
    };
    
    return <div data-guide-id="tool-meditation" className="h-full w-full">{renderContent()}</div>;
};

export default GuidedMeditation;