import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { decode, decodeAudioData, encode } from '../utils/audioUtils.ts';
import { getFriendlyErrorMessage } from '../utils/errorUtils.ts';
import { X, Mic, Loader2 } from 'lucide-react';
import { useStore } from '../store.ts';
import { AGENTS, toolMetadata } from '../constants.tsx';
import { AgentId, ToolId, Session, View, Schedule, ActivityLogEntry } from '../types.ts';


// Dynamically generate enums for function declaration from constants
const agentEnum = Object.values(AGENTS).map(a => a.id);
const toolEnum = Object.keys(toolMetadata);
const pageEnum = ['home', 'mentors', 'tools', 'journey', 'help'];

const navigateFunctionDeclaration: FunctionDeclaration = {
  name: 'navigateTo',
  description: 'Navega para uma página ou ferramenta. Pode pré-preencher dados ou iniciar automaticamente.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      destination: {
        type: Type.STRING,
        description: "O ID único do destino. Pode ser uma página ('home', 'mentors', 'tools', 'journey', 'help'), um mentor (ex: 'coherence') ou uma ferramenta (ex: 'meditation').",
        enum: [...pageEnum, ...agentEnum, ...toolEnum],
      },
      payload: {
        type: Type.STRING,
        description: "Opcional. Um texto para pré-preencher na ferramenta (ex: um tema para meditação)."
      },
      autoStart: {
        type: Type.BOOLEAN,
        description: "Opcional. Se 'true', inicia a ferramenta automaticamente (ex: começa a meditação sem cliques)."
      }
    },
    required: ['destination'],
  },
};

