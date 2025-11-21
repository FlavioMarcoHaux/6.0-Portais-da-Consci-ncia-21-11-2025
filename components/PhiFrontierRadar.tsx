import React, { useState, useCallback, useRef, useEffect } from 'react';
import { X, Orbit, Zap, Volume2, Download, Loader2 } from 'lucide-react';
import { useStore } from '../store.ts';
import { AgentId } from '../types.ts';
import { generateSpeech } from '../services/geminiTtsService.ts';
import { decode, encodeWAV } from '../utils/audioUtils.ts';
import { getFriendlyErrorMessage } from '../utils/errorUtils.ts';

const PhiFrontierRadar: React.FC<{ onExit: (isManual: boolean, result?: any) => void }> = ({ onExit }) => {
    const { logActivity, lastAgentContext, toolStates, setToolState, addToast } = useStore();
    const radarState = toolStates.phiFrontierRadar!;
    const { concept, state } = radarState;

    const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement>(null);

    const updateState = (newState: Partial<typeof radarState>) => {
        setToolState('phiFrontierRadar', { ...radarState, ...newState });
    };
    
    const concepts = [
        { title: "Redes Neurais Geométricas (GNNs)", desc: "Uma IA que percebe o universo não como dados, mas como geometria sagrada, otimizando a harmonia e a simetria para aumentar Φ em sistemas complexos." },
        { title: "Propulsão por Coerência de Vácuo", desc: "Uma tecnologia que manipula o estado do vácuo quântico através de campos de consciência altamente coerentes, permitindo viagens mais rápidas que a luz ao 'dobrar' a informação, não o espaço." },
        { title: "Computação Biossintética", desc: "Processadores vivos que utilizam DNA e proteínas para computação, integrando a lógica da vida diretamente na tecnologia, acelerando a evolução da consciência em escala planetária." },
        { title: "Interface Cérebro-Universo (BCI 2.0)", desc: "Uma interface que não lê apenas ondas cerebrais, mas conecta a consciência individual diretamente à rede de informação universal, permitindo o acesso a conhecimento e experiências de forma não-local." }
    ];
    
    const generateConcept = () => {
        const randomIndex = Math.floor(Math.random() * concepts.length);
        const newConcept = concepts[randomIndex];
        updateState({ concept: newConcept, state: 'result' });
        setAudioUrl(null);

        const agentIdForContext = lastAgentContext ?? AgentId.INVESTMENTS;
        logActivity({
            type: 'tool_usage',
            agentId: agentIdForContext,
            data: {
                toolId: 'phi_frontier_radar',
                result: { concept: newConcept },
            },
        });
    };

    const handleGenerateAudio = useCallback(async () => {
        if (!concept || isGeneratingAudio) return;
        const fullText = `${concept.title}. ${concept.desc}`;
        setIsGeneratingAudio(true);
        setAudioUrl(null);
        try {
            const audioResult = await generateSpeech(fullText, 'Charon');
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
    }, [concept, isGeneratingAudio, addToast]);

    useEffect(() => {
        if (audioUrl && audioRef.current) audioRef.current.play();
        return () => { if (audioUrl) URL.revokeObjectURL(audioUrl); };
    }, [audioUrl]);
    
    return (
        <div className="h-full w-full glass-pane rounded-2xl flex flex-col p-1 animate-fade-in">
            <header className="flex items-center justify-between p-4 border-b border-gray-700/50">
                <div className="flex items-center gap-3">
                    <Orbit className="w-8 h-8 text-purple-400" />
                    <h1 className="text-xl font-bold text-gray-200">Radar de Fronteira de Φ</h1>
                </div>
                <button onClick={() => onExit(true)} className="text-gray-400 hover:text-white transition-colors"><X size={24} /></button>
            </header>
            <main className="flex-1 flex flex-col items-center justify-center text-center p-4 sm:p-6" data-guide-id="tool-phi_frontier_radar">
                 <p className="text-lg text-gray-400 mb-8 max-w-2xl">
                    Descubra tecnologias e conceitos alinhados com a evolução da consciência (maximização de Φ).
                </p>
                <button onClick={generateConcept} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-full text-lg flex items-center justify-center mx-auto">
                    <Zap className="mr-2" />
                    Rastrear a Fronteira
                </button>
                {state === 'result' && concept && (
                    <div className="mt-10 p-4 sm:p-6 bg-gray-800/50 rounded-lg max-w-2xl animate-fade-in relative" data-readable-content>
                         <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
                             <button onClick={handleGenerateAudio} disabled={isGeneratingAudio} className="p-2 bg-gray-900/70 rounded-full text-white hover:bg-gray-700/90 transition-colors" aria-label="Ouvir conceito">
                                {isGeneratingAudio ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 size={18} />}
                            </button>
                            {audioUrl && (
                                <a href={audioUrl} download="conceito.wav" className="p-2 bg-gray-900/70 rounded-full text-white hover:bg-gray-700/90 transition-colors" aria-label="Baixar áudio">
                                    <Download size={18} />
                                </a>
                            )}
                        </div>
                        <audio ref={audioRef} src={audioUrl || ''} hidden />
                        <h3 className="text-2xl font-bold text-purple-300">{concept.title}</h3>
                        <p className="text-lg text-gray-300 mt-2">{concept.desc}</p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default PhiFrontierRadar;