
import React from 'react';
import { Home, Users, Wrench, BarChart3, Cloud, CloudCheck, CloudOff, Loader2, Compass } from 'lucide-react';
import { useStore } from '../store.ts';
import { COHERENCE_LEVELS } from '../gamification.ts';

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

const CloudSyncStatus: React.FC = () => {
    const { cloudSyncStatus } = useStore();

    const getStatus = () => {
        switch (cloudSyncStatus) {
            case 'syncing':
                return {
                    Icon: Loader2,
                    color: 'text-yellow-400',
                    label: 'Sincronizando...',
                    className: 'animate-spin',
                };
            case 'synced':
                return {
                    Icon: CloudCheck,
                    color: 'text-green-400',
                    label: 'Sincronizado com a nuvem',
                    className: '',
                };
            case 'error':
                return {
                    Icon: CloudOff,
                    color: 'text-red-400',
                    label: 'Erro de sincronização',
                    className: '',
                };
            case 'disabled':
            default:
                return {
                    Icon: Cloud,
                    color: 'text-gray-600',
                    label: 'Sincronização desativada',
                    className: '',
                };
        }
    };

    const { Icon, color, label, className } = getStatus();

    return (
        <div className="text-center" title={label}>
            <Icon className={`w-8 h-8 mx-auto ${color} ${className}`} />
        </div>
    );
};

const Sidebar: React.FC = () => {
  const { activeView, setView, ucs, coherenceLevel } = useStore();
  const currentLevel = COHERENCE_LEVELS[coherenceLevel] || COHERENCE_LEVELS[0];
  
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
            <NavItem icon={Wrench} label="Ferramentas" isActive={activeView === 'tools'} onClick={() => setView('tools')} guideId="guide-tools-nav" />
            <NavItem icon={Compass} label="Missões" isActive={activeView === 'quests'} onClick={() => setView('quests')} />
        </div>
      </div>
      <div className="space-y-4 flex flex-col items-center">
        <CloudSyncStatus />
        
        <div className="text-center">
          <p className="text-gray-400 text-xs">Coerência</p>
          <p className="text-3xl font-bold text-indigo-400">{ucs}</p>
          <p className="text-xs font-semibold" style={{ color: currentLevel.theme.glowColor }}>{currentLevel.name}</p>
        </div>
      </div>
    </nav>
  );
};

export default Sidebar;
