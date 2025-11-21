import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveSession, LiveServerMessage, Modality, Blob as GenaiBlob, FunctionDeclaration, Type } from '@google/genai';
import { decode, decodeAudioData, encode } from '../utils/audioUtils.ts';
import { getFriendlyErrorMessage } from '../utils/errorUtils.ts';
import { X, Mic, MicOff, Loader2, Paperclip, Send, ChevronDown, Compass, ArrowLeft } from 'lucide-react';
import { useStore } from '../store.ts';
import { Agent, AgentId, ToolId, Message, Session } from '../types.ts';
import { AGENTS, toolMetadata } from '../constants.tsx';
import { createComprehensiveContext, summarizeDroppedConversation } from '../services/geminiService.ts';
import { TtsVoice } from '../services/geminiTtsService.ts';

interface LiveConversationProps {
    agent: Agent;
    onExit: (manualExit?: boolean) => void;
    autoStart?: boolean;
}

type Status = 'idle' | 'connecting' | 'reconnecting' | 'connected' | 'error' | 'disconnected';

const agentVoiceMap: Record<AgentId, TtsVoice> = {
    [AgentId.COHERENCE]: 'Kore',
    [AgentId.SELF_KNOWLEDGE]: 'Zephyr',
    [AgentId.HEALTH]: 'Fenrir',
    [AgentId.EMOTIONAL_FINANCE]: 'Puck',
    [AgentId.INVESTMENTS]: 'Charon',
    [AgentId.GUIDE]: 'Zephyr',
};

