import React from 'react';
import { Home, Users, Wrench, BarChart3, MessageSquare, HelpCircle } from 'lucide-react';
import { useStore } from '../store.ts';
import { AgentId } from '../types.ts';

const NavItem: React.FC<{
  icon: React.ElementType,
  label: string,
  isActive: boolean,
  onClick: () => void,
  guideId?: string,
}> = ({ icon: Icon, label, isActive, onClick, guideId }) => (
  <button 
    onClick={onClick} 
    className={`flex flex-col items-center justify-center w-full py-4 transition-colors duration-200 relative ${isActive ? 'text-indigo-400' : 'text-gray-500 hover:text-gray-200'}`}
    aria-label={label}
    data-guide-id={guideId}
  >
    {isActive && <div className="absolute left-0 top-0 h-full w-1 bg-indigo-400 rounded-r-full"></div>}
    <Icon className="w-8 h-8" strokeWidth={1.5} />
    <span className="text-xs mt-1">{label}</span>
  </button>
);

const Sidebar: React.FC = () => {
  const { activeView, setView, ucs, startSession } = useStore();
  
  return (
    <nav className="w-20 h-screen glass-pane flex flex-col items-center justify-between py-6">
      <div>
        <div className="text-indigo-500 text-center mb-10">
           <BarChart3 className="w-10 h-10 mx-auto" />
           <p className="font-bold text-sm mt-1">P. I. C.</p>
        </div>
        <div className="space-y-4">
            <NavItem icon={Home} label="Início" isActive={activeView === 'dashboard'} onClick={() => setView('dashboard')} />
            <NavItem icon={Users} label="Mentores" isActive={activeView === 'agents'} onClick={() => setView('agents')} guideId="guide-step-2" />
            <NavItem icon={Wrench} label="Ferramentas" isActive={activeView === 'tools'} onClick={() => setView('tools')} />
             <button 
                onClick={() => startSession({ type: 'agent', id: AgentId.SELF_KNOWLEDGE })} 
                className="flex flex-col items-center justify-center w-full py-4 transition-colors duration-200 text-gray-500 hover:text-gray-200"
                aria-label="Conversa ao Vivo"
            >
                <MessageSquare className="w-8 h-8" strokeWidth={1.5} />
                <span className="text-xs mt-1">Conversa</span>
            </button>
             <button 
                onClick={() => startSession({ type: 'help_center' })} 
                className="flex flex-col items-center justify-center w-full py-4 transition-colors duration-200 text-gray-500 hover:text-gray-200"
                aria-label="Ajuda"
            >
                <HelpCircle className="w-8 h-8" strokeWidth={1.5} />
                <span className="text-xs mt-1">Ajuda</span>
            </button>
        </div>
      </div>
      <div className="text-center">
        <p className="text-gray-400 text-xs">Coerência</p>
        <p className="text-3xl font-bold text-indigo-400">{ucs}</p>
      </div>
    </nav>
  );
};

export default Sidebar;
