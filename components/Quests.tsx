import React, { useEffect } from 'react';
import { useStore } from '../store.ts';
import { Compass, Loader2, Sparkles, CheckCircle, ArrowRight } from 'lucide-react';
import { toolMetadata } from '../constants.tsx';
import { CoherenceQuest } from '../types.ts';

const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('pt-BR', {
        day: '2-digit', month: 'long', year: 'numeric'
    });
};

const ActiveQuestCard: React.FC<{ quest: CoherenceQuest }> = ({ quest }) => {
    const { startSession } = useStore();
    const tool = toolMetadata[quest.targetTool];
    const ToolIcon = tool.icon;

    return (
        <div className="glass-pane rounded-2xl p-6 animate-fade-in border border-cyan-500/30">
             <h3 className="font-bold text-2xl mb-3 text-cyan-400 flex items-center gap-2">
                <Compass />
                Missão de Coerência Ativa
             </h3>
             <div className="bg-gray-900/50 p-6 rounded-lg text-left">
                <h4 className="font-semibold text-xl text-gray-100">{quest.title}</h4>
                <p className="text-gray-400 mt-2">{quest.description}</p>
                 <button 
                    onClick={() => startSession({ type: quest.targetTool })}
                    className="mt-6 w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-6 rounded-lg transition-colors text-lg flex items-center justify-center gap-3 group"
                >
                    <ToolIcon className="w-6 h-6" />
                    <span>Ir para: {tool.title}</span>
                    <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                </button>
            </div>
        </div>
    );
};

const Quests: React.FC = () => {
    const { activeQuest, isLoadingQuest, fetchCoherenceQuest, completedQuests } = useStore();

    useEffect(() => {
        if (!activeQuest && !isLoadingQuest) {
            fetchCoherenceQuest();
        }
    }, [activeQuest, isLoadingQuest, fetchCoherenceQuest]);

    return (
        <div className="p-4 sm:p-8 animate-fade-in h-full overflow-y-auto no-scrollbar">
            <header className="mb-12 text-center">
                <h1 className="text-4xl md:text-5xl font-bold text-gray-100">Missões de Coerência</h1>
                <p className="text-lg md:text-xl text-gray-400 mt-2">Sua jornada guiada para aumentar a harmonia interior (Φ).</p>
            </header>

            <div className="max-w-4xl mx-auto space-y-16">
                {/* Active Quest Section */}
                <section>
                    {isLoadingQuest ? (
                        <div className="glass-pane rounded-2xl p-8 flex items-center justify-center gap-4">
                            <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                            <span className="text-xl text-gray-400">Buscando sua próxima missão...</span>
                        </div>
                    ) : activeQuest ? (
                        <ActiveQuestCard quest={activeQuest} />
                    ) : (
                        <div className="glass-pane rounded-2xl p-8 text-center">
                            <h3 className="text-2xl font-semibold text-gray-200 mb-4">Nenhuma missão ativa.</h3>
                            <p className="text-gray-400 mb-6">Pronto para o seu próximo passo na jornada da consciência?</p>
                            <button
                                onClick={fetchCoherenceQuest}
                                className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-8 rounded-full text-lg flex items-center justify-center mx-auto"
                            >
                                <Sparkles className="mr-2" />
                                Buscar Nova Missão
                            </button>
                        </div>
                    )}
                </section>
                
                {/* Completed Quests Section */}
                {completedQuests.length > 0 && (
                     <section>
                        <h2 className="text-3xl font-bold text-center mb-8 text-gray-100">Histórico de Missões</h2>
                         <div className="space-y-4">
                            {completedQuests.map(quest => (
                                <div key={quest.id} className="glass-pane rounded-xl p-4 flex items-center justify-between animate-fade-in">
                                    <div className="flex items-center gap-4">
                                        <CheckCircle className="w-8 h-8 text-green-500 flex-shrink-0" />
                                        <div>
                                            <h4 className="font-semibold text-lg text-gray-200">{quest.title}</h4>
                                            <p className="text-sm text-gray-500">{quest.description}</p>
                                        </div>
                                    </div>
                                    <span className="text-sm text-gray-400 whitespace-nowrap">{quest.completionTimestamp ? formatDate(quest.completionTimestamp) : ''}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
};

export default Quests;