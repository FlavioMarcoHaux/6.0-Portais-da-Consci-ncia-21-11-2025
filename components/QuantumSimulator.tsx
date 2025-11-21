import React, { useState, useCallback, useRef, useEffect } from 'react';
import { getQuantumInterpretation } from '../services/geminiQuantumSimulatorService.ts';
import { X, Eye, Zap, Loader2, Volume2, Download } from 'lucide-react';
import { useStore } from '../store.ts';
import { getFriendlyErrorMessage } from '../utils/errorUtils.ts';
import { AgentId } from '../types.ts';
import { generateSpeech } from '../services/geminiTtsService.ts';
import { decode, encodeWAV } from '../utils/audioUtils.ts';

const QuantumSimulator: React.FC<{ onExit: (isManual: boolean, result?: any) => void }> = ({ onExit }) => {
    const { logActivity, lastAgentContext, toolStates, setToolState, addToast } = useStore();
    const simulatorState = toolStates.quantumSimulator!;
    const { state, outcome, interpretation, error } = simulatorState;

    const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement>(null);

    const updateState = (newState: Partial<typeof simulatorState>) => {
        setToolState('quantumSimulator', { ...simulatorState, ...newState });
    };

    const outcomes = [
        "Realidade A: Uma partícula se manifesta como onda, demonstrando potencial puro.",
        "Realidade B: Uma partícula se manifesta como ponto, uma escolha definida pela observação.",
        "Realidade C: O sistema entra emaranhamento com seu ambiente, criando novas correlações.",
        "Realidade D: Uma flutuação quântica momentânea revela uma possibilidade inesperada.",
    ];

    const observe = async () => {
        updateState({ state: 'observing', error: null, interpretation: null });
        setAudioUrl(null);
        try {
            const randomIndex = Math.floor(Math.random() * outcomes.length);
            const randomOutcome = outcomes[randomIndex];
            
            const interp = await getQuantumInterpretation(randomOutcome);
            
            updateState({ outcome: randomOutcome, interpretation: interp, state: 'collapsed' });

            const agentIdForContext = lastAgentContext ?? AgentId.SELF_KNOWLEDGE;
            logActivity({
                type: 'tool_usage',
                agentId: agentIdForContext,
                data: {
                    toolId: 'quantum_simulator',
                    result: { outcome: randomOutcome, interpretation: interp },
                },
            });
        } catch (err) {
            const friendlyError = getFriendlyErrorMessage(err, 'Falha ao conectar com a consciência universal.');
            updateState({ error: friendlyError, state: 'error' });
        }
    };

    const handleGenerateAudio = useCallback(async () => {
        if (!outcome || !interpretation || isGeneratingAudio) return;
        const fullText = `${outcome}. ${interpretation}`;
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
    }, [outcome, interpretation, isGeneratingAudio, addToast]);

    useEffect(() => {
        if (audioUrl && audioRef.current) audioRef.current.play();
        return () => { if (audioUrl) URL.revokeObjectURL(audioUrl); };
    }, [audioUrl]);

    const reset = () => {
        updateState({ state: 'superposition', outcome: null, interpretation: null, error: null });
        setAudioUrl(null);
    };

    return (
        <div className="h-full w-full glass-pane rounded-2xl flex flex-col p-1 animate-fade-in">
            <header className="flex items-center justify-between p-4 border-b border-gray-700/50">
                <div className="flex items-center gap-3">
                    <Zap className="w-8 h-8 text-purple-400" />
                    <h1 className="text-xl font-bold text-gray-200">Simulador Quântico da Consciência</h1>
                </div>
                <button onClick={() => onExit(true)} className="text-gray-400 hover:text-white transition-colors"><X size={24} /></button>
            </header>
            <main className="flex-1 flex flex-col items-center justify-start text-center p-4 sm:p-6 pt-8 sm:pt-12 overflow-y-auto no-scrollbar" data-guide-id="tool-quantum_simulator">
                 <p className="text-lg text-gray-400 mb-8 max-w-2xl">
                    "A realidade é uma superposição de possibilidades até ser observada. Sua consciência é o catalisador que colapsa a função de onda, cocriando o momento presente."
                </p>
                <div className="w-full max-w-md min-h-[12rem] border-2 border-dashed border-purple-400/50 rounded-lg flex items-center justify-center p-4 relative">
                     {state === 'collapsed' && (
                        <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
                             <button onClick={handleGenerateAudio} disabled={isGeneratingAudio} className="p-2 bg-gray-800/70 rounded-full text-white hover:bg-gray-700/90 transition-colors" aria-label="Ouvir interpretação">
                                {isGeneratingAudio ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 size={18} />}
                            </button>
                            {audioUrl && (
                                <a href={audioUrl} download="interpretacao.wav" className="p-2 bg-gray-800/70 rounded-full text-white hover:bg-gray-700/90 transition-colors" aria-label="Baixar áudio">
                                    <Download size={18} />
                                </a>
                            )}
                        </div>
                    )}
                    <audio ref={audioRef} src={audioUrl || ''} hidden />
                    {state === 'observing' ? (
                        <Loader2 className="w-12 h-12 animate-spin text-purple-400" />
                    ) : state === 'superposition' || state === 'error' ? (
                        <div className="animate-pulse text-purple-300 text-2xl font-mono">
                           |ψ⟩ = α|0⟩ + β|1⟩
                        </div>
                    ) : (
                        <div className="animate-fade-in text-xl text-gray-100 space-y-4" data-readable-content>
                           <p>{outcome}</p>
                           {interpretation && <p className="text-base text-purple-300 italic">"{interpretation}"</p>}
                        </div>
                    )}
                </div>

                <div className="mt-8">
                     {state !== 'collapsed' ? (
                         <button onClick={observe} disabled={state === 'observing'} className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800/50 text-white font-bold py-3 px-8 rounded-full text-lg flex items-center justify-center mx-auto">
                            {state === 'observing' ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Eye className="mr-2" />}
                            {state === 'observing' ? 'Observando...' : 'Observar'}
                        </button>
                    ) : (
                        <button onClick={reset} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-8 rounded-full text-lg flex items-center justify-center mx-auto">
                            Redefinir Superposição
                        </button>
                    )}
                </div>
                 {error && <p className="text-red-400 mt-4">{error}</p>}
                 <p className="text-sm text-gray-500 mt-8 max-w-xl">
                    Este é um modelo conceitual. Cada ato de observação consciente molda ativamente o universo informacional. Qual realidade você escolherá observar agora?
                </p>
            </main>
        </div>
    );
};

export default QuantumSimulator;