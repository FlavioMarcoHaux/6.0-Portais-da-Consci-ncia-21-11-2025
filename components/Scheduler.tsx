import React, { useState } from 'react';
import { X, CalendarClock, BrainCircuit, BookText, Pill, Clock } from 'lucide-react';
import { useStore } from '../store.ts';
import { Schedule } from '../types.ts';
import { toolMetadata } from '../constants.tsx';

interface SchedulerProps {
    onExit: (isManual: boolean, result?: any) => void;
}

type Activity = Schedule['activity'];
type Recurrence = Schedule['recurrence'];

const activities: { id: Activity; name: string; icon: React.ElementType }[] = [
    { id: 'meditation', name: 'Meditação Guiada', icon: BrainCircuit },
    { id: 'guided_prayer', name: 'Oração Guiada', icon: BookText },
    { id: 'prayer_pills', name: 'Pílula de Oração', icon: Pill },
];

const dayLabels = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']; // Sun, Mon, Tue...

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

const Scheduler: React.FC<SchedulerProps> = ({ onExit }) => {
    const { addSchedule, schedules } = useStore();
    const [selectedActivity, setSelectedActivity] = useState<Activity>('meditation');
    
    const now = new Date();
    now.setMinutes(now.getMinutes() + 2);

    const defaultDate = now.toISOString().split('T')[0];
    const defaultTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    const [date, setDate] = useState(defaultDate);
    const [time, setTime] = useState(defaultTime);
    const [error, setError] = useState<string | null>(null);

    const [recurrence, setRecurrence] = useState<Recurrence>('none');
    const [customDays, setCustomDays] = useState<Set<number>>(new Set());

    const activeSchedules = schedules.filter(s => s.status === 'scheduled').sort((a, b) => a.time - b.time);

    const handleToggleDay = (day: number) => {
        setCustomDays(prev => {
            const newSet = new Set(prev);
            if (newSet.has(day)) {
                newSet.delete(day);
            } else {
                newSet.add(day);
            }
            return newSet;
        });
    };

    const handleSubmit = () => {
        setError(null);
        if (!date || !time) {
            setError("Por favor, selecione uma data e hora válidas.");
            return;
        }

        const [year, month, day] = date.split('-').map(Number);
        const [hour, minute] = time.split(':').map(Number);
        
        const scheduledTime = new Date(year, month - 1, day, hour, minute);

        if (scheduledTime.getTime() <= Date.now()) {
            setError("Por favor, escolha um horário no futuro.");
            return;
        }

        let recurrenceData: { recurrence: Recurrence; recurrenceDays?: number[] } = {
            recurrence: recurrence,
        };
        
        if (recurrence === 'weekly') {
            recurrenceData.recurrenceDays = [scheduledTime.getDay()];
        } else if (recurrence === 'custom') {
            if (customDays.size === 0) {
                setError("Por favor, selecione pelo menos um dia para a repetição personalizada.");
                return;
            }
            recurrenceData.recurrenceDays = [...customDays].sort((a, b) => a - b);
        }
        
        addSchedule({
            activity: selectedActivity,
            time: scheduledTime.getTime(),
            ...recurrenceData,
        });
    };

    return (
        <div className="h-full w-full glass-pane rounded-2xl flex flex-col p-1 animate-fade-in">
            <header className="flex items-center justify-between p-4 border-b border-gray-700/50">
                <div className="flex items-center gap-3">
                    <CalendarClock className="w-8 h-8 text-yellow-300" />
                    <h1 className="text-xl font-bold text-gray-200">Agendar Sessão de Voz</h1>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={() => onExit(true)} className="text-gray-400 hover:text-white transition-colors" aria-label="Exit Scheduler">
                        <X size={24} />
                    </button>
                </div>
            </header>
            <main className="flex-1 flex flex-col items-center justify-start text-center p-6 overflow-y-auto no-scrollbar" data-guide-id="tool-scheduled_session">
                <div className="max-w-md w-full">
                    <p className="text-lg text-gray-400 mb-8">
                        Seu mentor entrará em contato por voz no horário agendado para iniciar sua prática.
                    </p>

                    <div className="space-y-6">
                        <div>
                            <h3 className="font-semibold text-gray-200 mb-3">1. Escolha a Atividade</h3>
                            <div className="grid grid-cols-3 gap-3">
                                {activities.map(act => (
                                    <button
                                        key={act.id}
                                        onClick={() => setSelectedActivity(act.id)}
                                        className={`p-4 rounded-lg border-2 transition-colors ${selectedActivity === act.id ? 'bg-yellow-800/50 border-yellow-500' : 'bg-gray-800/70 border-gray-700 hover:border-yellow-600/50'}`}
                                    >
                                        <act.icon className={`w-8 h-8 mx-auto mb-2 ${selectedActivity === act.id ? 'text-yellow-400' : 'text-gray-400'}`} />
                                        <span className="text-xs">{act.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                             <h3 className="font-semibold text-gray-200 mb-3">2. Defina a Data e Hora</h3>
                             <div className="flex gap-4">
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full bg-gray-800/80 border border-gray-600 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-yellow-500/80"
                                    min={new Date().toISOString().split('T')[0]}
                                />
                                 <input
                                    type="time"
                                    value={time}
                                    onChange={(e) => setTime(e.target.value)}
                                    className="w-full bg-gray-800/80 border border-gray-600 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-yellow-500/80"
                                />
                             </div>
                        </div>

                        <div>
                            <h3 className="font-semibold text-gray-200 mb-3">3. Repetição</h3>
                            <select onChange={(e) => setRecurrence(e.target.value as Recurrence)} value={recurrence} className="w-full bg-gray-800/80 border border-gray-600 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-yellow-500/80">
                                <option value="none">Não repetir</option>
                                <option value="daily">Todos os dias</option>
                                <option value="weekly">Toda semana</option>
                                <option value="custom">Personalizar</option>
                            </select>
                        </div>

                        {recurrence === 'custom' && (
                             <div className="p-2 bg-gray-900/50 rounded-xl animate-fade-in">
                                <div className="flex justify-center gap-1.5">
                                    {dayLabels.map((label, index) => (
                                        <button
                                            key={index}
                                            onClick={() => handleToggleDay(index)}
                                            className={`w-9 h-9 rounded-full text-xs font-bold transition-colors flex items-center justify-center ${
                                                customDays.has(index)
                                                    ? 'bg-yellow-500 text-black'
                                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                            }`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        {error && <p className="text-red-400 text-sm">{error}</p>}

                        <button
                            onClick={handleSubmit}
                            className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-800/50 disabled:cursor-not-allowed text-black font-bold py-3 px-8 rounded-full transition-colors text-lg"
                        >
                            Agendar Sessão
                        </button>
                    </div>

                    <div className="mt-10 pt-6 border-t border-gray-700/50">
                        <h3 className="text-xl font-semibold text-gray-200 mb-4">Sessões Agendadas</h3>
                        <div className="space-y-3">
                            {activeSchedules.length > 0 ? (
                                activeSchedules.map(schedule => {
                                    const meta = toolMetadata[schedule.activity];
                                    const Icon = meta ? meta.icon : Clock;
                                    return (
                                        <div key={schedule.id} className="bg-gray-800/70 p-4 rounded-lg flex items-center justify-between animate-fade-in">
                                            <div className="flex items-center gap-3 text-left">
                                                <Icon className="w-6 h-6 text-yellow-400 flex-shrink-0" />
                                                <div>
                                                    <p className="font-semibold text-gray-100">{meta ? meta.title : 'Sessão'}</p>
                                                    <p className="text-sm text-gray-400">
                                                        {formatRecurrenceText(schedule)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <p className="text-gray-500">Nenhuma sessão agendada no momento.</p>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Scheduler;
