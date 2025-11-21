import React, { useEffect, useCallback, useState, useRef } from 'react';
import { X, Calculator, ShieldCheck, Loader2, RefreshCw, Volume2, Download } from 'lucide-react';
import { AgentId, Session } from '../types.ts';
import { useStore } from '../store.ts';
import { generateSpeech } from '../services/geminiTtsService.ts';
import { decode, encodeWAV } from '../utils/audioUtils.ts';
import { getFriendlyErrorMessage } from '../utils/errorUtils.ts';


interface RiskCalculatorProps {
    onExit: (isManual: boolean, result?: any) => void;
}

const RiskCalculator: React.FC<RiskCalculatorProps> = ({ onExit }) => {
    const { logActivity, lastAgentContext, currentSession, toolStates, setToolState, addToast } = useStore();
    const calculatorState = toolStates.riskCalculator!;
    const { scenario, analysis, state } = calculatorState;

    const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement>(null);

    const updateState = (newState: Partial<typeof calculatorState>) => {
        setToolState('riskCalculator', { ...calculatorState, ...newState });
    };

    const handleCalculate = useCallback(() => {
        if (!scenario.trim()) return;
        updateState({ state: 'calculating' });
        setAudioUrl(null);
        
        // Mock API call
        setTimeout(() => {
            const newAnalysis = `Análise Lógica para "${scenario}":\n\n- Volatilidade de Mercado: Alta. O ativo está sujeito a flutuações significativas devido a fatores macroeconômicos e sentimento do mercado.\n- Risco Tecnológico: Médio. A tecnologia subjacente é promissora, mas ainda em desenvolvimento, com possíveis vulnerabilidades.\n- Risco Regulatório: Alto. A incerteza regulatória no setor pode impactar negativamente o valor do ativo.\n\nRecomendação: Diversifique a alocação e considere este um investimento de alto risco.`;
            updateState({ analysis: newAnalysis, state: 'result' });

            const agentIdForContext = lastAgentContext ?? AgentId.INVESTMENTS;
            logActivity({
                type: 'tool_usage',
                agentId: agentIdForContext,
                data: {
                    toolId: 'risk_calculator',
                    result: { scenario, analysis: newAnalysis },
                },
            });
        }, 1500);
    }, [scenario, lastAgentContext, logActivity, updateState]);

    useEffect(() => {
        const session = currentSession as Extract<Session, { type: 'risk_calculator' }>;
        if (state === 'config' && session?.initialScenario) {
            updateState({ scenario: session.initialScenario });
            if (session.autoStart) {
                handleCalculate();
            }
        }
    }, [currentSession, state, handleCalculate]);
    
     const handleGenerateAudio = useCallback(async () => {
        if (!analysis || isGeneratingAudio) return;
        setIsGeneratingAudio(true);
        setAudioUrl(null);
        try {
            const audioResult = await generateSpeech(analysis, 'Charon');
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
    }, [analysis, isGeneratingAudio, addToast]);

    useEffect(() => {
        if (audioUrl && audioRef.current) audioRef.current.play();
        return () => { if (audioUrl) URL.revokeObjectURL(audioUrl); };
    }, [audioUrl]);

    const handleReset = () => {
        updateState({ scenario: '', analysis: null, state: 'config' });
        setAudioUrl(null);
    };

    return (
        <div className="h-full w-full glass-pane rounded-2xl flex flex-col p-1 animate-fade-in">
            <header className="flex items-center justify-between p-4 border-b border-gray-700/50">
                <div className="flex items-center gap-3">
                    <Calculator className="w-8 h-8 text-blue-400" />
                    <h1 className="text-xl font-bold text-gray-200">Calculadora de Risco Lógico</h1>
                </div>
                <button onClick={() => onExit(true)} className="text-gray-400 hover:text-white transition-colors"><X size={24} /></button>
            </header>
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 text-center" data-guide-id="tool-risk_calculator">
                <div className="max-w-3xl mx-auto">
                    {state !== 'result' ? (
                        <>
                            <p className="text-lg text-gray-400 mb-6">
                                Descreva um ativo ou cenário de investimento. O sistema fornecerá uma análise fria e lógica dos riscos potenciais.
                            </p>
                            <textarea
                                value={scenario}
                                onChange={(e) => updateState({ scenario: e.target.value })}
                                placeholder="Ex: 'Investir em uma nova criptomoeda de IA'"
                                className="w-full h-24 bg-gray-800/80 border border-gray-600 rounded-xl p-4 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/80 text-lg"
                            />
                            <button onClick={handleCalculate} disabled={!scenario.trim() || state === 'calculating'} className="mt-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800/50 text-white font-bold py-3 px-8 rounded-full text-lg flex items-center justify-center mx-auto">
                                {state === 'calculating' ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ShieldCheck className="mr-2" />}
                                {state === 'calculating' ? 'Analisando...' : 'Analisar Risco'}
                            </button>
                        </>
                    ) : (
                        <div className="animate-fade-in text-left" data-readable-content>
                             <div className="mb-4 p-4 sm:p-6 bg-gray-900/50 rounded-lg">
                                <h3 className="text-sm font-semibold text-gray-400">Cenário Analisado:</h3>
                                <p className="text-lg text-gray-200">"{scenario}"</p>
                            </div>
                            <div className="p-4 sm:p-6 bg-gray-800/50 rounded-lg relative">
                                <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
                                    <button onClick={handleGenerateAudio} disabled={isGeneratingAudio} className="p-2 bg-gray-900/70 rounded-full text-white hover:bg-gray-700/90 transition-colors" aria-label="Ouvir análise">
                                        {isGeneratingAudio ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 size={18} />}
                                    </button>
                                    {audioUrl && (
                                        <a href={audioUrl} download="analise_risco.wav" className="p-2 bg-gray-900/70 rounded-full text-white hover:bg-gray-700/90 transition-colors" aria-label="Baixar áudio">
                                            <Download size={18} />
                                        </a>
                                    )}
                                </div>
                                <audio ref={audioRef} src={audioUrl || ''} hidden />

                                <h3 className="text-sm font-semibold text-blue-300 uppercase tracking-wider mb-2">Análise Lógica de Risco</h3>
                                <p className="text-lg text-blue-200 whitespace-pre-wrap">{analysis}</p>
                            </div>
                            <div className="text-center mt-6 flex justify-center items-center gap-4">
                                <button onClick={handleReset} className="text-blue-400 font-semibold flex items-center gap-2"><RefreshCw size={16} /> Nova Análise</button>
                                <button onClick={() => onExit(false)} className="bg-blue-600 text-white font-bold py-2 px-6 rounded-full">Concluir</button>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default RiskCalculator;