

import React, { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar.tsx';
import Dashboard from './components/Dashboard.tsx';
import AgentDirectory from './components/AgentDirectory.tsx';
import ToolsDirectory from './components/ToolsDirectory.tsx';
import Quests from './components/Quests.tsx';
import AgentRoom from './components/AgentRoom.tsx';
import LiveConversation from './components/LiveConversation.tsx';
import AgentModeSelector from './components/AgentModeSelector.tsx';
import GuidedMeditation from './components/GuidedMeditation.tsx';
import ContentAnalyzer from './components/ContentAnalyzer.tsx';
import GuidedPrayer from './components/GuidedPrayer.tsx';
import PrayerPills from './components/PrayerPills.tsx';
import DissonanceAnalyzer from './components/DissonanceAnalyzer.tsx';
import TherapeuticJournal from './components/TherapeuticJournal.tsx';
import QuantumSimulator from './components/QuantumSimulator.tsx';
import PhiFrontierRadar from './components/PhiFrontierRadar.tsx';
import DoshaDiagnosis from './components/DoshaDiagnosis.tsx';
import WellnessVisualizer from './components/WellnessVisualizer.tsx';
import BeliefResignifier from './components/BeliefResignifier.tsx';
import EmotionalSpendingMap from './components/EmotionalSpendingMap.tsx';
import RiskCalculator from './components/RiskCalculator.tsx';
import ArchetypeJourney from './components/ArchetypeJourney.tsx';
import Toast from './components/Toast.tsx';
import Scheduler from './components/Scheduler.tsx';
import ScheduledSessionHandler from './components/ScheduledSessionHandler.tsx';
import GuidedMeditationVoice from './components/GuidedMeditationVoice.tsx';
import GuidedPrayerVoice from './components/GuidedPrayerVoice.tsx';
import PrayerPillsVoice from './components/PrayerPillsVoice.tsx';
import RoutineAligner from './components/RoutineAligner.tsx';
import HelpCenter from './components/HelpCenter.tsx';
import JourneyHistory from './components/JourneyHistory.tsx';
import InteractiveGuide from './components/InteractiveGuide.tsx'; 
import VoiceNavigator from './components/VoiceNavigator.tsx';
import ActivationListener from './components/ActivationListener.tsx';
import ApiKeySelector from './components/ApiKeySelector.tsx';
import { useStore } from './store.ts';
import { AGENTS, toolMetadata } from './constants.tsx';
import { AgentId } from './types.ts';
import VerbalFrequencyAnalysis from './components/VerbalFrequencyAnalysis.tsx';
import VoiceTherapeuticJournal from './components/VoiceTherapeuticJournal.tsx';
import { useToolGuide } from './hooks/useToolGuide.ts';
import { BookMarked, HelpCircle, Mic, Sparkles, ArrowRight } from 'lucide-react';

const withToolGuide = (Component: React.FC<any>, toolId: any) => {
    const WrappedComponent: React.FC<any> = (props) => {
        useToolGuide(toolId);
        return <Component {...props} />;
    };
    WrappedComponent.displayName = `withToolGuide(${Component.displayName || Component.name || 'Component'})`;
    return WrappedComponent;
};

const GuidedMeditationWithGuide = withToolGuide(GuidedMeditation, 'meditation');
const ContentAnalyzerWithGuide = withToolGuide(ContentAnalyzer, 'content_analyzer');
const GuidedPrayerWithGuide = withToolGuide(GuidedPrayer, 'guided_prayer');
const PrayerPillsWithGuide = withToolGuide(PrayerPills, 'prayer_pills');
const DissonanceAnalyzerWithGuide = withToolGuide(DissonanceAnalyzer, 'dissonance_analyzer');
const TherapeuticJournalWithGuide = withToolGuide(TherapeuticJournal, 'therapeutic_journal');
const QuantumSimulatorWithGuide = withToolGuide(QuantumSimulator, 'quantum_simulator');
const PhiFrontierRadarWithGuide = withToolGuide(PhiFrontierRadar, 'phi_frontier_radar');
const DoshaDiagnosisWithGuide = withToolGuide(DoshaDiagnosis, 'dosh_diagnosis');
const WellnessVisualizerWithGuide = withToolGuide(WellnessVisualizer, 'wellness_visualizer');
const RoutineAlignerWithGuide = withToolGuide(RoutineAligner, 'routine_aligner');
const BeliefResignifierWithGuide = withToolGuide(BeliefResignifier, 'belief_resignifier');
const EmotionalSpendingMapWithGuide = withToolGuide(EmotionalSpendingMap, 'emotional_spending_map');
const RiskCalculatorWithGuide = withToolGuide(RiskCalculator, 'risk_calculator');
const ArchetypeJourneyWithGuide = withToolGuide(ArchetypeJourney, 'archetype_journey');
const VerbalFrequencyAnalysisWithGuide = withToolGuide(VerbalFrequencyAnalysis, 'verbal_frequency_analysis');
const VoiceTherapeuticJournalWithGuide = withToolGuide(VoiceTherapeuticJournal, 'voice_therapeutic_journal');
const SchedulerWithGuide = withToolGuide(Scheduler, 'scheduled_session');


const AuthenticatedContent: React.FC = () => {
    const { 
        currentSession, 
        endSession, 
        toasts, 
        removeToast, 
        startGuide,
        activeView,
        fontSize,
        startSession,
        isVoiceNavOpen,
        openVoiceNav,
        pendingSession,
        setPendingSession,
        completedTours,
        postSessionSuggestion,
        clearPostSessionSuggestion,
        isApiKeyRequired,
        apiKeySelectionCompleted
    } = useStore();
    
    useEffect(() => {
        if (!completedTours.includes('main')) {
            startGuide('main');
        }
    }, [startGuide, completedTours]);

    // Auto-Save on page exit
    useEffect(() => {
        const handleBeforeUnload = () => {
            const { toolStates, logActivity, lastAgentContext } = useStore.getState();

            // Save Guided Meditation
            const meditationState = toolStates.meditation;
            if (meditationState && meditationState.state !== 'config' && meditationState.script && meditationState.generatedAudioParts && meditationState.generatedAudioParts.length > 0) {
                logActivity({
                    type: 'tool_usage',
                    agentId: lastAgentContext ?? AgentId.GUIDE,
                    data: {
                        toolId: 'meditation',
                        result: {
                            prompt: meditationState.prompt,
                            script: meditationState.script,
                            generatedAudioParts: meditationState.generatedAudioParts,
                        },
                    },
                });
            }

            // Save Guided Prayer
            const prayerState = toolStates.guidedPrayer;
            if (prayerState && prayerState.state === 'display' && prayerState.blocks.length > 0 && prayerState.audioDataUrl) {
                logActivity({
                    type: 'tool_usage',
                    agentId: lastAgentContext ?? AgentId.GUIDE,
                    data: {
                        toolId: 'guided_prayer',
                        result: {
                            theme: prayerState.theme,
                            blocks: prayerState.blocks,
                            audioDataUrl: prayerState.audioDataUrl,
                        },
                    },
                });
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, []);

    useEffect(() => {
        const checkSchedulesInterval = setInterval(() => {
            const { currentSession, schedules, handleScheduleCompletion, startSession, addToast } = useStore.getState();
            
            if (currentSession) return;

            const now = Date.now();
            const dueSchedule = schedules.find(s => s.status === 'scheduled' && s.time <= now);
            
            if (dueSchedule) {
                const activityName = toolMetadata[dueSchedule.activity]?.title || 'sessão';
                addToast(`Seu mentor está ligando para a sua ${activityName}.`, 'info');
                startSession({ type: 'scheduled_session_handler', schedule: dueSchedule }, 'voice');
                handleScheduleCompletion(dueSchedule.id);
            }
        }, 5000);

        return () => clearInterval(checkSchedulesInterval);
    }, []);

    useEffect(() => {
        const root = document.documentElement;
        root.classList.remove('font-size-small', 'font-size-normal', 'font-size-large');
        root.classList.add(`font-size-${fontSize}`);
    }, [fontSize]);

    useEffect(() => {
        if (!isVoiceNavOpen && pendingSession) {
            startSession(pendingSession, 'voice');
            setPendingSession(null);
        }
    }, [isVoiceNavOpen, pendingSession, startSession, setPendingSession]);


    const renderView = () => {
        switch (activeView) {
            case 'agents':
                return <AgentDirectory />;
            case 'tools':
                return <ToolsDirectory />;
            case 'quests':
                return <Quests />;
            case 'journey':
                return <JourneyHistory />;
            case 'dashboard':
            default:
                return <Dashboard />;
        }
    };

    const renderSession = () => {
        if (!currentSession) return null;

        const sessionProps = { onExit: (isManual: boolean, result?: any) => endSession(isManual, result) };

        switch (currentSession.type) {
            case 'agent': {
                const agentSession = currentSession;
                const agent = AGENTS[agentSession.id];
                if (!agent) return null;
                if (!agentSession.mode) {
                    return <AgentModeSelector agent={agent} {...sessionProps} />;
                }
                if (agentSession.mode === 'voice') {
                    return <LiveConversation agent={agent} {...sessionProps} autoStart={agentSession.autoStart} />;
                }
                return <AgentRoom agent={agent} {...sessionProps} />;
            }
            case 'meditation':
                return <GuidedMeditationWithGuide {...sessionProps} />;
            case 'content_analyzer':
                return <ContentAnalyzerWithGuide {...sessionProps} />;
            case 'guided_prayer':
                return <GuidedPrayerWithGuide {...sessionProps} />;
            case 'prayer_pills':
                return <PrayerPillsWithGuide {...sessionProps} />;
            case 'dissonance_analyzer':
                return <DissonanceAnalyzerWithGuide {...sessionProps} />;
            case 'therapeutic_journal':
                return <TherapeuticJournalWithGuide {...sessionProps} />;
            case 'quantum_simulator':
                return <QuantumSimulatorWithGuide {...sessionProps} />;
            case 'phi_frontier_radar':
                return <PhiFrontierRadarWithGuide {...sessionProps} />;
            case 'dosh_diagnosis':
                return <DoshaDiagnosisWithGuide {...sessionProps} />;
            case 'wellness_visualizer':
                return <WellnessVisualizerWithGuide {...sessionProps} />;
            case 'routine_aligner':
                return <RoutineAlignerWithGuide {...sessionProps} />;
            case 'belief_resignifier':
                return <BeliefResignifierWithGuide {...sessionProps} />;
            case 'emotional_spending_map':
                return <EmotionalSpendingMapWithGuide {...sessionProps} />;
            case 'risk_calculator':
                return <RiskCalculatorWithGuide {...sessionProps} />;
            case 'archetype_journey':
                return <ArchetypeJourneyWithGuide {...sessionProps} />;
            case 'verbal_frequency_analysis':
                return <VerbalFrequencyAnalysisWithGuide {...sessionProps} />;
            case 'voice_therapeutic_journal':
                return <VoiceTherapeuticJournalWithGuide {...sessionProps} />;
            case 'scheduled_session':
                return <SchedulerWithGuide {...sessionProps} />;
            case 'scheduled_session_handler':
                return <ScheduledSessionHandler schedule={currentSession.schedule} {...sessionProps} />;
             case 'guided_meditation_voice':
                return <GuidedMeditationVoice schedule={currentSession.schedule} {...sessionProps} />;
             case 'guided_prayer_voice':
                return <GuidedPrayerVoice schedule={currentSession.schedule} {...sessionProps} />;
            case 'prayer_pills_voice':
                return <PrayerPillsVoice schedule={currentSession.schedule} {...sessionProps} />;
            case 'help_center':
                return <HelpCenter {...sessionProps} />;
            case 'journey_history':
                return <JourneyHistory />;
            default:
                return null;
        }
    };
    
    const isFooterVisible = ['dashboard', 'agents', 'tools', 'quests', 'journey'].includes(activeView) && !currentSession;

    return (
        <div className="bg-gray-900 text-white font-sans w-screen h-screen flex">
            <Sidebar />

            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                <main className="flex-1 overflow-y-auto relative no-scrollbar">
                    {renderView()}
                </main>
                
                {isFooterVisible && (
                    <footer className="w-full p-2 sm:p-4 glass-pane border-t border-gray-700/50 animate-fade-in grid grid-cols-3 gap-2 sm:gap-4 items-center">
                        <button
                            onClick={() => useStore.getState().setView('journey')}
                            className="text-center bg-gray-800/70 p-3 rounded-lg flex flex-col sm:flex-row items-center justify-center gap-2 cursor-pointer hover:bg-gray-700/90 transition-colors h-full"
                            data-guide-id="guide-my-journey"
                        >
                            <BookMarked className="w-6 h-6 text-cyan-400" />
                            <span className="font-semibold text-xs sm:text-base text-gray-100">Minha Jornada</span>
                        </button>

                         <button
                            onClick={() => startSession({ type: 'help_center' })}
                            className="text-center bg-gray-800/70 p-3 rounded-lg flex flex-col sm:flex-row items-center justify-center gap-2 cursor-pointer hover:bg-gray-700/90 transition-colors h-full"
                        >
                            <HelpCircle className="w-6 h-6 text-cyan-400" />
                            <span className="font-semibold text-xs sm:text-base text-gray-100">Ajuda</span>
                        </button>
                        
                        <button
                            onClick={openVoiceNav}
                            className="text-center bg-cyan-900/50 border border-cyan-500/30 p-3 rounded-lg flex flex-col sm:flex-row items-center justify-center gap-2 cursor-pointer hover:bg-cyan-800/60 transition-colors h-full animate-subtle-cyan-pulse"
                            aria-label="Abrir Guia de Voz"
                        >
                            <Mic className="w-6 h-6 text-cyan-300" />
                            <span className="font-semibold text-xs sm:text-base text-cyan-200">Guia de Voz</span>
                        </button>
                    </footer>
                )}
            </div>
            
            {currentSession && (
                <div className={`fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center transition-opacity duration-300 animate-fade-in`}>
                    <div className="w-full h-full max-w-7xl max-h-[90vh] my-auto">
                         {renderSession()}
                    </div>
                </div>
            )}
            
            {postSessionSuggestion && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in" onClick={clearPostSessionSuggestion}>
                    <div className="glass-pane rounded-2xl w-full max-w-md m-4 p-8 text-center animate-modal-fade-in border border-yellow-500/30" onClick={e => e.stopPropagation()}>
                        <Sparkles className="w-16 h-16 mx-auto text-yellow-400 mb-4" />
                        <h2 className="text-2xl font-bold text-gray-100 mb-4">Próximo Passo na sua Jornada</h2>
                        <p className="text-gray-300 mb-8">{postSessionSuggestion.text}</p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <button
                                onClick={() => {
                                    startSession(postSessionSuggestion.session);
                                    clearPostSessionSuggestion();
                                }}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-full flex items-center justify-center gap-2"
                            >
                                {postSessionSuggestion.buttonText}
                                <ArrowRight size={18} />
                            </button>
                            <button
                                onClick={clearPostSessionSuggestion}
                                className="text-gray-400 font-semibold py-3 px-6 rounded-full hover:bg-gray-700/50"
                            >
                                Agora não
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="fixed top-5 right-5 z-[101] w-full max-w-sm space-y-2">
                {toasts.map(toast => (
                    <Toast key={toast.id} toast={toast} onClose={removeToast} />
                ))}
            </div>

            <InteractiveGuide />

            <ActivationListener />

            {isVoiceNavOpen && <VoiceNavigator />}
            
            {/* Lazy Auth Gate: Only shows if API usage fails */}
            {isApiKeyRequired && <ApiKeySelector onValid={apiKeySelectionCompleted} />}
        </div>
    );
};

const App: React.FC = () => {
    return <AuthenticatedContent />;
};

export default App;