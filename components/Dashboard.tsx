import React, { useEffect, useState } from 'react';
import { useStore } from '../store.ts';
import { Agent, AgentId } from '../types.ts';
import CoherenceGeometry from './CoherenceGeometry.tsx';
import { AGENTS } from '../constants.tsx';
import FontSizeSelector from './FontSizeSelector.tsx';
import { Compass, Flame, Loader2, ScanText } from 'lucide-react';
import { COHERENCE_LEVELS } from '../gamification.ts';

const AnimatedUcs: React.FC<{ value: number }> = ({ value }) => {
    const [currentValue, setCurrentValue] = useState(0);

    useEffect(() => {
        const startValue = currentValue;
        const range = value - startValue;

        if (range === 0) return;

        const duration = 1000;
        let startTime: number | null = null;
        let animationFrameId: number;

        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeOutProgress = 1 - Math.pow(1 - progress, 3); // Ease-out cubic
            
            setCurrentValue(Math.round(startValue + range * easeOutProgress));

            if (progress < 1) {
                animationFrameId = requestAnimationFrame(animate);
            }
        };

        animationFrameId = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
        // We intentionally don't include `currentValue` in the dependency array
        // to prevent an infinite loop. The effect should only re-run when `value` changes.
    }, [value]);

    return <>{currentValue}</>;
};

const CoherenceQuestWidget: React.FC = () => {
    const { activeQuest, startSession, fetchCoherenceQuest, isLoadingQuest } = useStore();

    useEffect(() => {
        if (!activeQuest && !isLoadingQuest) {
            fetchCoherenceQuest();
        }
    }, [activeQuest, isLoadingQuest, fetchCoherenceQuest]);

    if (isLoadingQuest) {
        return (
            <div className="glass-pane rounded-2xl p-6 flex items-center justify-center gap-4">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                <span className="text-gray-400">Buscando sua próxima missão...</span>
            </div>
        );
    }
    
    if (!activeQuest) {
        return (
             <div className="glass-pane rounded-2xl p-6 text-center">
                <p className="text-gray-500">Nenhuma missão de coerência ativa no momento.</p>
            </div>
        )
    }

    return (
        <div 
            className="glass-pane rounded-2xl p-6 animate-fade-in cursor-pointer group hover:border-cyan-400/50"
            onClick={() => startSession({ type: activeQuest.targetTool })}
        >
             <h3 className="font-bold text-xl mb-2 text-cyan-400 flex items-center gap-2">
                <Compass />
                Missão de Coerência
             </h3>
             <h4 className="font-semibold text-lg">{activeQuest.title}</h4>
             <p className="text-sm text-gray-400 mt-1 transition-colors group-hover:text-gray-200">{activeQuest.description}</p>
        </div>
    );
};

const CoherenceInvestigationWidget: React.FC = () => {
    const { startSession } = useStore();

    return (
        <div 
            className="glass-pane rounded-2xl p-6 animate-fade-in cursor-pointer group hover:border-green-400/50"
            onClick={() => startSession({ type: 'wellness_visualizer' })}
        >
             <h3 className="font-bold text-xl mb-2 text-green-400 flex items-center gap-2">
                <ScanText />
                Investigação de Coerência
             </h3>
             <p className="text-sm text-gray-400 mt-1 transition-colors group-hover:text-gray-200">
                Analise seu estado para saber se você está pronto para "publicar" sua nova versão.
             </p>
        </div>
    );
};


const Dashboard: React.FC = () => {
    const { coherenceVector, ucs, recommendation, recommendationName, startSession, coherenceStreak, coherenceLevel, coherencePoints } = useStore();
    const recommendedAgent = recommendation ? AGENTS[recommendation] : null;
    
    const currentLevel = COHERENCE_LEVELS[coherenceLevel] || COHERENCE_LEVELS[0];
    const nextLevel = COHERENCE_LEVELS[coherenceLevel + 1];
    const progress = nextLevel 
      ? Math.max(0, ((coherencePoints - currentLevel.minPoints) / (nextLevel.minPoints - currentLevel.minPoints)) * 100)
      : 100;

    return (
        <div className="p-4 sm:p-8 animate-fade-in">
            <header className="mb-6">
                 <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-bold text-gray-100">Hub de Coerência</h1>
                        <p className="text-lg md:text-xl text-gray-400 mt-2">Bem-vindo(a) ao seu espaço de alinhamento interior.</p>
                    </div>
                     {coherenceStreak > 0 && (
                        <div className="flex items-center gap-2 glass-pane py-2 px-4 rounded-full">
                            <Flame className="w-6 h-6 text-orange-400" />
                            <span className="font-bold text-xl text-gray-100">{coherenceStreak}</span>
                            <span className="text-sm text-gray-400">dias em sequência</span>
                        </div>
                    )}
                </div>
            </header>
            
            {/* Phi-Flow Bar */}
            <div className="w-full bg-gray-800 rounded-full h-2.5 mb-8">
                <div 
                    className="bg-indigo-600 h-2.5 rounded-full shadow-[0_0_10px_#818cf8]" 
                    style={{ width: `${ucs}%`, transition: 'width 1s ease-in-out' }}
                ></div>
            </div>

            <FontSizeSelector />

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:items-start mt-8">
                <div data-guide-id="guide-step-0" className="lg:col-span-3 glass-pane rounded-2xl p-6 flex items-center justify-center">
                    <CoherenceGeometry vector={coherenceVector} theme={currentLevel.theme} />
                </div>

                <div className="lg:col-span-2 flex flex-col gap-8">
                    <div data-guide-id="guide-step-1" className="glass-pane rounded-2xl p-6 text-center">
                        <p className="text-gray-400 text-lg">Sua Coerência (Φ)</p>
                        <p className="text-6xl font-bold text-indigo-400 my-2">
                             <AnimatedUcs value={ucs} />
                        </p>
                        <div className="mt-4">
                            <p className="text-sm font-bold uppercase tracking-wider" style={{ color: currentLevel.theme.glowColor }}>{currentLevel.name}</p>
                             <div className="w-full bg-gray-700 rounded-full h-1.5 mt-2">
                                <div 
                                    className="bg-indigo-400 h-1.5 rounded-full" 
                                    style={{ width: `${progress}%`, transition: 'width 0.5s ease-out' }}
                                ></div>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                {nextLevel ? `${coherencePoints} / ${nextLevel.minPoints} Φ para o próximo nível` : "Nível Máximo Atingido!"}
                            </p>
                        </div>
                    </div>
                    
                    <CoherenceQuestWidget />

                    <CoherenceInvestigationWidget />

                    {recommendedAgent && (
                        <div className="glass-pane rounded-2xl p-6 animate-fade-in">
                             <h3 className="font-bold text-xl mb-4 text-indigo-400">Recomendação do Dia</h3>
                             <div 
                                className="flex items-center gap-4 cursor-pointer group"
                                onClick={() => startSession({ type: 'agent', id: recommendedAgent.id })}
                             >
                                 <recommendedAgent.icon className={`w-12 h-12 ${recommendedAgent.themeColor} transition-transform group-hover:scale-110`} />
                                 <div>
                                     <h4 className="font-semibold text-lg">{recommendedAgent.name}</h4>
                                     <p className="text-sm text-gray-400">Focar em {recommendationName} pode aumentar sua coerência.</p>
                                 </div>
                             </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;