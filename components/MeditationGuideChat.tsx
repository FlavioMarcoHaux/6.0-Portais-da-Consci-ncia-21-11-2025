import React, { useState, useMemo, useEffect } from 'react';
import { X, Sparkles, Moon, Sun, History, Play } from 'lucide-react';
import { useStore } from '../store.ts';
import { CoherenceVector, ActivityLogEntry } from '../types.ts';

interface MeditationGuideChatProps {
    onCreate: (prompt: string, duration: number, style: 'relax' | 'power_up') => void;
    onExit: () => void;
    initialPrompt?: string;
    isSummarizing?: boolean;
    recentMeditations: ActivityLogEntry[];
    onReplay: (replayData: any) => void;
}

const getMeditationSuggestions = (vector: CoherenceVector): string[] => {
    const suggestions: { key: keyof Omit<CoherenceVector, 'alinhamentoPAC'>, value: number, themes: string[] }[] = [
        { key: 'proposito', value: vector.proposito.dissonancia, themes: ["Conexão com meu propósito", "Clareza de direção"] },
        { key: 'mental', value: vector.mental.dissonancia, themes: ["Acalmar a mente", "Foco e presença"] },
        { key: 'relacional', value: vector.relacional.dissonancia, themes: ["Harmonia nos relacionamentos", "Compaixão e empatia"] },
        { key: 'emocional', value: vector.emocional.dissonancia, themes: ["Paz interior e serenidade", "Liberar ansiedade", "Amor-próprio"] },
        { key: 'somatico', value: vector.somatico.dissonancia, themes: ["Relaxamento corporal profundo", "Vitalidade e energia"] },
        { key: 'eticoAcao', value: vector.eticoAcao.dissonancia, themes: ["Integridade e alinhamento", "Agir com consciência"] },
        { key: 'recursos', value: vector.recursos.dissonancia, themes: ["Mentalidade de abundância", "Confiança e segurança"] },
    ];

    const sortedStates = suggestions.sort((a, b) => b.value - a.value); // Sort descending by dissonance
    const finalSuggestions = new Set<string>();

    // Add themes from the two highest-dissonance dimensions
    sortedStates.slice(0, 2).forEach(state => {
        state.themes.forEach(theme => finalSuggestions.add(theme));
    });

    // Ensure we always have at least 4 suggestions
    let i = 2;
    while (finalSuggestions.size < 4 && i < sortedStates.length) {
        sortedStates[i].themes.forEach(theme => finalSuggestions.add(theme));
        i++;
    }

    return Array.from(finalSuggestions).slice(0, 4);
};


