import React from 'react';

/**
 * Enum for unique agent identifiers.
 */
export enum AgentId {
  COHERENCE = 'coherence',
  SELF_KNOWLEDGE = 'self_knowledge',
  HEALTH = 'health',
  EMOTIONAL_FINANCE = 'emotional_finance',
  INVESTMENTS = 'investments',
  GUIDE = 'guide',
}

/**
 * Represents the IDs for the available tools.
 */
export type ToolId = 
  | 'meditation' 
  | 'content_analyzer' 
  | 'guided_prayer' 
  | 'prayer_pills' 
  | 'dissonance_analyzer'
  | 'therapeutic_journal'
  | 'quantum_simulator'
  | 'phi_frontier_radar'
  | 'dosh_diagnosis'
  | 'wellness_visualizer'
  | 'belief_resignifier'
  | 'emotional_spending_map'
  | 'risk_calculator'
  | 'archetype_journey'
  | 'verbal_frequency_analysis'
  | 'routine_aligner'
  | 'scheduled_session'
  | 'voice_therapeutic_journal';

/**
 * Represents the structure of an AI agent's persona.
 */
export interface Agent {
  id: AgentId;
  name: string;
  description: string;
  persona?: string;
  themeColor: string;
  icon: React.ElementType;
  tools?: ToolId[];
  initialMessage?: string;
}

/**
 * Represents a state within a dimension, measuring coherence and dissonance.
 */
interface DimensionState {
  coerencia: number;  // Harmony, flow, high-Φ states (0-100)
  dissonancia: number; // Conflict, chaos, low-Φ states (0-100)
}

/**
 * Defines the user's state across 7 dimensions of coherence based on the PIC.
 * This new structure provides a deeper, dualistic view of each life area.
 */
export interface CoherenceVector {
  alinhamentoPAC: number; // Principle of Conscious Action alignment (0-100)
  proposito: DimensionState;    // Purpose / Teleological Alignment
  mental: DimensionState;       // Mental Clarity / Focus
  relacional: DimensionState;   // Relational / Social Coherence
  emocional: DimensionState;    // Emotional Balance
  somatico: DimensionState;     // Somatic / Physical Vitality
  eticoAcao: DimensionState;    // Ethical Action / Integrity
  recursos: DimensionState;     // Resources / Energy, Time, Finance Mgt
}

/**
 * Represents the structured result from the PIC Analysis Engine.
 */
export interface PicAnalysisResult {
    vector: CoherenceVector;
    summary: string;
}


/**
 * Represents a single message in a chat conversation.
 */
export interface Message {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: number;
  file?: {
    url: string;
    name: string;
    type: 'image' | 'other';
  };
}

/**
 * Represents a single spoken part of a guided meditation script.
 */
export interface MeditationScriptPart {
  text: string;
  duration: number;
}

/**
 * Represents a complete guided meditation, including its title and script.
 */
export interface Meditation {
  id: string;
  title: string;
  script: MeditationScriptPart[];
}

// Represents the main view the user is currently seeing.
export type View = 'dashboard' | 'agents' | 'tools' | 'quests' | 'journey';


// A discriminated union to handle different full-screen "sessions" the user can enter.
export type Session =
  | { type: 'agent'; id: AgentId; autoStart?: boolean; isReconnection?: boolean; }
  | { type: 'meditation', initialPrompt?: string, autoStart?: boolean, replayData?: { script: Meditation, generatedAudioParts: string[] } }
  | { type: 'content_analyzer', initialText?: string }
  | { type: 'guided_prayer', initialTheme?: string, autoStart?: boolean, replayData?: { theme: string, blocks: AudioScriptBlock[], audioDataUrl: string | null } }
  | { type: 'prayer_pills', initialTheme?: string, autoStart?: boolean }
  | { type: 'dissonance_analyzer', autoStart?: boolean }
  | { type: 'therapeutic_journal', initialEntry?: string }
  | { type: 'quantum_simulator' }
  | { type: 'phi_frontier_radar', autoStart?: boolean }
  | { type: 'dosh_diagnosis' }
  | { type: 'wellness_visualizer' }
  | { type: 'belief_resignifier', initialBelief?: string }
  | { type: 'emotional_spending_map' }
  | { type: 'risk_calculator', initialScenario?: string, autoStart?: boolean }
  | { type: 'archetype_journey' }
  | { type: 'verbal_frequency_analysis' }
  | { type: 'voice_therapeutic_journal' }
  | { type: 'routine_aligner' }
  | { type: 'scheduled_session' }
  | { type: 'scheduled_session_handler', schedule: Schedule }
  | { type: 'guided_meditation_voice', schedule: Schedule }
  | { type: 'guided_prayer_voice', schedule: Schedule }
  | { type: 'prayer_pills_voice', schedule: Schedule }
  | { type: 'journey_history' }
  | { type: 'help_center' };


