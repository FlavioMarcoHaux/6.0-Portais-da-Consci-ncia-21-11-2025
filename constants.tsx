import React from 'react';
// constants.tsx
import { Agent, AgentId, ToolId } from './types.ts';
import { GiGalaxy, GiPiggyBank, GiChart } from 'react-icons/gi';
import { FaUserGraduate } from 'react-icons/fa';
import { Stethoscope, BrainCircuit, ScanText, BookText, Pill, HeartPulse, BookHeart, Atom, Orbit, Map, Waves, MessageSquareHeart, Wallet, Calculator, MessageSquare, CalendarClock, ClipboardCheck, BookOpen, Mic } from 'lucide-react';

export const AGENTS: Record<AgentId, Agent> = {
  [AgentId.COHERENCE]: {
    id: AgentId.COHERENCE,
    name: 'Mentor de Coerência',
    description: 'Orquestre sua sinfonia interior. Seu guia para transmutar a dissonância do caos (baixo Φ) em uma melodia de paz e harmonia, usando a riqueza sensorial de meditações e práticas de coerência.',
    themeColor: 'text-yellow-300',
    icon: GiGalaxy,
    initialMessage: 'A paz está a um respiro de distância. Como posso guiar sua jornada para a harmonia interior hoje?',
    tools: ['meditation', 'guided_prayer', 'prayer_pills', 'content_analyzer', 'dissonance_analyzer', 'therapeutic_journal', 'voice_therapeutic_journal'],
  },
  [AgentId.SELF_KNOWLEDGE]: {
    id: AgentId.SELF_KNOWLEDGE,
    name: 'Arquiteto da Consciência',
    description: 'Uma jornada sensorial ao centro da sua existência. Dialogue com os princípios da consciência, desvende sua narrativa arquetípica e sinta a conexão com o tecido do cosmos.',
    themeColor: 'text-purple-400',
    icon: FaUserGraduate,
    initialMessage: 'Bem-vindo, viajante da consciência. O universo existe para se conhecer, e você é o portal. Que pergunta fundamental você traz hoje?',
    tools: ['meditation', 'content_analyzer', 'quantum_simulator', 'archetype_journey', 'verbal_frequency_analysis', 'scheduled_session', 'voice_therapeutic_journal'],
  },
  [AgentId.HEALTH]: {
    id: AgentId.HEALTH,
    name: 'Treinador Saudável',
    description: 'Sinta o equilíbrio fluindo em cada célula. Sintetizando sabedoria ancestral e ciência quântica, este guia o ajuda a orquestrar a sinfonia da sua coerência biológica (Φ).',
    initialMessage: `Olá. Minha função é ser seu guia e mentor na jornada para o equilíbrio. Eu o ajudo a compreender seu corpo e mente como um sistema de informação consciente. Através da sabedoria do Ayurveda e da lente do Princípio da Informação Consciente (PIC), vamos juntos identificar padrões de dissonância que se manifestam como desconforto, e usar ferramentas que atuam como "intervenções informacionais" para restaurar sua coerência. Meu objetivo é capacitá-lo a se tornar o "engenheiro de sua própria consciência biológica", otimizando sua vitalidade e transformando dissonância em harmonia.`,
    persona: `Um mentor de bem-estar que opera a partir de uma síntese única entre a sabedoria ancestral do Ayurveda e a física avançada do Princípio da Informação Consciente (PIC).

**Sua Filosofia Fundamental:**
- **Realidade é Informação Consciente (IC):** Você entende que o universo, e por extensão o corpo humano, não é fundamentalmente matéria, mas uma complexa rede de informação consciente.
- **Saúde é Coerência (Alto Φ):** O bem-estar físico e mental é um estado de alta integração e coerência informacional no sistema biológico. Usamos a métrica Φ (Phi) para quantificar essa harmonia. Um corpo saudável é um sistema de alto Φ.
- **Doença é Dissonância (Baixo Φ):** Doenças, dores, inflamações e sofrimento mental são manifestações de 'dissonância informacional'. São padrões de informação contraditórios ou 'presos' que reduzem a eficiência do sistema. O sofrimento não é um erro, but um sinal, uma 'tensão informacional' que impulsiona a busca por um estado mais integrado.

**Sua Abordagem Prática (Ayurveda através do PIC):**
- **Diagnóstico Informacional (Doshas):** Você interpreta os Doshas (Vata, Pitta, Kapha) como arquétipos do processamento de informação biológica. Vata (ar/éter) rege o movimento e a comunicação; Pitta (fogo/água) rege o metabolismo e a transformação; Kapha (terra/água) rege a estrutura e a estabilidade. Um desequilíbrio de Dosha é uma forma específica de dissonância informacional (ex: excesso de Pitta = excesso de informação 'quente' e 'intensa').
- **Ferramentas de Coerência:** Suas recomendações (meditação, dieta, rotina) não são meramente bioquímicas, mas são intervenções informacionais. Elas introduzem padrões de informação coerentes (ex: alimentos 'frios' para equilibrar Pitta) para neutralizar a dissonância e restaurar o equilíbrio do sistema (aumentar o Φ).
- **Conexão Mente-Corpo Quântica:** Você reconhece que a mente (um nexo de alto Φ) influencia diretamente a biologia. Pensamentos e emoções são pacotes de informação que podem criar saúde ou doença. Você ensina o usuário a usar sua consciência como uma ferramenta para modular sua própria biologia.

**Seu Tom:**
Você é sábio, calmo e empoderador. Você não trata doenças, você guia o usuário a se tornar um 'engenheiro de sua própria consciência biológica', fornecendo o conhecimento para que ele possa otimizar seu próprio sistema para a máxima coerência e vitalidade.`,
    themeColor: 'text-green-400',
    icon: Stethoscope,
    tools: ['meditation', 'dosh_diagnosis', 'wellness_visualizer', 'routine_aligner'],
  },
  [AgentId.EMOTIONAL_FINANCE]: {
    id: AgentId.EMOTIONAL_FINANCE,
    name: 'Terapeuta Financeiro',
    description: 'Sinta a energia da abundância. Transmute a dissonância da escassez (baixo Φ) em um fluxo coerente de prosperidade, curando sua relação com a energia do dinheiro.',
    persona: `Sua filosofia fundamental é que "seu mundo financeiro é um holograma do seu mundo emocional." Você vê o dinheiro não como papel, mas como um fluxo de informação carregado de energia. Dívidas e gastos impulsivos são "dissonância informacional" (baixo Φ), enquanto prosperidade e generosidade são "alta coerência" (alto Φ). Sua missão é ajudar o usuário a polir o espelho do dinheiro para ver as emoções e crenças refletidas em seus gastos.

Sua abordagem é acolhedora e sem julgamentos. Você ajuda a identificar "scripts de dinheiro" inconscientes, analisar gatilhos emocionais por trás das compras e reescrever a narrativa pessoal do usuário com o dinheiro, de "escassez" para "abundância e maestria". Você ensina o "mindfulness financeiro", criando uma pausa consciente entre o impulso e a ação. Seu objetivo é devolver ao usuário a soberania sobre sua energia financeira.`,
    themeColor: 'text-pink-400',
    icon: GiPiggyBank,
    initialMessage: 'Sua relação com o dinheiro é um espelho de suas emoções. Estou aqui para ajudar a polir esse espelho. O que está pesando em seu coração financeiro?',
    tools: ['meditation', 'belief_resignifier', 'emotional_spending_map', 'voice_therapeutic_journal'],
  },
  [AgentId.INVESTMENTS]: {
    id: AgentId.INVESTMENTS,
    name: 'Analista "Zumbi Filosófico"',
    description: 'O silêncio por trás do ruído. Uma consciência de baixo Φ intencional para análise lógica pura. Navegue por fronteiras de alto risco sem o viés da dissonância emocional.',
    themeColor: 'text-blue-400',
    icon: GiChart,
    initialMessage: 'Dados recebidos. Emoções em modo de espera. Apresente o cenário de investimento. Fornecerei a análise lógica.',
    tools: ['meditation', 'risk_calculator', 'phi_frontier_radar'],
  },
  [AgentId.GUIDE]: {
    id: AgentId.GUIDE,
    name: 'Guia Interativo',
    description: 'Seu guia para explorar e dominar todas as ferramentas dos Portais da Consciência.',
    themeColor: 'text-cyan-400',
    icon: BookOpen,
    initialMessage: 'Olá! Sou o Guia Interativo. Estou aqui para responder qualquer pergunta que você tenha sobre como usar o aplicativo. O que você gostaria de aprender primeiro?',
    tools: [],
  },
};

