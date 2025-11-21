import React from 'react';
import { Session } from '../types.ts';
import { AGENTS, toolMetadata } from '../constants.tsx';
import { AgentId } from '../types.ts';
import { useStore } from '../store.ts';

interface ToolCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  themeColor: string;
  onClick: () => void;
  guideId?: string;
}

const ToolCard: React.FC<ToolCardProps> = ({ title, description, icon: Icon, themeColor, onClick, guideId }) => (
  <div
    className="glass-pane rounded-2xl p-4 flex flex-col items-center text-center cursor-pointer transition-all duration-300 hover:bg-gray-800/80 hover:scale-105 hover:border-indigo-400/50"
    onClick={onClick}
    data-guide-id={guideId}
  >
    <Icon className={`w-16 h-16 mb-3 ${themeColor}`} strokeWidth={1.5}/>
    <h3 className="font-bold text-lg text-gray-100">{title}</h3>
    <p className="text-xs text-gray-400 mt-2 flex-1">{description}</p>
  </div>
);

const ToolsDirectory: React.FC = () => {
  const { startSession } = useStore();
  
  const agentOrder: AgentId[] = [
    AgentId.COHERENCE,
    AgentId.SELF_KNOWLEDGE,
    AgentId.HEALTH,
    AgentId.EMOTIONAL_FINANCE,
    AgentId.INVESTMENTS,
  ];
  let isFirstTool = true;

  return (
    <div className="p-4 sm:p-8 animate-fade-in h-full overflow-y-auto no-scrollbar">
      <header className="mb-12 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-100">Ferramentas da Alma</h1>
        <p className="text-lg md:text-xl text-gray-400 mt-2">Instrumentos para cultivar sua coerência interior.</p>
      </header>

      <div className="space-y-12">
        {agentOrder.map(agentId => {
          const agent = AGENTS[agentId];
          if (!agent.tools || agent.tools.length === 0) return null;
          
          return (
            <section key={agent.id}>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-300 mb-6 flex items-center gap-4 border-b border-gray-700 pb-3">
                  <agent.icon className={`w-8 h-8 ${agent.themeColor}`} />
                  Ferramentas de {agent.name}
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                {agent.tools.map(toolId => {
                  const tool = toolMetadata[toolId];
                  if (!tool) return null;

                  let guideId: string | undefined = undefined;
                  if (isFirstTool) {
                      guideId = 'guide-first-tool';
                      isFirstTool = false;
                  }

                  return (
                    <ToolCard 
                      key={toolId} 
                      title={tool.title} 
                      description={tool.description}
                      icon={tool.icon}
                      themeColor={agent.themeColor}
                      onClick={() => startSession({ type: toolId as any })}
                      guideId={guideId}
                    />
                  );
                })}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  );
};

export default ToolsDirectory;