const MeditationGuideChat: React.FC<MeditationGuideChatProps> = ({ onCreate, onExit, initialPrompt = '', isSummarizing = false, recentMeditations, onReplay }) => {
    const { coherenceVector } = useStore();
    const [prompt, setPrompt] = useState(initialPrompt);
    const [duration, setDuration] = useState(10);
    const [style, setStyle] = useState<'relax' | 'power_up'>('relax');
    const suggestions = useMemo(() => getMeditationSuggestions(coherenceVector), [coherenceVector]);

    useEffect(() => {
        if (initialPrompt) setPrompt(initialPrompt);
    }, [initialPrompt]);

    return (
        <div className="h-full w-full flex flex-col p-4 sm:p-6 animate-fade-in">
             <header className="w-full flex justify-between items-center mb-6 max-w-2xl mx-auto">
                <h2 className="text-2xl font-bold text-gray-100">Criar Meditação</h2>
                <button onClick={onExit} className="bg-gray-800 hover:bg-gray-700 text-white p-2 rounded-full transition-colors">
                    <X size={24} />
                </button>
            </header>

            <div className="w-full flex-1 overflow-y-auto no-scrollbar max-w-2xl mx-auto">
                <div className="space-y-8">
                    {/* Intention Input */}
                    <div data-guide-id="meditation-prompt">
                        <label className="block text-sm font-medium text-gray-400 mb-2">Qual é a sua intenção?</label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder={isSummarizing ? "O mentor está definindo a melhor intenção para você..." : "Ex: Dormir melhor, focar no trabalho, aliviar ansiedade..."}
                            disabled={isSummarizing}
                            className="w-full bg-gray-800/80 border border-gray-600 rounded-xl p-4 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/80 text-lg min-h-[100px]"
                        />
                        {isSummarizing && <p className="text-indigo-400 text-xs mt-2 animate-pulse">Sintetizando conversa anterior...</p>}
                    </div>

                    {/* Suggestions */}
                    {!isSummarizing && (
                        <div>
                             <p className="text-xs text-gray-500 mb-2">Sugestões baseadas no seu estado atual:</p>
                            <div className="flex flex-wrap gap-2">
                                {suggestions.map(s => (
                                    <button
                                        key={s}
                                        onClick={() => setPrompt(s)}
                                        className="text-xs bg-gray-800 hover:bg-gray-700 text-indigo-300 border border-indigo-500/30 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1"
                                    >
                                        <Sparkles size={12} />
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Controls Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Duration Slider */}
                        <div data-guide-id="meditation-duration">
                            <label className="block text-sm font-medium text-gray-400 mb-2 flex justify-between">
                                <span>Duração</span>
                                <span className="text-white font-bold">{duration} min</span>
                            </label>
                            <input
                                type="range"
                                min="1"
                                max="45"
                                step="1"
                                value={duration}
                                onChange={(e) => setDuration(parseInt(e.target.value))}
                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                            />
                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                                <span>1m</span>
                                <span>45m</span>
                            </div>
                        </div>

                        {/* Style Selector */}
                        <div>
                             <label className="block text-sm font-medium text-gray-400 mb-2">Estilo da Prática</label>
                             <div className="flex bg-gray-800/80 p-1 rounded-lg">
                                 <button
                                    onClick={() => setStyle('relax')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md transition-all ${style === 'relax' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                                 >
                                     <Moon size={16} />
                                     <span className="text-sm font-semibold">Relax</span>
                                 </button>
                                 <button
                                    onClick={() => setStyle('power_up')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md transition-all ${style === 'power_up' ? 'bg-yellow-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                                 >
                                     <Sun size={16} />
                                     <span className="text-sm font-semibold">Power UP</span>
                                 </button>
                             </div>
                        </div>
                    </div>
                    
                    {/* Action Button */}
                    <button
                        data-guide-id="meditation-generate-button"
                        onClick={() => onCreate(prompt, duration, style)}
                        disabled={!prompt.trim() || isSummarizing}
                        className={`w-full bg-gradient-to-r ${style === 'power_up' ? 'from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500' : 'from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500'} disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 px-8 rounded-xl transition-all transform hover:scale-[1.02] shadow-lg flex items-center justify-center gap-3`}
                    >
                        {style === 'power_up' ? <Sun className="animate-pulse" /> : <Sparkles />}
                        {isSummarizing ? 'Aguarde...' : style === 'power_up' ? 'Iniciar Ativação' : 'Iniciar Jornada'}
                    </button>

                     {recentMeditations.length > 0 && (
                        <div className="w-full space-y-4 pt-8 border-t border-gray-700/50">
                             <h3 className="text-lg font-semibold text-gray-300 flex items-center gap-2">
                                <History size={20}/>
                                Meditações Recentes
                             </h3>
                            <div className="space-y-2">
                                {recentMeditations.map(entry => {
                                    if (entry.type !== 'tool_usage') return null;
                                    return (
                                        <button
                                            key={entry.id}
                                            onClick={() => onReplay(entry.data.result)}
                                            className="w-full text-left p-3 bg-gray-800/70 rounded-lg flex items-center justify-between gap-3 cursor-pointer hover:bg-gray-700/90 transition-colors group"
                                        >
                                            <p className="font-semibold text-sm text-gray-200 truncate">{entry.data.result.script.title}</p>
                                            <Play size={18} className="text-indigo-400 flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity" />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MeditationGuideChat;