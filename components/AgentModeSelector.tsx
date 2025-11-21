import React from 'react';
import { Agent } from '../types.ts';
import { useStore } from '../store.ts';
import { X, Mic, MessageSquare } from 'lucide-react';

interface AgentModeSelectorProps {
  agent: Agent;
  onExit: (isManual: boolean) => void;
}

const AgentModeSelector: React.FC<AgentModeSelectorProps> = ({ agent, onExit }) => {
  const { switchAgentMode } = useStore();

  return (
    <div className="h-full w-full glass-pane rounded-2xl flex flex-col p-1 animate-fade-in" data-guide-id="agent-mode-selector">
      <header className="flex items-center justify-between p-4 border-b border-gray-700/50">
        <div className="flex items-center gap-4">
          <agent.icon className={`w-12 h-12 ${agent.themeColor}`} />
          <div>
            <h1 className="text-2xl font-bold">{agent.name}</h1>
            <p className="text-sm text-gray-400">{agent.description}</p>
          </div>
        </div>
        <button onClick={() => onExit(true)} className="text-gray-400 hover:text-white transition-colors">
          <X size={24} />
        </button>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-100 mb-6 sm:mb-8">Como você prefere interagir?</h2>
        <div className="grid grid-cols-2 gap-4 md:gap-8 w-full max-w-4xl">
          {/* Voice Chat Card */}
          <button
            onClick={() => switchAgentMode('voice')}
            className="group glass-pane rounded-2xl p-4 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 hover:bg-gray-800/80 hover:scale-105 hover:border-cyan-400/50"
          >
            <Mic className="w-16 h-16 sm:w-20 sm:h-20 mb-4 text-cyan-400 transition-transform group-hover:scale-110" />
            <h3 className="font-bold text-lg sm:text-2xl text-gray-100">Chat de Voz</h3>
            <p className="text-xs sm:text-base text-gray-400 mt-2">Conversa fluida em tempo real.</p>
          </button>

          {/* Text Chat Card */}
          <button
            onClick={() => switchAgentMode('text')}
            className="group glass-pane rounded-2xl p-4 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 hover:bg-gray-800/80 hover:scale-105 hover:border-indigo-400/50"
          >
            <MessageSquare className="w-16 h-16 sm:w-20 sm:h-20 mb-4 text-indigo-400 transition-transform group-hover:scale-110" />
            <h3 className="font-bold text-lg sm:text-2xl text-gray-100">Chat por Texto</h3>
            <p className="text-xs sm:text-base text-gray-400 mt-2">Interação tradicional e digitada.</p>
          </button>
        </div>
      </main>
    </div>
  );
};

export default AgentModeSelector;
