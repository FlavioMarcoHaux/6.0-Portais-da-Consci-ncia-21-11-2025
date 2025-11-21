// hooks/usePicOrchestrator.ts
import { ActivityLogEntry, CoherenceVector, PicAnalysisResult } from '../types';
import { produce } from 'immer';

const clamp = (value: number) => Math.max(0, Math.min(100, value));

/**
 * The PIC Orchestrator dynamically updates the user's Coherence Vector
 * based on their interactions with tools and mentors.
 * @param entry The activity log entry to process.
 * @param currentVector The current state of the Coherence Vector.
 * @returns An object containing the new Coherence Vector and the coherence points gained.
 */
export const orchestrate = (entry: ActivityLogEntry, currentVector: CoherenceVector): { newVector: CoherenceVector, pointsGained: number } => {
    let pointsGained = 0;

    // SPECIAL CASE: The Wellness Visualizer's purpose is to SET the vector, not modify it.
    if (entry.type === 'tool_usage' && entry.data.toolId === 'wellness_visualizer') {
        const result = entry.data.result as PicAnalysisResult;
        // For this tool, we completely replace the vector.
        // Points are awarded for the action of self-reflection and analysis.
        return { newVector: result.vector, pointsGained: 10 }; 
    }

    const newVector = produce(currentVector, draft => {
        if (entry.type === 'chat_session') {
            const messageCount = entry.data.messages.length;
            if (messageCount > 4) { // Only for meaningful conversations
                const boost = Math.min(Math.floor((messageCount - 2) / 4), 3);
                pointsGained += boost * 2;
                switch (entry.agentId) {
                    case 'coherence':
                        draft.emocional.coerencia = clamp(draft.emocional.coerencia + boost);
                        break;
                    case 'self_knowledge':
                        draft.proposito.coerencia = clamp(draft.proposito.coerencia + boost);
                        draft.mental.coerencia = clamp(draft.mental.coerencia + boost);
                        break;
                    case 'health':
                        draft.somatico.coerencia = clamp(draft.somatico.coerencia + boost);
                        break;
                    case 'emotional_finance':
                        draft.recursos.coerencia = clamp(draft.recursos.coerencia + boost);
                        break;
                }
            }
        } else if (entry.type === 'tool_usage') {
            const { toolId } = entry.data;
            switch (toolId) {
                case 'meditation':
                case 'guided_prayer':
                case 'prayer_pills':
                    pointsGained += 15;
                    draft.emocional.coerencia = clamp(draft.emocional.coerencia + 5);
                    draft.mental.coerencia = clamp(draft.mental.coerencia + 3);
                    draft.emocional.dissonancia = clamp(draft.emocional.dissonancia - 4);
                    draft.mental.dissonancia = clamp(draft.mental.dissonancia - 2);
                    break;
                
                case 'dissonance_analyzer':
                case 'content_analyzer':
                    pointsGained += 20;
                    draft.mental.coerencia = clamp(draft.mental.coerencia + 6);
                    draft.emocional.coerencia = clamp(draft.emocional.coerencia + 4);
                    draft.emocional.dissonancia = clamp(draft.emocional.dissonancia - 5);
                    draft.mental.dissonancia = clamp(draft.mental.dissonancia - 3);
                    break;

                case 'therapeutic_journal':
                    pointsGained += 18;
                    draft.emocional.coerencia = clamp(draft.emocional.coerencia + 4);
                    draft.mental.coerencia = clamp(draft.mental.coerencia + 4);
                    draft.emocional.dissonancia = clamp(draft.emocional.dissonancia - 3);
                    break;

                case 'archetype_journey':
                    pointsGained += 22;
                    draft.proposito.coerencia = clamp(draft.proposito.coerencia + 6);
                    draft.mental.coerencia = clamp(draft.mental.coerencia + 3);
                    break;
                
                case 'quantum_simulator':
                case 'phi_frontier_radar':
                    pointsGained += 15;
                    draft.proposito.coerencia = clamp(draft.proposito.coerencia + 5);
                    draft.mental.coerencia = clamp(draft.mental.coerencia + 5);
                    break;

                case 'verbal_frequency_analysis':
                    const score = entry.data.result.result.coerencia_score; // Score is 1-10
                    pointsGained += score * 2;
                    draft.emocional.coerencia = clamp(draft.emocional.coerencia * 0.8 + (score * 10) * 0.2);
                    draft.emocional.dissonancia = clamp(draft.emocional.dissonancia * 0.8 + (100 - (score * 10)) * 0.2);
                    break;

                case 'voice_therapeutic_journal':
                    const vfaScore = entry.data.result.result.verbalFrequency.coerencia_score; // Score is 1-10
                    pointsGained += (vfaScore * 2) + 10; // Combines VFA points + journal bonus
                    // Blend of VFA and Journal effects
                    draft.emocional.coerencia = clamp(draft.emocional.coerencia * 0.8 + (vfaScore * 10) * 0.2 + 2);
                    draft.emocional.dissonancia = clamp(draft.emocional.dissonancia * 0.8 + (100 - (vfaScore * 10)) * 0.2 - 2);
                    draft.mental.coerencia = clamp(draft.mental.coerencia + 4);
                    break;

                case 'dosh_diagnosis':
                case 'routine_aligner':
                    pointsGained += 15;
                    draft.somatico.coerencia = clamp(draft.somatico.coerencia + 5);
                    draft.somatico.dissonancia = clamp(draft.somatico.dissonancia - 2);
                    break;

                case 'emotional_spending_map':
                    pointsGained += 12;
                    draft.recursos.coerencia = clamp(draft.recursos.coerencia + 4);
                    draft.emocional.coerencia = clamp(draft.emocional.coerencia + 3);
                    draft.recursos.dissonancia = clamp(draft.recursos.dissonancia - 3);
                    break;
                
                case 'belief_resignifier':
                    pointsGained += 16;
                    draft.mental.coerencia = clamp(draft.mental.coerencia + 5);
                    draft.recursos.coerencia = clamp(draft.recursos.coerencia + 4);
                    draft.mental.dissonancia = clamp(draft.mental.dissonancia - 4);
                    break;

                case 'risk_calculator':
                    pointsGained += 10;
                    draft.mental.coerencia = clamp(draft.mental.coerencia + 6);
                    draft.recursos.coerencia = clamp(draft.recursos.coerencia + 2);
                    break;

                case 'scheduled_session':
                    pointsGained += 5;
                    draft.eticoAcao.coerencia = clamp(draft.eticoAcao.coerencia + 2);
                    draft.mental.coerencia = clamp(draft.mental.coerencia + 1); // For planning
                    break;
            }
        }
    });
    
    return { newVector, pointsGained };
};