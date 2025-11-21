import React from 'react';
import { ActivityLogEntry, Message, Schedule } from '../types.ts';
import { AGENTS, toolMetadata } from '../constants.tsx';
import { X, ArrowRight } from 'lucide-react';
import { useStore } from '../store.ts';

interface JourneyDetailModalProps {
    entry: ActivityLogEntry;
    onClose: () => void;
}

const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('pt-BR', {
        day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
};

const formatRecurrenceText = (schedule: Schedule) => {
    const timeStr = new Date(schedule.time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const shortDayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    switch (schedule.recurrence) {
        case 'daily': return `Todos os dias às ${timeStr}`;
        case 'weekly': return `Toda ${dayNames[new Date(schedule.time).getDay()]} às ${timeStr}`;
        case 'custom':
            if (!schedule.recurrenceDays?.length) return `Horário agendado`;
            const daysStr = schedule.recurrenceDays.map(d => shortDayNames[d]).join(', ');
            return `Às ${daysStr} às ${timeStr}`;
        default:
            return new Date(schedule.time).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
};

// Simplified markdown renderer for chat history
const markdownToHtml = (text: string) => {
    if (!text) return { __html: '' };
    const html = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br />');
    return { __html: html };
};

const RenderContent: React.FC<{ entry: ActivityLogEntry, closeModal: () => void }> = ({ entry, closeModal }) => {
    const agent = AGENTS[entry.agentId];
    const { startSession } = useStore();

    if (entry.type === 'chat_session') {
        return (
            <div className="space-y-4">
                {entry.data.messages.map((message) => (
                    <div key={message.id} className={`flex items-start gap-3 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {message.sender === 'agent' && <agent.icon className={`w-6 h-6 ${agent.themeColor} flex-shrink-0 mt-1`} />}
                        <div className={`max-w-md px-3 py-2 rounded-xl text-sm ${message.sender === 'user' ? 'bg-indigo-700 text-white rounded-br-none' : 'bg-gray-700 text-gray-200 rounded-bl-none'}`}>
                            <div dangerouslySetInnerHTML={markdownToHtml(message.text)} />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    // Handle tool usage
    const { toolId, result } = entry.data;

    switch (toolId) {
        case 'meditation': {
            const { script, generatedAudioParts, prompt } = result;
            const canReplay = script && generatedAudioParts && generatedAudioParts.length > 0;

            const handleReplay = () => {
                if (canReplay) {
                    startSession({
                        type: 'meditation',
                        replayData: {
                            script,
                            generatedAudioParts,
                        }
                    });
                    closeModal();
                }
            };
            
            return (
                <div className="space-y-4">
                    <h3 className="font-bold text-lg text-gray-100">{script.title}</h3>
                    {canReplay && (
                        <button 
                            onClick={handleReplay}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 group transition-colors"
                        >
                            Reouvir Meditação <ArrowRight size={18} className="transition-transform group-hover:translate-x-1"/>
                        </button>
                    )}
                    <div className="p-3 bg-gray-900/50 rounded-lg">
                        <p className="text-sm text-gray-400">Intenção original: "{prompt}"</p>
                    </div>
                </div>
            );
        }
        case 'guided_prayer': {
            const { theme, blocks, audioDataUrl } = result;
            const canReplay = blocks && audioDataUrl;

            const handleReplay = () => {
                if (canReplay) {
                    startSession({
                        type: 'guided_prayer',
                        replayData: { theme, blocks, audioDataUrl }
                    });
                    closeModal();
                }
            };
            const prayerText = result.prayerText || blocks?.map((b: any) => b.text).join('\n\n');

            return (
                <div className="space-y-4">
                    <h3 className="font-bold text-lg text-gray-100">Intenção: "{theme}"</h3>
                    
                    {canReplay && (
                        <button 
                            onClick={handleReplay}
                            className="w-full bg-yellow-600 hover:bg-yellow-700 text-black font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 group transition-colors"
                        >
                            Reouvir Oração <ArrowRight size={18} className="transition-transform group-hover:translate-x-1"/>
                        </button>
                    )}
                    
                    <p className="whitespace-pre-wrap p-4 bg-gray-900/50 rounded-lg max-h-64 overflow-y-auto">{prayerText}</p>
                    
                    {!canReplay && (
                         <div className="p-3 bg-gray-900/50 rounded-lg">
                            <p className="text-sm text-gray-400">Esta oração foi registrada antes da funcionalidade de replay e não pode ser ouvida novamente.</p>
                        </div>
                    )}
                </div>
            );
        }
        case 'prayer_pills':
             return (
                <div className="space-y-4">
                    <h3 className="font-bold text-lg text-gray-100">Intenção: "{result.theme}"</h3>
                    <p className="whitespace-pre-wrap p-4 bg-gray-900/50 rounded-lg">{result.pill}</p>
                </div>
            );
        case 'dissonance_analyzer':
             return (
                <div className="space-y-3">
                    <div className="p-3 bg-gray-900/50 rounded-lg"><h4 className="font-semibold text-gray-400">Tema:</h4><p>{result.result.tema}</p></div>
                    <div className="p-3 bg-gray-900/50 rounded-lg"><h4 className="font-semibold text-gray-400">Padrão:</h4><p>{result.result.padrao}</p></div>
                    <div className="p-3 bg-gray-900/50 rounded-lg"><h4 className="font-semibold text-gray-400">Insight:</h4><p>{result.result.insight}</p></div>
                </div>
            );
        case 'therapeutic_journal':
             return (
                <div className="space-y-3">
                    <div className="p-3 bg-gray-900/50 rounded-lg"><h4 className="font-semibold text-gray-400">Sua Reflexão:</h4><p className="whitespace-pre-wrap">{result.entry.entry}</p></div>
                    <div className="p-3 bg-gray-900/50 rounded-lg"><h4 className="font-semibold text-gray-400">Observação:</h4><p>{result.entry.feedback.observacao}</p></div>
                    <div className="p-3 bg-gray-900/50 rounded-lg"><h4 className="font-semibold text-gray-400">Dissonância:</h4><p>{result.entry.feedback.dissonancia}</p></div>
                    <div className="p-3 bg-gray-900/50 rounded-lg"><h4 className="font-semibold text-gray-400">Sugestão:</h4><p>{result.entry.feedback.sugestao}</p></div>
                </div>
            );
        case 'archetype_journey':
            const journeyResult = result.result; // This is the ArchetypeAnalysisResult
            if (!journeyResult || !journeyResult.lente) { // Check for new structure
                // Fallback for old data structure if necessary
                return <p>Visualização para este formato de dados antigo não é suportada.</p>;
            }
            return (
                 <div className="space-y-3">
                    <div className="p-3 bg-gray-900/50 rounded-lg"><h4 className="font-semibold text-gray-400">Sua Narrativa:</h4><p className="whitespace-pre-wrap italic">"{result.narrative}"</p></div>
                    <div className="p-3 bg-gray-900/50 rounded-lg"><h4 className="font-semibold text-gray-400">O Desafio ({journeyResult.lente.title}):</h4><p>{journeyResult.lente.text}</p></div>
                    <div className="p-3 bg-gray-900/50 rounded-lg"><h4 className="font-semibold text-gray-400">A Jornada ({journeyResult.jornada.title}):</h4><p>{journeyResult.jornada.text}</p></div>
                    <div className="p-3 bg-gray-900/50 rounded-lg"><h4 className="font-semibold text-gray-400">O Potencial ({journeyResult.potencial.title}):</h4><p>{journeyResult.potencial.text}</p></div>
                    <div className="p-3 bg-indigo-900/50 rounded-lg"><h4 className="font-semibold text-indigo-300">Ação Sugerida:</h4><p>{journeyResult.acao.buttonText}</p></div>
                </div>
            );
         case 'verbal_frequency_analysis':
            return (
                <div className="space-y-3">
                    <div className="p-3 bg-gray-900/50 rounded-lg"><h4 className="font-semibold text-gray-400">Frequência Detectada:</h4><p>{result.result.frequencia_detectada} (Coerência: {result.result.coerencia_score}/10)</p></div>
                    <div className="p-3 bg-gray-900/50 rounded-lg"><h4 className="font-semibold text-gray-400">Insight:</h4><p>{result.result.insight_imediato}</p></div>
                    <div className="p-3 bg-gray-900/50 rounded-lg"><h4 className="font-semibold text-gray-400">Ação Recomendada:</h4><p>{result.result.acao_pac_recomendada}</p></div>
                </div>
            );
        case 'content_analyzer':
            return (
                 <div className="space-y-3">
                    {result.text && <div className="p-3 bg-gray-900/50 rounded-lg"><h4 className="font-semibold text-gray-400">Texto Analisado:</h4><p className="whitespace-pre-wrap">{result.text}</p></div>}
                    <div className="p-3 bg-gray-900/50 rounded-lg"><h4 className="font-semibold text-gray-400">Análise:</h4><p className="whitespace-pre-wrap">{result.result}</p></div>
                </div>
            );
        case 'dosh_diagnosis':
        case 'routine_aligner':
             return (
                <div className="space-y-4">
                    {(result.messages as Message[]).map((message) => (
                        <div key={message.id} className={`flex items-start gap-3 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {message.sender === 'agent' && <agent.icon className={`w-6 h-6 ${agent.themeColor} flex-shrink-0 mt-1`} />}
                            <div className={`max-w-md px-3 py-2 rounded-xl text-sm ${message.sender === 'user' ? 'bg-indigo-700 text-white rounded-br-none' : 'bg-gray-700 text-gray-200 rounded-bl-none'}`}>
                                <div dangerouslySetInnerHTML={markdownToHtml(message.text)} />
                            </div>
                        </div>
                    ))}
                </div>
            );
        case 'quantum_simulator':
            return (
                <div className="space-y-3">
                    <div className="p-3 bg-gray-900/50 rounded-lg"><h4 className="font-semibold text-gray-400">Resultado Observado:</h4><p>{result.outcome}</p></div>
                    <div className="p-3 bg-gray-900/50 rounded-lg"><h4 className="font-semibold text-gray-400">Interpretação:</h4><p className="italic">"{result.interpretation}"</p></div>
                </div>
            );
        case 'phi_frontier_radar':
            return (
                <div className="p-3 bg-gray-900/50 rounded-lg">
                    <h4 className="font-semibold text-lg text-gray-200">{result.concept.title}</h4>
                    <p className="mt-1">{result.concept.desc}</p>
                </div>
            );
        case 'wellness_visualizer':
             return (
                <div className="p-3 bg-gray-900/50 rounded-lg">
                    <h4 className="font-semibold text-lg text-gray-200">Resumo da Análise</h4>
                    <p className="mt-1 whitespace-pre-wrap">{result.summary}</p>
                </div>
            );
        case 'belief_resignifier':
            return (
                <div className="space-y-3">
                    <div className="p-3 bg-gray-900/50 rounded-lg"><h4 className="font-semibold text-gray-400">Crença Limitante:</h4><p>"{result.belief}"</p></div>
                    <div className="p-3 bg-gray-900/50 rounded-lg"><h4 className="font-semibold text-gray-400">Perspectiva de Poder:</h4><p className="italic">"{result.reframed}"</p></div>
                </div>
            );
        case 'risk_calculator':
            return (
                <div className="space-y-3">
                    <div className="p-3 bg-gray-900/50 rounded-lg"><h4 className="font-semibold text-gray-400">Cenário Analisado:</h4><p>"{result.scenario}"</p></div>
                    <div className="p-3 bg-gray-900/50 rounded-lg"><h4 className="font-semibold text-gray-400">Análise Lógica:</h4><p className="whitespace-pre-wrap">{result.analysis}</p></div>
                </div>
            );
        case 'scheduled_session':
             return (
                <div className="p-3 bg-gray-900/50 rounded-lg">
                     <h4 className="font-semibold text-lg text-gray-200">Sessão Agendada</h4>
                     <p className="mt-1">Atividade: <span className="font-semibold">{toolMetadata[result.schedule.activity]?.title}</span></p>
                     <p className="mt-1">Horário: <span className="font-semibold">{formatRecurrenceText(result.schedule)}</span></p>
                </div>
             );
        default:
            return <p>Visualização para esta ferramenta ainda não implementada.</p>;
    }
};


const JourneyDetailModal: React.FC<JourneyDetailModalProps> = ({ entry, onClose }) => {
    const agent = AGENTS[entry.agentId];
    let title: string;
    if (entry.type === 'chat_session') {
        title = `Conversa com ${agent.name}`;
    } else if (entry.data.toolId === 'archetype_journey' && entry.data.result?.result?.lente?.title) {
        title = `Jornada: ${entry.data.result.result.lente.title}`;
    } else {
        title = `Ferramenta: ${toolMetadata[entry.data.toolId]?.title || 'Desconhecida'}`;
    }

    const Icon = entry.type === 'chat_session' 
        ? agent.icon 
        : toolMetadata[entry.data.toolId]?.icon || agent.icon;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div
                className="glass-pane rounded-2xl w-full max-w-2xl m-4 flex flex-col overflow-hidden animate-fade-in border border-gray-700/50 max-h-[85vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex items-center justify-between p-4 border-b border-gray-700/50">
                    <div className="flex items-center gap-3">
                        <Icon className={`w-7 h-7 ${agent.themeColor}`} />
                        <div>
                            <h2 className="text-xl font-bold text-gray-100">{title}</h2>
                            <p className="text-xs text-gray-400">{formatDate(entry.timestamp)}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><X size={24} /></button>
                </header>
                <main className="p-6 space-y-6 overflow-y-auto flex-1 min-h-0 no-scrollbar" data-readable-content>
                    <RenderContent entry={entry} closeModal={onClose} />
                </main>
            </div>
        </div>
    );
};

export default JourneyDetailModal;