/**
 * Represents the structured result from the Dissonance Analyzer AI.
 */
export interface DissonanceAnalysisResult {
    tema: string;
    padrao: string;
    insight: string;
}

/**
 * Represents the structured feedback from the Therapeutic Journal AI.
 */
export interface JournalFeedback {
    observacao: string;
    dissonancia: string;
    sugestao: string;
}

/**
 * Represents a single saved entry in the Therapeutic Journal, with its feedback.
 */
export interface JournalEntry {
  id: string;
  entry: string;
  feedback: JournalFeedback;
  timestamp: number;
}


/**
 * Represents the new, richer result from the Archetype Oracle AI.
 */
export interface ArchetypeAnalysisResult {
    lente: { title: string; text: string; };      // Dissonance Card
    jornada: { title: string; text: string; };   // Transition Card
    potencial: { title: string; text: string; }; // Resonance Card
    acao: {                                     // Actionable Step
        toolId: ToolId;
        payload: string;
        buttonText: string;
    };
}


/**
 * Represents a single saved entry in the Archetype Journey history.
 */
export interface ArchetypeJourneyEntry {
  id: string;
  narrative: string;
  result: ArchetypeAnalysisResult;
  timestamp: number;
}


/**
 * Represents the structured result from the Verbal Frequency Analysis AI.
 */
export interface VerbalFrequencyAnalysisResult {
    frequencia_detectada: string;
    coerencia_score: number;
    insight_imediato: string;
    acao_pac_recomendada: string;
    mensagem_guia: string;
}

/**
 * Represents a single saved entry in the Verbal Frequency Analysis history.
 */
export interface VerbalFrequencyEntry extends VerbalFrequencyAnalysisResult {
  id: string;
  timestamp: number;
}

/**
 * Represents the structured result from the new Voice Therapeutic Journal AI.
 */
export interface VoiceJournalAnalysisResult {
    verbalFrequency: {
        frequencia_detectada: string;
        coerencia_score: number; // 1-10
        insight_imediato: string;
    };
    journalFeedback: JournalFeedback;
    synthesis: {
        combined_insight: string;
        recommended_next_step: {
            tool: string; // Recommended tool's title
            justification: string;
        }
    }
}

/**
 * Represents a single saved entry in the Voice Therapeutic Journal history.
 */
export interface VoiceJournalEntry extends VoiceJournalAnalysisResult {
  id: string;
  timestamp: number;
  transcript: string;
}


/**
 * Represents a single toast notification message.
 */
export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'combo' | 'achievement';
}

/**
 * Represents the emotions a user can associate with a spending entry.
 */
export type Emotion = 
  | 'ansiedade' 
  | 'tedio' 
  | 'felicidade' 
  | 'estresse' 
  | 'celebracao' 
  | 'tristeza' 
  | 'cansaco' 
  | 'culpa'
  | 'gratidao'
  | 'generosidade'
  | 'conquista'
  | 'clareza'
  | 'proposito'
  | 'expansao'
  | 'cura'
  | 'conexao';

/**
 * Represents a single entry in the Emotional Spending Map.
 */
export interface SpendingEntry {
  id: string;
  timestamp: number;
  value: number;
  category: string;
  emotion: Emotion;
}

export interface AudioScriptBlock {
    text: string;
    targetDuration?: number; // Target duration in seconds for this block (Time-Boxing)
    instructions: {
        mood: 'ethereal' | 'warm' | 'epic' | 'nature' | 'deep_focus';
        intensity: number; // 0.0 to 1.0
        binauralFreq?: number; // e.g., 4 (Theta), 10 (Alpha)
        pauseAfter: number; // seconds of silence/music after this block
    };
}


/**
 * Defines the structure for storing the state of various tools.
 */