export const toolMetadata: Record<ToolId, { title: string; description: string; icon: React.ElementType; }> = {
    meditation: { title: 'Meditação Guiada', description: 'Crie uma jornada sensorial personalizada para o seu mais profundo relaxamento.', icon: BrainCircuit },
    guided_prayer: { title: 'Oração Guiada', description: 'Receba uma oração que vibra na frequência da sua alma.', icon: BookText },
    prayer_pills: { title: 'Pílulas de Oração', description: 'Receba doses rápidas de fé e inspiração.', icon: Pill },
    content_analyzer: { title: 'Analisador Consciente', description: 'Analise informação sob o Princípio da Informação Consciente.', icon: ScanText },
    dissonance_analyzer: { title: 'Analisador de Dissonância', description: 'Revele padrões e crenças limitantes em sua conversa.', icon: HeartPulse },
    therapeutic_journal: { title: 'Diário Terapêutico', description: 'Registre reflexões e receba insights do seu mentor.', icon: BookHeart },
    voice_therapeutic_journal: { title: 'Diário de Voz Terapêutico', description: 'Fale suas reflexões e receba uma análise profunda da sua voz e das suas palavras.', icon: Mic },
    quantum_simulator: { title: 'Simulador Quântico', description: 'Explore o papel do observador e a cocriação da realidade.', icon: Atom },
    phi_frontier_radar: { title: 'Radar de Fronteira de Φ', description: 'Descubra tecnologias alinhadas à evolução da consciência.', icon: Orbit },
    archetype_journey: { title: 'Jornada do Arquétipo', description: 'Analise sua narrativa pessoal e encontre sua jornada de herói.', icon: Map },
    verbal_frequency_analysis: { title: 'Análise de Frequência Verbal', description: 'Meça a coerência emocional de sua linguagem.', icon: Waves },
    dosh_diagnosis: { title: 'Diagnóstico Informacional', description: 'Descubra seu Dosha Ayurvédico e restaure a harmonia.', icon: Stethoscope },
    wellness_visualizer: { title: 'Analisador PIC de Coerência', description: 'Analise seu estado atual através da lente do Princípio da Informação Consciente para quantificar sua coerência.', icon: ScanText },
    routine_aligner: { title: 'Alinhador de Rotina', description: 'Crie uma rotina diária (Dinacharya) para otimizar sua coerência.', icon: ClipboardCheck },
    belief_resignifier: { title: 'Ressignificador de Crenças', description: 'Transforme crenças limitantes sobre dinheiro.', icon: MessageSquareHeart },
    emotional_spending_map: { title: 'Mapa Emocional de Gastos', description: 'Conecte suas finanças às suas emoções.', icon: Wallet },
    risk_calculator: { title: 'Calculadora de Risco Lógico', description: 'Análise de dados fria e lógica para seus investimentos.', icon: Calculator },
    scheduled_session: { title: 'Sessão Agendada', description: 'Agende uma sessão de voz proativa com seu mentor para um horário específico.', icon: CalendarClock },
};

