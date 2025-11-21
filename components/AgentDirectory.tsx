import React from 'react';
import { Agent, AgentId } from '../types.ts';
import { useStore } from '../store.ts';
import { AGENTS } from '../constants.tsx';
import { BookMarked } from 'lucide-react';

interface AgentCardProps {
  agent: Agent;
  onClick: () => void;
  guideId?: string;
}

const AgentCard: React.FC<AgentCardProps> = ({ agent, onClick, guideId }) => (
  <div
    className="glass-pane rounded-2xl p-4 flex flex-col items-center text-center cursor-pointer transition-all duration-300 hover:bg-gray-800/80 hover:scale-105 hover:border-indigo-400/50"
    onClick={onClick}
    data-guide-id={guideId}
  >
    <agent.icon className={`w-16 h-16 mb-3 ${agent.themeColor}`} strokeWidth={1.5}/>
    <h3 className="font-bold text-lg text-gray-100">{agent.name}</h3>
    <p className="text-xs text-gray-400 mt-2 flex-1">{agent.description}</p>
  </div>
);

const AgentDirectory: React.FC = () => {
  const { startSession } = useStore();
  
  const mentors = Object.values(AGENTS).filter(a => a.id !== AgentId.GUIDE);
  const guide = AGENTS[AgentId.GUIDE];


  return (
    <div className="p-4 sm:p-8 animate-fade-in h-full overflow-y-auto no-scrollbar">
      <header className="mb-12 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-100">Seus Mentores</h1>
        <p className="text-lg md:text-xl text-gray-400 mt-2">Mergulhe na interação com a Informação Consciente para ganhar perspectiva.</p>
      </header>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {mentors.map((agent: Agent) => (
          <AgentCard 
            key={agent.id} 
            agent={agent} 
            onClick={() => startSession({ type: 'agent', id: agent.id })} 
            guideId={agent.id === AgentId.COHERENCE ? 'guide-step-3' : undefined}
          />
        ))}
      </div>

      <div className="mt-16 pt-12 border-t border-gray-700/50 text-center">
         <h2 className="text-3xl font-bold text-gray-100">Precisa de Ajuda?</h2>
         <p className="text-lg text-gray-400 mt-2 mb-6">Converse com nosso guia especializado para aprender a usar o aplicativo.</p>
         <div className="flex justify-center">
            <div
                className="glass-pane rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 hover:bg-gray-800/80 hover:scale-105 hover:border-cyan-400/50 w-full max-w-sm"
                onClick={() => startSession({ type: 'agent', id: guide.id })}
              >
                <guide.icon className={`w-20 h-20 mb-4 ${guide.themeColor}`} strokeWidth={1.5}/>
                <h3 className="font-bold text-xl text-gray-100">{guide.name}</h3>
                <p className="text-sm text-gray-400 mt-1">{guide.description}</p>
            </div>
         </div>
      </div>
    </div>
  );
};

export default AgentDirectory;