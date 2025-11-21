import React from 'react';
import { X, Home, Users, Wrench, BrainCircuit, RefreshCw, ArrowRight, BookOpen, Compass, Gem, TrendingUp, Flame, Zap, Award } from 'lucide-react';
import { useStore } from '../store.ts';
import { AGENTS, toolMetadata } from '../constants.tsx';
import { AgentId } from '../types.ts';
import GuideStartButtonWrapper from './GuideStartButtonWrapper.tsx';

interface HelpCenterProps {
    onExit: (isManual: boolean) => void;
}

const HelpCenter: React.FC<HelpCenterProps> = ({ onExit }) => {
    const { startSession, switchAgent, isListeningModeActive, toggleListeningMode } = useStore();

    const handleStartGuideChat = () => {
        // We use switchAgent because it handles exiting the current session and starting the new one
        switchAgent(AgentId.GUIDE);
    };
    
    const mentors = Object.values(AGENTS).filter(a => a.id !== AgentId.GUIDE);

    return (
        <div className="h-full w-full glass-pane rounded-2xl flex flex-col p-1 animate-fade-in">
            <header className="flex items-center justify-between p-4 border-b border-gray-700/50">
                <div className="flex items-center gap-3">
                    <BookOpen className="w-8 h-8 text-cyan-400" />
                    <h1 className="text-xl font-bold text-gray-200">Central de Ajuda</h1>
                </div>
                <button onClick={() => onExit(true)} className="text-gray-400 hover:text-white transition-colors" aria-label="Exit Help Center">
                    <X size={24} />
                </button>
            </header>
            <main className="flex-1 overflow-y-auto p-8 space-y-16 no-scrollbar">
                
                 {/* Section 2: Interactive Guide */}
                 <section className="text-center bg-gray-900/50 p-8 rounded-2xl border border-cyan-500/30">
                    <h2 className="text-3xl font-bold mb-4 text-gray-100">Precisa de Ajuda?</h2>
                    <p className="text-gray-400 mb-6 max-w-2xl mx-auto">
                        Faça um tour guiado para aprender o fluxo principal do aplicativo ou converse com nosso Guia Interativo para tirar dúvidas específicas.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <GuideStartButtonWrapper tourId="main">
                            <button 
                                className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-8 rounded-full text-lg transition-colors flex items-center gap-2"
                            >
                                <Compass size={20} />
                                Iniciar Tour Guiado
                            </button>
                        </GuideStartButtonWrapper>
                        <button 
                            onClick={handleStartGuideChat}
                            className="bg-transparent hover:bg-indigo-500/10 border border-indigo-500 text-indigo-400 font-bold py-3 px-8 rounded-full text-lg transition-colors"
                        >
                            Conversar com o Guia
                        </button>
                    </div>
                </section>

                {/* Accessibility Section */}
                <section>
                    <h2 className="text-3xl font-bold text-center mb-8 text-gray-100">Acessibilidade</h2>
                    <div className="max-w-2xl mx-auto bg-gray-900/50 p-6 rounded-2xl" data-guide-id="guide-accessibility-toggle">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold text-lg text-gray-100">Modo de Audição</h3>
                                <p className="text-sm text-gray-400 max-w-md">Ative para abrir a navegação por voz com atalhos: `Ctrl+M` (ou `Cmd+M`) no teclado, ou um toque duplo na tela.</p>
                            </div>
                            <button
                                onClick={toggleListeningMode}
                                className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${isListeningModeActive ? 'bg-indigo-600' : 'bg-gray-700'}`}
                                role="switch"
                                aria-checked={isListeningModeActive}
                            >
                                <span
                                    className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${isListeningModeActive ? 'translate-x-6' : 'translate-x-1'}`}
                                />
                            </button>
                        </div>
                    </div>
                </section>

                {/* Section 1: User Journey Flowchart */}
                <section>
                    <h2 className="text-3xl font-bold text-center mb-8 text-gray-100">Sua Jornada de Coerência</h2>
                    <div className="flex flex-col md:flex-row items-center justify-center gap-4 text-center">
                        <div className="flex flex-col items-center p-4 rounded-lg">
                            <Home className="w-12 h-12 text-indigo-400 mb-2" />
                            <h3 className="font-semibold">1. Avaliar</h3>
                            <p className="text-sm text-gray-400">Observe seu Vetor de Coerência</p>
                        </div>
                        <ArrowRight className="w-8 h-8 text-gray-600 hidden md:block" />
                         <div className="flex flex-col items-center p-4 rounded-lg">
                            <Users className="w-12 h-12 text-yellow-400 mb-2" />
                            <h3 className="font-semibold">2. Dialogar</h3>
                            <p className="text-sm text-gray-400">Ganhe clareza com um Mentor</p>
                        </div>
                        <ArrowRight className="w-8 h-8 text-gray-600 hidden md:block" />
                        <div className="flex flex-col items-center p-4 rounded-lg">
                            <Wrench className="w-12 h-12 text-green-400 mb-2" />
                            <h3 className="font-semibold">3. Agir</h3>
                            <p className="text-sm text-gray-400">Use uma Ferramenta para catalisar a mudança</p>
                        </div>
                         <ArrowRight className="w-8 h-8 text-gray-600 hidden md:block" />
                        <div className="flex flex-col items-center p-4 rounded-lg">
                            <BrainCircuit className="w-12 h-12 text-purple-400 mb-2" />
                            <h3 className="font-semibold">4. Integrar</h3>
                            <p className="text-sm text-gray-400">Aplique o insight para evoluir</p>
                        </div>
                        <RefreshCw className="w-8 h-8 text-gray-600 mt-4 md:mt-0" />
                    </div>
                </section>

                {/* Gamification Section */}
                <section>
                  <h2 className="text-3xl font-bold text-center mb-8 text-gray-100">Entendendo sua Jornada (Gamificação)</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
                    <div className="bg-gray-800/50 p-6 rounded-lg">
                      <div className="flex items-center gap-3 mb-2">
                        <Gem className="w-6 h-6 text-green-400" />
                        <h4 className="font-bold text-lg text-gray-200">Pontos de Coerência (PC)</h4>
                      </div>
                      <p className="text-sm text-gray-400">Pense nos PCs como "pontos de experiência" para sua jornada interior. Você os ganha ao interagir com mentores, usar ferramentas e completar missões. Eles medem seu esforço e dedicação.</p>
                    </div>
                    <div className="bg-gray-800/50 p-6 rounded-lg">
                       <div className="flex items-center gap-3 mb-2">
                        <TrendingUp className="w-6 h-6 text-indigo-400" />
                        <h4 className="font-bold text-lg text-gray-200">Níveis de Coerência</h4>
                      </div>
                      <p className="text-sm text-gray-400">Acumular Pontos de Coerência eleva seu Nível, de "Iniciante da Harmonia" a "Mestre da Coerência". Cada nível desbloqueia um novo tema visual para o seu Radar de Coerência, refletindo sua evolução.</p>
                    </div>
                    <div className="bg-gray-800/50 p-6 rounded-lg">
                       <div className="flex items-center gap-3 mb-2">
                        <Compass className="w-6 h-6 text-cyan-400" />
                        <h4 className="font-bold text-lg text-gray-200">Missões de Coerência</h4>
                      </div>
                      <p className="text-sm text-gray-400">São tarefas geradas dinamicamente com base na sua área de maior dissonância. Completá-las foca seu crescimento onde é mais necessário e oferece recompensas em pontos.</p>
                    </div>
                    <div className="bg-gray-800/50 p-6 rounded-lg">
                       <div className="flex items-center gap-3 mb-2">
                        <Flame className="w-6 h-6 text-orange-400" />
                        <h4 className="font-bold text-lg text-gray-200">Sequências (Streaks)</h4>
                      </div>
                      <p className="text-sm text-gray-400">A consistência é chave. Use o aplicativo diariamente para construir e manter sua sequência de prática, fortalecendo o hábito da autoconsciência.</p>
                    </div>
                    <div className="bg-gray-800/50 p-6 rounded-lg">
                       <div className="flex items-center gap-3 mb-2">
                        <Zap className="w-6 h-6 text-yellow-400" />
                        <h4 className="font-bold text-lg text-gray-200">Fluxos de Coerência (Combos)</h4>
                      </div>
                      <p className="text-sm text-gray-400">Usar ferramentas em uma sequência lógica (ex: Diagnóstico → Rotina) dentro de um curto período de tempo ativa um "Fluxo de Coerência", garantindo pontos de bônus.</p>
                    </div>
                    <div className="bg-gray-800/50 p-6 rounded-lg">
                       <div className="flex items-center gap-3 mb-2">
                        <Award className="w-6 h-6 text-amber-400" />
                        <h4 className="font-bold text-lg text-gray-200">Conquistas</h4>
                      </div>
                      <p className="text-sm text-gray-400">Marcos importantes em sua jornada, como completar sua primeira missão ou atingir um alto nível de coerência, são celebrados com conquistas especiais.</p>
                    </div>
                  </div>
                </section>
                
                {/* Section 3: Tools Guide */}
                <section>
                    <h2 className="text-3xl font-bold text-center mb-8 text-gray-100">Guia de Ferramentas</h2>
                     <div className="space-y-12">
                        {mentors.map(agent => (
                            <div key={agent.id}>
                                <h3 className={`text-2xl font-semibold mb-6 flex items-center gap-3 border-b pb-3 ${agent.themeColor} border-gray-700`}>
                                    <agent.icon className="w-8 h-8" />
                                    Ferramentas de {agent.name}
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {agent.tools?.map(toolId => {
                                        const tool = toolMetadata[toolId];
                                        if (!tool) return null;
                                        return (
                                            <div key={toolId} className="bg-gray-800/50 p-4 rounded-lg flex items-start gap-4">
                                                <tool.icon className={`w-8 h-8 flex-shrink-0 mt-1 ${agent.themeColor}`} />
                                                <div>
                                                    <h4 className="font-bold text-gray-200">{tool.title}</h4>
                                                    <p className="text-sm text-gray-400">{tool.description}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

            </main>
        </div>
    );
};

export default HelpCenter;