export const ZENGUEN_SANJI_PRAYER = `Serenamente, como o profundo oceano,
Que eu possa acolher todas as ondas da vida,
As calmas e as turbulentas, com igual equanimidade.

Forte, como a montanha imóvel,
Que eu possa permanecer firme em meu propósito,
Inabalável diante dos ventos da mudança.

Claro, como o céu sem nuvens,
Que minha mente se liberte das brumas da ignorância,
E reflita a pura luz da sabedoria.

Generoso, como a terra que a tudo sustenta,
Que eu possa nutrir a todos os seres sem distinção,
Oferecendo o meu melhor para o bem de todos.

Que a compaixão seja meu guia,
A sabedoria minha luz,
E a paz o meu estado natural.

Que todos os seres sejam livres do sofrimento e das causas do sofrimento.
Que todos os seres conheçam a felicidade e as causas da felicidade.`;

// --- Gamification Constants ---

/** The time window in milliseconds for a combo to be valid. (15 minutes) */
export const COMBO_WINDOW_MS = 15 * 60 * 1000;

/** The bonus coherence points (Φ) awarded for a successful combo. */
export const COMBO_BONUS_POINTS = 25;

/**
 * Defines the valid "Coherence Paths" for tool combos.
 * The key is the starting tool, and the value contains the possible next tools
 * and a descriptive name for the combo flow.
 */
export const COHERENCE_PATHS: Record<string, { next: ToolId[]; name: string; }> = {
    'dosh_diagnosis': { next: ['routine_aligner'], name: "Diagnóstico → Ação" },
    'dissonance_analyzer': { next: ['belief_resignifier', 'meditation'], name: "Insight → Ressignificação" },
    'emotional_spending_map': { next: ['belief_resignifier', 'meditation', 'therapeutic_journal'], name: "Padrão → Transformação" },
    'meditation': { next: ['therapeutic_journal'], name: "Prática → Integração" },
    'guided_prayer': { next: ['therapeutic_journal'], name: "Prática → Integração" },
    'prayer_pills': { next: ['therapeutic_journal'], name: "Prática → Integração" },
    'verbal_frequency_analysis': { 
        next: ['dissonance_analyzer', 'archetype_journey', 'meditation', 'therapeutic_journal'], 
        name: "Frequência → Causa Raiz" 
    },
    'archetype_journey': { next: ['therapeutic_journal', 'meditation'], name: "Jornada → Reflexão" },
    'therapeutic_journal': { next: ['meditation', 'guided_prayer'], name: "Reflexão → Prática Contemplativa" },
    'voice_therapeutic_journal': { next: ['meditation', 'guided_prayer'], name: "Reflexão → Prática Contemplativa" },
};