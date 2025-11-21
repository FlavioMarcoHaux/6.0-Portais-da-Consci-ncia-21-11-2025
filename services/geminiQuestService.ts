// services/geminiQuestService.ts
import { GoogleGenAI, Type } from "@google/genai";
import { CoherenceQuest, CoherenceVector, ToolId } from '../types.ts';

const QUEST_MODEL = 'gemini-2.5-flash';

// Define the schema for the quest generation
const questSchema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: 'Um título inspirador e criativo para a missão (ex: "Acalmar a Tempestade Emocional").',
    },
    description: {
      type: Type.STRING,
      description: 'Uma descrição curta (uma frase) que explica o objetivo da missão (ex: "Use o Analisador de Dissonância para encontrar clareza em seus sentimentos.").',
    },
    targetTool: {
      type: Type.STRING,
      description: 'O ID exato da ferramenta mais apropriada para resolver a dissonância.',
    },
  },
  required: ['title', 'description', 'targetTool'],
};

// Maps a dimension to a set of appropriate tools
const dimensionToolMap: Record<keyof Omit<CoherenceVector, 'alinhamentoPAC'>, ToolId[]> = {
    proposito: ['archetype_journey', 'quantum_simulator', 'phi_frontier_radar'],
    mental: ['dissonance_analyzer', 'content_analyzer', 'meditation'],
    relacional: ['therapeutic_journal', 'guided_prayer'],
    emocional: ['dissonance_analyzer', 'therapeutic_journal', 'meditation', 'verbal_frequency_analysis'],
    somatico: ['dosh_diagnosis', 'routine_aligner', 'wellness_visualizer'],
    eticoAcao: ['therapeutic_journal', 'archetype_journey'],
    recursos: ['emotional_spending_map', 'belief_resignifier', 'risk_calculator'],
};


export const generateCoherenceQuest = async (vector: CoherenceVector): Promise<CoherenceQuest> => {
    // 1. Identify the dimension with the highest dissonance
    let targetDimension: keyof Omit<CoherenceVector, 'alinhamentoPAC'> = 'emocional';
    let maxDissonance = -1;

    for (const key in vector) {
        if (key !== 'alinhamentoPAC') {
            const dim = key as keyof Omit<CoherenceVector, 'alinhamentoPAC'>;
            if (vector[dim].dissonancia > maxDissonance) {
                maxDissonance = vector[dim].dissonancia;
                targetDimension = dim;
            }
        }
    }
    
    // 2. Create a specific prompt for Gemini
    const availableTools = dimensionToolMap[targetDimension].join(', ');
    const prompt = `
        Você é um "Mestre de Jogo Cósmico" no aplicativo Portais da Consciência.
        Sua tarefa é criar uma "Missão de Coerência" para um usuário.

        A análise do "Vetor de Coerência" do usuário revelou que a área de maior dissonância (caos/conflito) é: **${targetDimension}**.

        Com base nessa dissonância, gere uma missão inspiradora para guiar o usuário.
        A missão deve sugerir o uso de uma das seguintes ferramentas, que são as mais adequadas para esta área: **${availableTools}**.

        Seja criativo e use uma linguagem que misture sabedoria e um toque de gamificação.
        Sua resposta DEVE ser um objeto JSON válido, seguindo o schema fornecido.
    `;

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: QUEST_MODEL,
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: questSchema,
            },
        });
        
        const jsonText = response.text.trim();
        const cleanJsonText = jsonText.startsWith('```json') ? jsonText.replace(/```json\n?/, '').replace(/```$/, '') : jsonText;
        const parsed = JSON.parse(cleanJsonText) as { title: string; description: string; targetTool: string; };

        if (!parsed.title || !parsed.description || !parsed.targetTool) {
             throw new Error("Formato de missão inválido recebido da API.");
        }
        
        return {
            id: `quest-${Date.now()}`,
            title: parsed.title,
            description: parsed.description,
            targetTool: parsed.targetTool as ToolId,
            targetDimension: targetDimension,
            isCompleted: false,
        };

    } catch (error) {
        console.error("Error generating Coherence Quest:", error);
        // Fallback to a default quest on API error
        return {
            id: `quest-fallback-${Date.now()}`,
            title: "Explore suas Ferramentas",
            description: "Navegue até a seção de ferramentas e escolha uma que ressoe com você agora.",
            targetTool: 'meditation', // A safe default
            targetDimension: 'mental',
            isCompleted: false,
        };
    }
};