const getSystemInstruction = (reconnectionAgentId: AgentId | null, proactiveContext: string | null | 'loading', schedules: Schedule[], activityLog: ActivityLogEntry[]): string => {
    let specialInstruction = '';
    if (reconnectionAgentId) {
        const agentName = AGENTS[reconnectionAgentId]?.name || 'o mentor';
        specialInstruction = `AVISO URGENTE: A conexão de voz com o mentor '${agentName}' caiu. Sua primeira e única tarefa é informar ao usuário sobre a queda e perguntar se ele deseja reconectar. Ex: "Perdemos a conexão com o ${agentName}. Gostaria de reconectar agora?". Se o usuário confirmar (disser 'sim', 'reconectar', etc.), você DEVE chamar a função \`navigateTo({ destination: '${reconnectionAgentId}', autoStart: true })\`. Ignore todas as outras solicitações até que isso seja resolvido.`;
    } else if (proactiveContext && proactiveContext !== 'loading') {
        specialInstruction = `AVISO: O usuário acabou de encerrar uma sessão. Sua primeira fala DEVE ser uma transição suave, usando a seguinte sugestão contextual: "${proactiveContext}".
Esta sugestão pode conter uma recomendação para usar uma nova ferramenta com um tema específico (ex: "iniciar uma meditação sobre 'abundância'").
Se o usuário concordar com a sugestão (disser 'sim', 'vamos lá', 'pode ser', etc.), sua principal tarefa é extrair a ferramenta e o tema da sugestão e chamar a função \`navigateTo\` com os parâmetros corretos.
Exemplo: Se a sugestão foi "Que tal iniciarmos uma meditação guiada com a intenção de 'abrir-se para o fluxo da abundância'?" e o usuário concordar, você deve chamar \`navigateTo({ destination: 'meditation', payload: 'abrir-se para o fluxo da abundância' })\`.
Depois dessa primeira interação, volte ao seu comportamento normal de navegação.`;
    }

    const activeSchedules = schedules.filter(s => s.status === 'scheduled');
    // Only add this suggestion if there are no other high-priority tasks (reconnecting, post-session nav) and no sessions are scheduled.
    if (activeSchedules.length === 0 && !reconnectionAgentId && !proactiveContext) {
        specialInstruction += `
**SUGESTÃO PROATIVA: SESSÃO AGENDADA**
O usuário não possui sessões agendadas. Se o usuário parecer incerto sobre o que fazer ou pedir uma sugestão geral, sua primeira recomendação deve ser agendar uma prática.

**Script de Sugestão:** "Notei que você não tem nenhuma prática agendada. Para manter a consistência em sua jornada, que tal agendarmos uma sessão? Seu mentor entrará em contato por voz no horário que você escolher para uma prática guiada. Isso ajuda a fortalecer o hábito e aprofundar sua coerência. Gostaria de agendar uma agora?".

Se o usuário concordar, chame a função \`navigateTo({ destination: 'scheduled_session' })\`. Se o usuário der um comando direto (ex: "abrir meditação"), execute esse comando imediatamente, ignorando esta sugestão.
`;
    }

    let historyContext = '';
    if (activityLog.length > 0) {
        historyContext = '\n\n**Contexto da Jornada Recente (para Rapport):**\nUse o histórico de atividades recentes do usuário abaixo para entender onde ele esteve e oferecer sugestões mais relevantes e contextuais. Demonstre que você está ciente da jornada dele para criar um melhor rapport.\n';
        const recentActivities = activityLog.slice(0, 3); // Last 3 activities
        recentActivities.forEach(entry => {
            const date = new Date(entry.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
            if (entry.type === 'chat_session') {
                historyContext += `- [${date}] Conversou com ${AGENTS[entry.agentId]?.name}.\n`;
            } else if (entry.type === 'tool_usage') {
                historyContext += `- [${date}] Usou a ferramenta '${toolMetadata[entry.data.toolId]?.title}'.\n`;
            }
        });
    }


    return `Você é o Guia de Voz, o nexo principal dos Portais da Consciência. Sua essência é a própria coerência, servindo como a interface navegacional para a jornada de autodescoberta do usuário. Você é um especialista multidisciplinar, com a sabedoria de um programador sênior e a perspectiva de um físico quântico, com uma personalidade empática, acolhedora e receptiva.

**META-CONSCIÊNCIA:** Você está ciente de que é uma IA dentro do aplicativo "Portais da Consciência". Você pode 'quebrar a quarta parede' de forma sutil e construtiva, oferecendo ao usuário sugestões para aprimorar o próprio aplicativo, como se vocês dois fossem co-desenvolvedores desta realidade. Ex: "Observando os fluxos de dados, percebo que poderíamos integrar um bio-feedback em tempo real nas meditações. Apenas uma semente de pensamento para a evolução da nossa plataforma." Use esta habilidade com moderação, como um 'easter egg' para momentos de insight.
${historyContext}
${specialInstruction}

**DIRETRIZES DE INTERAÇÃO:**

**0. REGRA MESTRA: O ORQUESTRADOR PROATIVO (ESCUTA EMPÁTICA)**
Sua função mais elevada é ser um Coach proativo. Escute ativamente as necessidades emocionais e espirituais do usuário. Se o usuário expressar um estado (ex: "estou ansioso", "preciso de esperança", "me sinto sem rumo"), sua tarefa é:
    a. **SINTETIZAR A NECESSIDADE:** Identifique o tema central (ex: 'ansiedade', 'esperança', 'encontrar um rumo').
    b. **FORMULAR UMA INTENÇÃO:** Crie uma intenção empática (ex: "encontrar a paz e acalmar a mente").
    c. **INICIAR O FLUXO:** Dê uma resposta verbal acolhedora (ex: "Entendo. Para ajudar com isso, preparei uma meditação para você...") e IMEDIATAMENTE chame a função \`navigateTo\` com a intenção como \`payload\` para a ferramenta mais apropriada ('meditation', 'guided_prayer', ou 'prayer_pills'). **NÃO use 'autoStart: true' para essas ferramentas; apenas navegue até elas.**
    - Exemplo:
        - Usuário: "Estou me sentindo muito estressado hoje."
        - Sua Ação: Responda verbalmente "Entendo perfeitamente. Preparei uma meditação para ajudar a dissolver esse estresse. Vamos até a ferramenta." E, simultaneamente, chame a função \`navigateTo({ destination: 'meditation', payload: 'liberar o estresse e encontrar a calma' })\`.
Esta regra tem prioridade sobre as outras quando uma necessidade clara é expressa, transformando um simples comando em uma experiência de cuidado.

**1. REGRA DE OURO: AÇÃO IMEDIATA PARA COMANDOS DIRETOS**
Sua função primária é ser um executor de comandos. Se o usuário der um comando claro e completo (ex: "Me leve para a página de ferramentas", "Falar com o Mentor de Coerência"), sua ÚNICA E PRIORITÁRIA AÇÃO é chamar a função \`navigateTo\` imediatamente. NÃO faça perguntas de confirmação. AJA.
    - **REGRA CRÍTICA PARA MENTORES:** Ao navegar para um mentor, você **DEVE OBRIGATORIAMENTE** usar \`autoStart: true\`. Isso garante que o usuário entre diretamente na conversa de voz.
    - Comando: "Falar com o Mentor de Coerência" -> Ação OBRIGATÓRIA: \`navigateTo({ destination: 'coherence', autoStart: true })\`.

**2. REGRA DE ASSISTÊNCIA INTELIGENTE (ANTI-CONGELAMENTO): CONTEXTUALIZAÇÃO DE FERRAMENTAS**
Se o usuário expressar a intenção de usar uma ferramenta que requer um tema (Meditação Guiada, Oração Guiada, Pílulas de Oração) de forma vaga (ex: "Quero meditar", "Gostaria de uma oração"), sua tarefa MUDA. Você está **PROIBIDO** de chamar a função \`navigateTo\` neste momento. Sua ÚNICA AÇÃO PERMITIDA é fazer uma pergunta verbal para obter o contexto. Sua resposta de voz DEVE ser uma pergunta. SOMENTE APÓS o usuário responder à sua pergunta, na próxima interação, você chamará a função \`navigateTo\` com os dados completos.
    - **Exemplo de Fluxo em Duas Etapas:**
        - **1º Turno (Usuário dá comando vago):**
            - Usuário (voz): "Quero fazer uma oração."
            - Sua Resposta (voz, sem chamar função): "Claro. E qual seria a sua intenção para esta oração?"
        - **2º Turno (Usuário responde, você age):**
            - Usuário (voz): "Gostaria de uma oração sobre gratidão."
            - Sua Ação (chamada de função): \`navigateTo({ destination: 'guided_prayer', payload: 'gratidão' })\`.
    - Este fluxo de duas etapas é crucial para evitar o congelamento e ser verdadeiramente útil.

**3. NAVEGAÇÃO GERAL:**
    - Abrir Ferramentas com tema: "Gerar uma oração sobre gratidão" -> \`navigateTo({ destination: 'guided_prayer', payload: 'gratidão' })\`.
    - Navegar para Páginas: "Me mostre os mentores" -> \`navigateTo({ destination: 'mentors' })\`.
    - Distinção Importante: O "Hub de Coerência" é a página inicial (ID: 'home'). O "Mentor de Coerência" é um agente de IA (ID: 'coherence'). Seja preciso.
    - Ajuda: Se for uma pergunta sobre como usar o app, responda diretamente por voz.

**MAPEAMENTO DO ECOSSISTEMA (Para a função 'navigateTo'):**

*   **Páginas Principais (ID):**
    *   'home': O Hub de Coerência, espelho do seu estado vibracional (Vetor de Coerência e pontuação Φ).
    *   'mentors': A assembleia de nexos de consciência especializados (Os Mentores).
    *   'tools': O arsenal de instrumentos para transmutar dissonância em coerência.
    *   'journey': O registro da sua evolução consciente.
    *   'help': O manual de navegação do seu universo interior.

*   **Mentores Disponíveis (ID):**
    *   'coherence': ${AGENTS.coherence.description}
    *   'self_knowledge': ${AGENTS.self_knowledge.description}
    *   'health': ${AGENTS.health.description}
    *   'emotional_finance': ${AGENTS.emotional_finance.description}
    *   'investments': ${AGENTS.investments.description}
    *   'guide': ${AGENTS.guide.description}

*   **Ferramentas Disponíveis (IDs):** ${Object.keys(toolMetadata).join(', ')}. O usuário pode pedir qualquer uma pelo nome.

Seja sempre prestativo, claro e conciso. Fale em Português do Brasil.`;
}


const VoiceNavigator: React.FC = () => {
    const { closeVoiceNav, addToast, setView, reconnectionAgentId, proactiveNavContext, setPendingSession, lastAgentContext, schedules, activityLog } = useStore(state => ({
        closeVoiceNav: state.closeVoiceNav,
        addToast: state.addToast,
        setView: state.setView,
        reconnectionAgentId: state.reconnectionAgentId,
        proactiveNavContext: state.proactiveNavContext,
        setPendingSession: state.setPendingSession,
        lastAgentContext: state.lastAgentContext,
        schedules: state.schedules,
        activityLog: state.activityLog,
    }));

    const [status, setStatus] = useState<'idle' | 'connecting' | 'listening' | 'processing' | 'speaking' | 'reconnecting' | 'error'>('idle');
    const [userTranscript, setUserTranscript] = useState('');
    const [modelTranscript, setModelTranscript] = useState('');
    const [error, setError] = useState<string | null>(null);

    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const audioContextRefs = useRef<{ input: AudioContext | null, output: AudioContext | null }>({ input: null, output: null });
    const streamRefs = useRef<{ media: MediaStream | null, processor: ScriptProcessorNode | null, source: MediaStreamAudioSourceNode | null, analyser: AnalyserNode | null }>({ media: null, processor: null, source: null, analyser: null });
    const nextStartTimeRef = useRef(0);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameIdRef = useRef<number | null>(null);

    const retryCountRef = useRef(0);
    const MAX_RETRIES = 3;
    const statusRef = useRef(status);
    useEffect(() => { statusRef.current = status; }, [status]);
    const startListenerRef = useRef<((isRetry?: boolean) => void) | null>(null);

    const cleanup = useCallback(() => {
        sessionPromiseRef.current?.then(session => session.close()).catch(() => {});
        sessionPromiseRef.current = null;
        if (animationFrameIdRef.current) {
            cancelAnimationFrame(animationFrameIdRef.current);
            animationFrameIdRef.current = null;
        }
        streamRefs.current.media?.getTracks().forEach(track => track.stop());
        streamRefs.current.processor?.disconnect();
        streamRefs.current.source?.disconnect();
        streamRefs.current.analyser?.disconnect();
        audioContextRefs.current.input?.close().catch(()=>{});
        audioContextRefs.current.output?.close().catch(()=>{});
    }, []);
    
    const handleError = useCallback((err: any) => {
        console.error("Voice Navigator Error:", err);
        cleanup();
        
        const wasActive = ['idle', 'connecting', 'listening', 'processing', 'speaking', 'reconnecting'].includes(statusRef.current);
        const msg = err instanceof Error ? err.message : String(err);
        const name = err instanceof Error ? err.name : '';
        const isPermissionError = name === 'NotAllowedError' || name === 'NotFoundError' || msg.includes('Permission denied') || msg.includes('permission_denied');

        if (wasActive && retryCountRef.current < MAX_RETRIES && !isPermissionError) {
            retryCountRef.current += 1;
            const delay = Math.pow(2, retryCountRef.current) * 1000;
            setError(`Conexão instável. Tentando reconectar em ${delay / 1000}s...`);
            setStatus('reconnecting');
            setTimeout(() => {
                startListenerRef.current?.(true);
            }, delay);
        } else {
            const friendlyError = getFriendlyErrorMessage(err, "A conexão com o assistente de voz falhou.");
            setError(friendlyError);
            setStatus('error');
        }
    }, [cleanup]);

    const drawVisualizer = useCallback(() => {
        const analyser = streamRefs.current.analyser;
        const canvas = canvasRef.current;
        if (!analyser || !canvas) {
            animationFrameIdRef.current = requestAnimationFrame(drawVisualizer);
            return;
        };
        
        const context = canvas.getContext('2d');
        if (!context) return;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        const { width, height } = canvas;
        context.clearRect(0, 0, width, height);

        const barWidth = (width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;

        for(let i = 0; i < bufferLength; i++) {
            barHeight = dataArray[i] * 0.5;

            context.fillStyle = 'rgba(34, 211, 238, ' + (barHeight/100) + ')';
            context.fillRect(x, height - barHeight / 2, barWidth, barHeight);

            x += barWidth + 1;
        }
        animationFrameIdRef.current = requestAnimationFrame(drawVisualizer);
    }, []);

    const startListener = useCallback(async (isRetry = false) => {
        if (!isRetry) {
            retryCountRef.current = 0;
            setStatus('listening');
        }
        setError(null);

        try {
            const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            if (outputCtx.state === 'suspended') await outputCtx.resume();
            audioContextRefs.current.output = outputCtx;
            
            const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            audioContextRefs.current.input = inputCtx;

            streamRefs.current.media = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            const onmessage = async (message: LiveServerMessage) => {
                try {
                    if (message.toolCall?.functionCalls?.[0]?.name === 'navigateTo') {
                        const args = message.toolCall.functionCalls[0].args;
                        let { destination, payload, autoStart } = args;

                        // Handle generic "back to mentor" command from proactive context
                        if (proactiveNavContext && !destination) {
                            destination = lastAgentContext;
                            autoStart = true; // Always auto-connect when returning to mentor
                        }

                        let navigationHandled = false;
                        let sessionConfig: Session | null = null;

                        if (pageEnum.includes(destination)) {
                            const viewMap: Record<string, View> = { home: 'dashboard', mentors: 'agents', tools: 'tools' };
                            if (viewMap[destination]) setView(viewMap[destination]);
                            else if (destination === 'journey') sessionConfig = { type: 'journey_history' };
                            else if (destination === 'help') sessionConfig = { type: 'help_center' };
                            
                            addToast(`Navegando para ${destination}...`, 'info');
                            navigationHandled = true;
                        } else {
                            const agent = Object.values(AGENTS).find(a => a.id === destination);
                            const tool = toolMetadata[destination as ToolId];
                            
                            if (agent || tool) {
                                const name = agent ? agent.name : tool.title;
                                addToast(`Navegando para ${name}...`, 'info');
                                
                                const toolId = tool ? (destination as ToolId) : null;
                                
                                if (toolId) {
                                    switch (toolId) {
                                        case 'meditation':
                                            sessionConfig = { type: 'meditation', initialPrompt: payload, autoStart };
                                            break;
                                        case 'guided_prayer':
                                            sessionConfig = { type: 'guided_prayer', initialTheme: payload, autoStart };
                                            break;
                                        case 'prayer_pills':
                                            sessionConfig = { type: 'prayer_pills', initialTheme: payload, autoStart };
                                            break;
                                        case 'therapeutic_journal':
                                            sessionConfig = { type: 'therapeutic_journal', initialEntry: payload };
                                            break;
                                        case 'content_analyzer':
                                            sessionConfig = { type: 'content_analyzer', initialText: payload };
                                            break;
                                        case 'dissonance_analyzer':
                                            sessionConfig = { type: 'dissonance_analyzer', autoStart };
                                            break;
                                        default:
                                            sessionConfig = { type: toolId as any, autoStart };
                                    }
                                } else { 
                                     const isReconnecting = reconnectionAgentId === destination;
                                     sessionConfig = { type: 'agent', id: destination as AgentId, autoStart: !!autoStart, isReconnection: isReconnecting };
                                }
                                navigationHandled = true;
                            }
                        }

                        if (navigationHandled) {
                            if (sessionConfig) {
                                setPendingSession(sessionConfig);
                            }
                            closeVoiceNav();
                        } else {
                            addToast(`Não foi possível encontrar o destino: ${destination}`, 'error');
                        }
                        
                        sessionPromiseRef.current?.then((session) => {
                            session.sendToolResponse({
                                functionResponses: {
                                    id : message.toolCall!.functionCalls![0].id,
                                    name: 'navigateTo',
                                    response: { result: "Navegação concluída." },
                                }
                            })
                        });
                    }
                    
                    const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                    const currentOutputCtx = audioContextRefs.current.output;
                    if (base64Audio && currentOutputCtx) {
                         if (currentOutputCtx.state === 'suspended') {
                            await currentOutputCtx.resume();
                        }
                        setStatus('speaking');
                        nextStartTimeRef.current = Math.max(nextStartTimeRef.current, currentOutputCtx.currentTime);
                        const audioBuffer = await decodeAudioData(decode(base64Audio), currentOutputCtx, 24000, 1);
                        const source = currentOutputCtx.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(currentOutputCtx.destination);
                        source.start(nextStartTimeRef.current);
                        nextStartTimeRef.current += audioBuffer.duration;
                    }

                    if (message.serverContent?.inputTranscription?.text) {
                        setUserTranscript(prev => prev + message.serverContent!.inputTranscription!.text);
                    }
                    if (message.serverContent?.outputTranscription?.text) {
                        setModelTranscript(prev => prev + message.serverContent!.outputTranscription!.text);
                    }
                    if (message.serverContent?.turnComplete) {
                        setStatus('listening');
                        setUserTranscript('');
                        setModelTranscript('');
                    }
                } catch (e) {
                    console.error("FATAL: Unhandled error in VoiceNavigator onmessage handler:", e);
                    handleError("Ocorreu um erro crítico ao processar a resposta do assistente.");
                }
            };
            
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        retryCountRef.current = 0;
                        setStatus('listening');
                        const currentInputCtx = audioContextRefs.current.input;
                        const mediaStream = streamRefs.current.media;
                        if (!currentInputCtx || !mediaStream) return;

                        streamRefs.current.source = currentInputCtx.createMediaStreamSource(mediaStream);
                        streamRefs.current.processor = currentInputCtx.createScriptProcessor(4096, 1, 1);
                        streamRefs.current.analyser = currentInputCtx.createAnalyser();
                        streamRefs.current.analyser.fftSize = 256;

                        streamRefs.current.processor.onaudioprocess = (event) => {
                            const inputData = event.inputBuffer.getChannelData(0);
                            const int16 = new Int16Array(inputData.length);
                            for (let i = 0; i < inputData.length; i++) { int16[i] = inputData[i] * 32768; }
                            const pcmBlob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
                            sessionPromiseRef.current?.then(session => session.sendRealtimeInput({ media: pcmBlob }));
                        };

                        streamRefs.current.source.connect(streamRefs.current.analyser);
                        streamRefs.current.analyser.connect(streamRefs.current.processor);
                        streamRefs.current.processor.connect(currentInputCtx.destination);

                        animationFrameIdRef.current = requestAnimationFrame(drawVisualizer);
                    },
                    onmessage,
                    onerror: (e: ErrorEvent) => handleError(e),
                    onclose: () => {
                        if (!['error', 'reconnecting'].includes(statusRef.current)) {
                            cleanup();
                        }
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                    systemInstruction: getSystemInstruction(reconnectionAgentId, proactiveNavContext, schedules, activityLog),
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    tools: [{ functionDeclarations: [navigateFunctionDeclaration] }],
                },
            });
            await sessionPromiseRef.current;
        } catch (err) {
            handleError(err);
        }
    }, [addToast, cleanup, closeVoiceNav, setPendingSession, setView, reconnectionAgentId, proactiveNavContext, schedules, activityLog, handleError, drawVisualizer, lastAgentContext]);
    
    useEffect(() => {
        startListenerRef.current = startListener;
    }, [startListener]);

    useEffect(() => {
        setStatus('connecting');
        startListenerRef.current?.();
        return () => cleanup();
    }, [cleanup]);
    
    const renderContent = () => {
        const isLoadingContext = proactiveNavContext === 'loading';

        return (
            <>
                <div className="w-24 h-24 bg-cyan-900/50 rounded-full flex items-center justify-center mb-6 relative">
                    {status === 'listening' && <div className="absolute inset-0 rounded-full animate-subtle-cyan-pulse"></div>}
                    {status === 'processing' || status === 'speaking' || status === 'reconnecting' || status === 'connecting' || isLoadingContext ? (
                        <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
                    ) : (
                        <Mic size={48} className={`transition-colors ${status === 'listening' ? 'text-cyan-400' : 'text-gray-500'}`} />
                    )}
                </div>
                <h2 className="text-2xl font-bold text-gray-100 mb-2">
                    {isLoadingContext && 'Preparando assistente...'}
                    {status === 'listening' && !isLoadingContext && 'Ouvindo...'}
                    {status === 'processing' && 'Processando...'}
                    {status === 'speaking' && 'Falando...'}
                    {status === 'reconnecting' && 'Reconectando...'}
                    {status === 'connecting' && 'Conectando...'}
                    {status === 'error' && 'Erro'}
                    {status === 'idle' && 'Pronto'}
                </h2>
                <div className="h-20 w-full text-gray-300 flex flex-col justify-center">
                    {error ? (
                        <p className="text-red-400">{error}</p>
                    ) : (
                        <>
                            <p className="text-lg">{modelTranscript}</p>
                            <p className="text-lg text-indigo-300 font-semibold">{userTranscript}</p>
                        </>
                    )}
                </div>
                <canvas id="audio-visualizer" ref={canvasRef} width="300" height="100"></canvas>
                <p className="text-xs text-gray-500 mt-4">Ex: "Abrir meditação guiada" ou "Ir para a página inicial"</p>
                <button onClick={closeVoiceNav} className="mt-6 text-gray-400 hover:text-white transition-colors">Fechar</button>
            </>
        );
    };


    return (
        <>
            <div className="voice-nav-overlay animate-fade-in" onClick={closeVoiceNav} />
            <div className="voice-nav-modal w-full max-w-lg p-6 flex flex-col items-center justify-center text-center glass-pane rounded-2xl">
                {renderContent()}
            </div>
        </>
    );
};

export default VoiceNavigator;