export type ToolStates = {
    meditation?: {
        prompt: string;
        script: Meditation | null;
        generatedAudioParts: string[] | null;
        error: string | null;
        state: 'config' | 'generating' | 'preview' | 'ready' | 'playing' | 'paused' | 'error' | 'finished';
        currentChunkIndex: number;
    };
    guidedPrayer?: {
        theme: string;
        blocks: AudioScriptBlock[];
        audioDataUrl: string | null;
        error: string | null;
        state: 'config' | 'generating' | 'display' | 'error';
        progress?: number;
    };
    prayerPills?: {
        theme: string;
        pillText: string;
        audioDataUrl: string | null;
        error: string | null;
        state: 'config' | 'generating' | 'display' | 'error';
    };
    therapeuticJournal?: { 
        currentEntry: string; 
        currentFeedback: JournalFeedback | null; 
        history: JournalEntry[];
        error: string | null;
    };
    dissonanceAnalysis?: { 
        result: DissonanceAnalysisResult | null; 
        error: string | null; 
        state: 'idle' | 'analyzing' | 'result' | 'error';
    };
    doshaDiagnosis?: { 
        messages: Message[]; 
        isFinished: boolean; 
        error: string | null; 
    };
    routineAligner?: { 
        messages: Message[]; 
        isFinished: boolean; 
        error: string | null; 
    };
    doshaResult?: 'Vata' | 'Pitta' | 'Kapha' | null;
    verbalFrequencyAnalysis?: { 
        history: VerbalFrequencyEntry[];
        lastResult: VerbalFrequencyAnalysisResult | null;
    };
    voiceTherapeuticJournal?: {
        history: VoiceJournalEntry[];
        lastResult: VoiceJournalAnalysisResult | null;
        lastTranscript: string | null;
        error: string | null;
    };
    emotionalSpendingMap?: {
        entries: SpendingEntry[];
        analysis: string | null;
        error: string | null;
        suggestedNextStep?: {
            toolId: ToolId;
            payload: string;
        } | null;
    };
    contentAnalyzer?: {
        text: string;
        file: { data: string; mimeType: string; name: string; } | null;
        result: string | null;
        error: string | null;
        state: 'config' | 'analyzing' | 'result' | 'error';
    };
    archetypeJourney?: {
        history: ArchetypeJourneyEntry[];
        lastResult: ArchetypeAnalysisResult | null;
        lastNarrative: string | null;
        error: string | null;
    };
    quantumSimulator?: {
        outcome: string | null;
        interpretation: string | null;
        error: string | null;
        state: 'superposition' | 'observing' | 'collapsed' | 'error';
    };
    phiFrontierRadar?: {
        concept: { title: string, desc: string } | null;
        state: 'idle' | 'result';
    };
    wellnessVisualizer?: {
        text: string;
        result: PicAnalysisResult | null;
        error: string | null;
        state: 'config' | 'analyzing' | 'result' | 'error';
    };
    beliefResignifier?: {
        belief: string;
        reframed: string | null;
        state: 'config' | 'reframing' | 'result';
    };
    riskCalculator?: {
        scenario: string;
        analysis: string | null;
        state: 'config' | 'calculating' | 'result';
    };
};

/**
 * Represents a single scheduled session.
 */
export interface Schedule {
  id: string;
  activity: 'meditation' | 'guided_prayer' | 'prayer_pills';
  time: number; // For recurring events, this is the timestamp of the NEXT occurrence.
  status: 'scheduled' | 'completed' | 'missed';
  recurrence: 'none' | 'daily' | 'weekly' | 'custom';
  recurrenceDays?: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
}

/**
 * Represents the state of the interactive guide.
 */
export interface GuideState {
    isActive: boolean;
    step: number;
    tourId: string | null;
    context: any;
}

/**
 * Represents a single entry in the user's activity log/history.
 */
export type ActivityLogEntry = {
    id: string;
    timestamp: number;
    pointsGained: number;
    vectorSnapshot: CoherenceVector; // Snapshot of the vector AFTER the activity
} & (
    | {
        type: 'chat_session';
        agentId: AgentId;
        data: {
            messages: Message[];
        };
    }
    | {
        type: 'tool_usage';
        agentId: AgentId;
        data: {
            toolId: ToolId;
            result: any; // The specific result data from the tool
        };
    }
    | {
        type: 'level_up';
        agentId: AgentId.GUIDE; // System event
        data: {
            newLevel: number;
            levelName: string;
        };
    }
    | {
        type: 'streak_maintained';
        agentId: AgentId.GUIDE; // System event
        data: {
            streakCount: number;
        };
    }
    | {
        type: 'combo_achieved';
        agentId: AgentId.GUIDE; // System event
        data: {
            comboName: string;
            toolId: ToolId;
        };
    }
);


/**
 * Represents a dynamically generated Coherence Quest.
 */
export interface CoherenceQuest {
  id: string;
  title: string;
  description: string;
  targetTool: ToolId;
  targetDimension: keyof Omit<CoherenceVector, 'alinhamentoPAC'>;
  isCompleted: boolean;
  completionTimestamp?: number;
}

/**
 * Represents the cloud synchronization status.
 */
export type CloudSyncStatus = 'synced' | 'syncing' | 'error' | 'disabled';

/**
 * Represents the state of an active combo for gamification.
 */
export interface ActiveCombo {
    lastToolId: ToolId;
    startTime: number;
}


// --- New Gamification Types ---

export interface CoherenceLevel {
    level: number;
    name: string;
    minPoints: number;
    theme: {
        coherenceFill: string;
        dissonanceStroke: string;
        glowColor: string;
    };
}

export type AchievementId = 'first_quest' | 'streak_7' | 'combo_master_10' | 'high_phi_90';

export interface Achievement {
    id: AchievementId;
    name: string;
    description: string;
    icon: React.ElementType;
}

export type SessionOrigin = 'voice' | 'manual';