const LiveConversation: React.FC<LiveConversationProps> = ({ agent, onExit, autoStart = false }) => {
    const { 
        startSession, 
        switchAgent,
        coherenceVector,
        toolStates,
        activityLog,
        handleConnectionDrop,
        startGuide,
        completedTours,
        addMessagesToHistory,
        chatHistories,
        resetAgentMode,
    } = useStore();

    const [status, setStatus] = useState<Status>('idle');
    const [error, setError] = useState<string | null>(null);
    const [currentTranscript, setCurrentTranscript] = useState<{ user: string, model: string }>({ user: '', model: '' });
    
    const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
    const [isMentorListOpen, setIsMentorListOpen] = useState(false);

    const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
    const audioContextRefs = useRef<{ input: AudioContext | null, output: AudioContext | null }>({ input: null, output: null });
    const streamRefs = useRef<{ media: MediaStream | null, processor: ScriptProcessorNode | null, source: MediaStreamAudioSourceNode | null }>({ media: null, processor: null, source: null });
    const nextStartTimeRef = useRef(0);
    const audioSourcesRef = useRef(new Set<AudioBufferSourceNode>());
    
    const retryCountRef = useRef(0);
    const MAX_RETRIES = 3;
    const statusRef = useRef(status);
    useEffect(() => { statusRef.current = status; }, [status]);
    const handleConnectRef = useRef<((isRetry?: boolean) => void) | null>(null);

    const fullTranscript = chatHistories[agent.id] || [];

    // Function declarations for the agent
    const startToolFunctionDeclaration: FunctionDeclaration = {
        name: 'startTool',
        description: 'Inicia uma ferramenta específica para o usuário.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                toolId: {
                    type: Type.STRING,
                    description: 'O ID da ferramenta a ser iniciada.',
                    enum: agent.tools || [],
                },
                payload: {
                    type: Type.STRING,
                    description: 'Opcional. Um texto para pré-preencher na ferramenta (ex: um tema para meditação).',
                },
            },
            required: ['toolId'],
        },
    };
    
    const navigateOrEndFunctionDeclaration: FunctionDeclaration = {
      name: 'navigateOrEnd',
      description: 'Encerra a sessão de voz atual.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          action: {
            type: Type.STRING,
            description: 'A ação a ser executada. A única ação suportada é "end_session".',
            enum: ['end_session'],
          },
        },
        required: ['action'],
      },
    };

    const switchMentorFunctionDeclaration: FunctionDeclaration = {
        name: 'switchMentor',
        description: 'Navega para uma conversa de voz com um mentor diferente.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                agentId: {
                    type: Type.STRING,
                    description: 'O ID do mentor para o qual navegar.',
                    enum: Object.values(AGENTS).filter(a => a.id !== agent.id).map(a => a.id),
                },
            },
            required: ['agentId'],
        },
    };

    const cleanup = useCallback(() => {
        sessionPromiseRef.current?.then(session => session.close()).catch(() => {});
        sessionPromiseRef.current = null;
        
        streamRefs.current.media?.getTracks().forEach(track => track.stop());
        streamRefs.current.processor?.disconnect();
        streamRefs.current.source?.disconnect();
        
        audioContextRefs.current.input?.close().catch(()=>{});
        audioContextRefs.current.output?.close().catch(()=>{});
        
        for (const source of audioSourcesRef.current.values()) {
            try { source.stop(); } catch(e) {}
        }
        audioSourcesRef.current.clear();
    }, []);

    const handleError = useCallback((err: any) => {
        console.error(`LiveConversation Error for ${agent.id}:`, err);
        cleanup();
        
        if (statusRef.current === 'disconnected') return;
        
        const msg = err instanceof Error ? err.message : String(err);
        const name = err instanceof Error ? err.name : '';
        const isPermissionError = name === 'NotAllowedError' || name === 'NotFoundError' || msg.includes('Permission denied') || msg.includes('permission_denied');

        if (retryCountRef.current < MAX_RETRIES && !isPermissionError) {
            retryCountRef.current += 1;
            const delay = Math.pow(2, retryCountRef.current) * 1000;
            setStatus('reconnecting');
            setError(`Conexão instável. Reconectando em ${delay/1000}s... (Tentativa ${retryCountRef.current}/${MAX_RETRIES})`);
            setTimeout(() => handleConnectRef.current?.(true), delay);
        } else {
            const friendlyError = getFriendlyErrorMessage(err, `A conexão com ${agent.name} falhou.`);
            setError(friendlyError); 
            setStatus('error');
            handleConnectionDrop(agent.id, fullTranscript);
        }
    }, [cleanup, agent.id, agent.name, fullTranscript, handleConnectionDrop]);

    const handleConnect = useCallback(async (isRetry = false) => {
        if (statusRef.current === 'connecting' || statusRef.current === 'connected') return;
        if (!isRetry) {
            retryCountRef.current = 0;
        }
        setStatus(isRetry ? 'reconnecting' : 'connecting');
        setError(null);
        
        try {
            audioContextRefs.current.input = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            if (outputCtx.state === 'suspended') {
                await outputCtx.resume();
            }
            audioContextRefs.current.output = outputCtx;
            streamRefs.current.media = await navigator.mediaDevices.getUserMedia({ audio: true });

            const onmessage = async (message: LiveServerMessage) => {
                // Handle Function Calls
                if (message.toolCall?.functionCalls) {
                    for (const fc of message.toolCall.functionCalls) {
                        if (fc.name === 'startTool') {
                            const { toolId, payload } = fc.args;
                            let sessionConfig: Session;
                            switch (toolId) {
                                case 'meditation': sessionConfig = { type: 'meditation', initialPrompt: payload || '', autoStart: true }; break;
                                case 'guided_prayer': sessionConfig = { type: 'guided_prayer', initialTheme: payload || '', autoStart: true }; break;
                                case 'prayer_pills': sessionConfig = { type: 'prayer_pills', initialTheme: payload || '', autoStart: true }; break;
                                default: sessionConfig = { type: toolId as any, autoStart: true };
                            }
                            startSession(sessionConfig);
                        } else if (fc.name === 'navigateOrEnd' && fc.args.action === 'end_session') {
                            onExit(true); // manualExit = true to trigger proactive nav
                        } else if (fc.name === 'switchMentor') {
                            const { agentId } = fc.args;
                            if (agentId) {
                                switchAgent(agentId as AgentId);
                            }
                        }
                    }
                }
                
                // Handle Audio Output
                const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                const currentOutputCtx = audioContextRefs.current.output;
                if (base64Audio && currentOutputCtx) {
                    nextStartTimeRef.current = Math.max(nextStartTimeRef.current, currentOutputCtx.currentTime);
                    const audioBuffer = await decodeAudioData(decode(base64Audio), currentOutputCtx, 24000, 1);
                    const source = currentOutputCtx.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(currentOutputCtx.destination);
                    source.addEventListener('ended', () => audioSourcesRef.current.delete(source));
                    source.start(nextStartTimeRef.current);
                    nextStartTimeRef.current += audioBuffer.duration;
                    audioSourcesRef.current.add(source);
                }

                // Handle Transcripts
                if (message.serverContent?.inputTranscription?.text) {
                    setCurrentTranscript(prev => ({ ...prev, user: prev.user + message.serverContent!.inputTranscription!.text }));
                }
                if (message.serverContent?.outputTranscription?.text) {
                    setCurrentTranscript(prev => ({ ...prev, model: prev.model + message.serverContent!.outputTranscription!.text }));
                }
                if (message.serverContent?.turnComplete) {
                    addMessagesToHistory(agent.id, [
                        { id: `user-${Date.now()}`, sender: 'user', text: currentTranscript.user, timestamp: Date.now() },
                        { id: `agent-${Date.now()}`, sender: 'agent', text: currentTranscript.model, timestamp: Date.now() },
                    ]);
                    setCurrentTranscript({ user: '', model: '' });
                }
            };
            
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const agentSession = useStore.getState().currentSession as Extract<Session, { type: 'agent' }>;
            const isManualReconnection = agentSession?.isReconnection;
            const history = useStore.getState().chatHistories[agent.id] || [];
            
            // A summary should only be generated for explicit manual reconnections.
            // Automatic retries should recover silently without the agent mentioning a "connection drop".
            const shouldGenerateSummary = !!isManualReconnection && history.length > 0;

            const reconnectSummary = shouldGenerateSummary
                ? await summarizeDroppedConversation(history)
                : null;

            const comprehensiveContext = createComprehensiveContext(coherenceVector, toolStates, activityLog, reconnectSummary);

            const otherAgentsDescriptions = Object.values(AGENTS)
                .filter(a => a.id !== agent.id && a.id !== AgentId.GUIDE)
                .map(a => `- **${a.name} (ID: ${a.id}):** ${a.description}`)
                .join('\n');

            const systemInstruction = `Você é o ${agent.name}. ${agent.persona || agent.description}. Aja estritamente como este personagem.

**Guia de Ação e Navegação por Voz:**
Sua principal função é auxiliar o usuário. Você pode iniciar ferramentas ou navegar para outros mentores usando as funções disponíveis.

1.  **Iniciar Ferramentas:** Se o usuário pedir para usar uma de suas ferramentas, chame a função \`startTool\` com o \`toolId\` correto. Você pode sugerir temas no \`payload\`.
    - Ex: "Vamos meditar para acalmar a mente." -> \`startTool({ toolId: 'meditation', payload: 'acalmar a mente' })\`

2.  **Trocar de Mentor:** Se o usuário pedir para falar com outro especialista, você DEVE chamar a função \`switchMentor\` com o \`agentId\` do mentor solicitado. Esta é uma ação de navegação prioritária.
    - Ex: "Quero falar com o Arquiteto da Consciência." -> \`switchMentor({ agentId: 'self_knowledge' })\`
    - Ex: "Pode me levar para o Terapeuta Financeiro?" -> \`switchMentor({ agentId: 'emotional_finance' })\`

3.  **Encerrar Sessão:** Se o usuário pedir para encerrar, chame a função \`navigateOrEnd({ action: 'end_session' })\`.

**Mapa de Outros Mentores (use o ID para a função \`switchMentor\`):**
${otherAgentsDescriptions}

${comprehensiveContext}`;

            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        retryCountRef.current = 0;
                        setStatus('connected');
                        const inputCtx = audioContextRefs.current.input;
                        if (!inputCtx || !streamRefs.current.media) return;

                        streamRefs.current.source = inputCtx.createMediaStreamSource(streamRefs.current.media);
                        streamRefs.current.processor = inputCtx.createScriptProcessor(4096, 1, 1);
                        
                        streamRefs.current.processor.onaudioprocess = (event) => {
                            const inputData = event.inputBuffer.getChannelData(0);
                            const int16 = new Int16Array(inputData.length);
                            for (let i = 0; i < inputData.length; i++) { int16[i] = inputData[i] * 32768; }
                            const pcmBlob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
                            sessionPromiseRef.current?.then(session => session.sendRealtimeInput({ media: pcmBlob }));
                        };

                        streamRefs.current.source.connect(streamRefs.current.processor);
                        streamRefs.current.processor.connect(inputCtx.destination);
                    },
                    onmessage,
                    onerror: (e: ErrorEvent) => handleError(e),
                    onclose: () => {
                        if (statusRef.current !== 'reconnecting' && statusRef.current !== 'error') {
                            setStatus('disconnected');
                        }
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: agentVoiceMap[agent.id] || 'Zephyr' } } },
                    systemInstruction,
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    tools: [{ functionDeclarations: [startToolFunctionDeclaration, navigateOrEndFunctionDeclaration, switchMentorFunctionDeclaration] }],
                },
            });
            sessionPromiseRef.current = sessionPromise;
            await sessionPromise;

        } catch (err) {
            handleError(err);
        }
    }, [agent, coherenceVector, toolStates, activityLog, startSession, onExit, handleError, addMessagesToHistory, switchAgent]);

    useEffect(() => {
        handleConnectRef.current = handleConnect;
    }, [handleConnect]);

    useEffect(() => {
        // Automatically connect on mount, simulating auto-start for voice mode.
        handleConnectRef.current?.();
    }, []);
    
    useEffect(() => {
        const tourId = 'live_conversation';
        const isTourCompleted = completedTours.includes(tourId);
        if (!isTourCompleted) {
            setTimeout(() => startGuide(tourId, { agent }), 300);
        }
    }, [agent, completedTours, startGuide]);

    useEffect(() => {
        return () => cleanup();
    }, [cleanup]);
    
    const handleToolClick = (toolId: ToolId) => {
        startSession({ type: toolId as any });
        setIsSidePanelOpen(false);
    };

    const renderStatusText = () => {
        if (error) return <p className="text-red-400">{error}</p>;
        switch (status) {
            case 'idle': return 'Iniciando conexão de voz...';
            case 'connecting': return 'Conectando...';
            case 'reconnecting': return 'Reconectando...';
            case 'connected': return 'Conectado. Você pode começar a falar.';
            case 'disconnected': return 'Conversa encerrada.';
            case 'error': return 'Erro de conexão.';
            default: return '';
        }
    };

    return (
        <div className="h-full w-full flex animate-fade-in">
             <div className="flex-1 flex flex-col overflow-hidden">
                <header className="flex items-center justify-between p-4 border-b border-gray-700/50">
                    <div className="flex items-center gap-4">
                         <button
                            onClick={() => onExit(true)}
                            className="text-gray-400 hover:text-white transition-colors"
                            title="Voltar"
                        >
                            <ArrowLeft size={24} />
                        </button>
                        <agent.icon className={`w-10 h-10 ${agent.themeColor}`} />
                        <div>
                            <h1 className="text-xl font-bold">{agent.name}</h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button onClick={() => onExit(true)} className="text-gray-400 hover:text-white transition-colors"><X size={24} /></button>
                        <button onClick={() => setIsSidePanelOpen(true)} className="lg:hidden text-sm font-semibold text-yellow-300 border border-yellow-500/40 rounded-lg px-4 py-1.5" aria-label="Abrir ferramentas">Ferramentas</button>
                    </div>
                </header>
                
                <main className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4" data-guide-id="live-transcript-area">
                    {(status === 'idle' || status === 'connecting' || status === 'reconnecting') && <Loader2 className="w-24 h-24 text-gray-400 animate-spin" />}
                    {status === 'connected' && <div className={`w-32 h-32 rounded-full flex items-center justify-center transition-all bg-gray-700 animate-pulse`}><Mic size={64} className={`${agent.themeColor}`} /></div>}
                    {status === 'error' && <MicOff className="w-24 h-24 text-red-400" />}
                    
                    <p className="text-lg h-12">{renderStatusText()}</p>

                    <div className="w-full max-w-2xl h-32 bg-black/20 p-3 rounded-lg overflow-y-auto text-left text-sm">
                        {fullTranscript.map(msg => <p key={msg.id} className={msg.sender === 'user' ? 'text-indigo-300' : 'text-gray-300'}><strong>{msg.sender === 'user' ? 'Você:' : `${agent.name}:`}</strong> {msg.text}</p>)}
                        {currentTranscript.user && <p className="text-indigo-300"><strong>Você:</strong> {currentTranscript.user}</p>}
                        {currentTranscript.model && <p className="text-gray-300"><strong>{agent.name}:</strong> {currentTranscript.model}</p>}
                    </div>
                </main>
             </div>
             
             {isSidePanelOpen && <div onClick={() => setIsSidePanelOpen(false)} className="lg:hidden fixed inset-0 bg-black/60 z-30 animate-fade-in" aria-hidden="true"></div>}
             <aside className={`flex flex-col transition-transform duration-300 ease-in-out fixed inset-y-0 right-0 h-full w-80 max-w-[85vw] bg-gray-900 shadow-2xl z-40 p-4 ${isSidePanelOpen ? 'translate-x-0' : 'translate-x-full'} lg:static lg:h-auto lg:w-80 lg:shadow-none lg:bg-black/10 lg:translate-x-0 lg:border-l lg:border-gray-700/50 lg:z-auto`} data-guide-id="live-tools-button">
                 {/* Side panel content identical to AgentRoom */}
                 <div className="flex items-center justify-between pb-4 border-b border-gray-700/50 lg:hidden">
                    <h3 className="text-lg font-semibold text-gray-200">Opções do Mentor</h3>
                    <button onClick={() => setIsSidePanelOpen(false)} className="text-gray-400 hover:text-white"><X size={24} /></button>
                </div>
                 <div className="flex-1 overflow-y-auto no-scrollbar min-h-0 pt-4 lg:pt-0">
                     <h3 className="text-md font-semibold text-gray-300 mb-2">Ferramentas de {agent.name}</h3>
                     <div className="space-y-2">
                         {agent.tools?.map((toolId, index) => {
                             const tool = toolMetadata[toolId];
                             return <div key={toolId} onClick={() => handleToolClick(toolId)} className="p-3 bg-gray-800/70 rounded-lg flex items-center gap-3 cursor-pointer hover:bg-gray-700/90 transition-colors"><tool.icon className={`w-7 h-7 ${agent.themeColor} flex-shrink-0`} /><p className="font-semibold text-sm">{tool.title}</p></div>;
                         })}
                     </div>
                 </div>
                 <div className="mt-auto pt-4 border-t border-gray-700/50">
                     <button onClick={() => setIsMentorListOpen(prev => !prev)} className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-gray-800/50" aria-expanded={isMentorListOpen}>
                        <h3 className="text-md font-semibold text-gray-300">Trocar Mentor</h3>
                        <ChevronDown size={20} className={`text-gray-400 transition-transform ${isMentorListOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isMentorListOpen && (
                        <div className="mt-2 space-y-2">
                            {Object.values(AGENTS).filter(a => a.id !== agent.id).map(otherAgent => (
                                <div key={otherAgent.id} onClick={() => { switchAgent(otherAgent.id); setIsSidePanelOpen(false); }} className="p-2 bg-gray-800/70 rounded-lg flex items-center gap-3 cursor-pointer hover:bg-gray-700/90">
                                    <otherAgent.icon className={`w-6 h-6 ${otherAgent.themeColor} flex-shrink-0`} /><p className="font-semibold text-sm">{otherAgent.name}</p>
                                </div>
                            ))}
                        </div>
                    )}
                 </div>
             </aside>
        </div>
    );
};

export default LiveConversation;