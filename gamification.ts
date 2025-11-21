// gamification.ts
import { CoherenceLevel, Achievement } from './types.ts';
import { Award, Flame, Zap, BrainCircuit } from 'lucide-react';

export const COHERENCE_LEVELS: CoherenceLevel[] = [
    {
        level: 0,
        name: 'Iniciante da Harmonia',
        minPoints: 0,
        theme: {
            coherenceFill: 'rgba(79, 70, 229, 0.4)',
            dissonanceStroke: '#DB2777',
            glowColor: 'rgba(79, 70, 229, 0.4)',
        }
    },
    {
        level: 1,
        name: 'Praticante Focado',
        minPoints: 100,
        theme: {
            coherenceFill: 'rgba(56, 189, 248, 0.4)', // sky-400
            dissonanceStroke: '#F97316', // orange-500
            glowColor: 'rgba(56, 189, 248, 0.5)',
        }
    },
    {
        level: 2,
        name: 'Cultivador da Paz',
        minPoints: 250,
        theme: {
            coherenceFill: 'rgba(16, 185, 129, 0.4)', // emerald-500
            dissonanceStroke: '#EF4444', // red-500
            glowColor: 'rgba(16, 185, 129, 0.5)',
        }
    },
    {
        level: 3,
        name: 'Arquiteto do Eu',
        minPoints: 500,
        theme: {
            coherenceFill: 'rgba(217, 70, 239, 0.4)', // fuchsia-500
            dissonanceStroke: '#0EA5E9', // sky-500
            glowColor: 'rgba(217, 70, 239, 0.5)',
        }
    },
    {
        level: 4,
        name: 'Mestre da Coerência',
        minPoints: 1000,
        theme: {
            coherenceFill: 'rgba(253, 224, 71, 0.4)', // yellow-300
            dissonanceStroke: '#8B5CF6', // violet-500
            glowColor: 'rgba(253, 224, 71, 0.5)',
        }
    }
];

export const ACHIEVEMENTS: Record<string, Achievement> = {
    'first_quest': {
        id: 'first_quest',
        name: 'Primeira Missão',
        description: 'Você completou sua primeira Missão de Coerência!',
        icon: Award,
    },
    'streak_7': {
        id: 'streak_7',
        name: 'Ritmo Consistente',
        description: 'Manteve uma sequência de prática por 7 dias seguidos.',
        icon: Flame,
    },
    'combo_master_10': {
        id: 'combo_master_10',
        name: 'Mestre dos Fluxos',
        description: 'Executou 10 Fluxos de Coerência (combos).',
        icon: Zap,
    },
    'high_phi_90': {
        id: 'high_phi_90',
        name: 'Pico de Coerência',
        description: 'Alcançou uma pontuação de Coerência (Φ) de 90 ou mais.',
        icon: BrainCircuit,
    }
};