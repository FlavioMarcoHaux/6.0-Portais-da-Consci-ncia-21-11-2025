import { GoogleGenAI, Type } from '@google/genai';
import { Meditation, Message, CoherenceVector, ToolStates, MeditationScriptPart } from '../types.ts';

const SCRIPT_GENERATION_MODEL = 'gemini-3-pro-preview';
const SUMMARY_MODEL = 'gemini-3-pro-preview';

const formatChatHistoryForPrompt = (chatHistory: Message[]): string => {
    if (!chatHistory || chatHistory.length === 0) return '';
    const recentHistory = chatHistory.slice(-6); // Get last 6 messages for context
    const formatted = recentHistory.map(msg => `${msg.sender === 'user' ? 'Usuário' : 'Mentor'}: ${msg.text}`).join('\n');
    return `\n\n--- Histórico da Conversa Recente para Contexto ---\n${formatted}\n--- Fim do Histórico ---`;
}

const meditationPartSchema = {
    type: Type.OBJECT,
    properties: {
        text: { type: Type.STRING },
        duration: { type: Type.INTEGER }
    },
    required: ['text', 'duration']
};

const meditationSchema = {
    type: Type.OBJECT,
    properties: {
        title: {
            type: Type.STRING,
            description: 'Um título inspirador para a meditação.',
        },
        script: {
            type: Type.ARRAY,
            items: meditationPartSchema,
        },
    },
    required: ['title', 'script'],
};

// Schema for the "Architect" step of the cascade
const outlineSchema = {
    type: Type.OBJECT,
    properties: {
        title: { type: Type.STRING, description: "Título da meditação." },
        chapters: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    chapterTitle: { type: Type.STRING },
                    objective: { type: Type.STRING, description: "Objetivo deste capítulo (ex: relaxamento corporal, visualização)." },
                    density: { type: Type.STRING, enum: ['high', 'low'], description: "Alta: Narrativa detalhada e imersiva. Baixa: Comandos de relaxamento espaçados." },
                    targetDuration: { type: Type.INTEGER, description: "Duração estimada em minutos." }
                },
                required: ['chapterTitle', 'objective', 'density', 'targetDuration']
            }
        }
    },
    required: ['title', 'chapters']
};

// Helper to generate a long meditation using the cascade strategy
const generateLongMeditationScript = async (
    ai: GoogleGenAI,
    prompt: string,
    durationMinutes: number,
    styleInstruction: string,
    historyContext: string
): Promise<Meditation> => {
    
    // Lógica de Segmentação Agressiva (Base: ~1.000 tokens/min de fala densa)
    // Meta 60 min: ~24 capítulos de 2.5 min cada para garantir densidade.
    let numChapters = 5;
    if (durationMinutes === 15) numChapters = 6;
    else if (durationMinutes === 20) numChapters = 8;
    else if (durationMinutes === 30) numChapters = 12;
    else if (durationMinutes === 45) numChapters = 18;
    else if (durationMinutes >= 60) numChapters = 24;
    
    // 1. The Architect: Create the structure
    const outlinePrompt = `
        Você é o Arquiteto de Meditações de Alta Densidade.
        Crie a ESTRUTURA (índice) para uma meditação profunda de **${durationMinutes} minutos** com o tema: "${prompt}".
        
        ${styleInstruction}

        **Regras de Estrutura:**
        - Precisamos de VOLUME MASSIVO de conteúdo.
        - Divida em EXATAMENTE ${numChapters} capítulos lógicos e progressivos.
        - **Dinâmica:** Priorize 'density: high' (Narrativa Guiada, Visualização Rica) para preencher o tempo com voz.
        
        Responda com JSON.
    `;

    const outlineResponse = await ai.models.generateContent({
        model: SCRIPT_GENERATION_MODEL,
        contents: outlinePrompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: outlineSchema,
        },
    });

    const outline = JSON.parse(outlineResponse.text.trim());
    const fullScript: MeditationScriptPart[] = [];
    let previousContext = "";

    // 2. The Writer: Generate each chapter
    for (const chapter of outline.chapters) {
        const densityInstruction = chapter.density === 'high'
            ? "**ALTA DENSIDADE (MASSIVO):** Escreva um roteiro extremamente detalhado, poético e longo. Não economize palavras. Explore cada sensação, cada cor, cada emoção em profundidade. O objetivo é imersão total e preenchimento do tempo com fala guiada contínua."
            : "**BAIXA DENSIDADE:** Comandos de relaxamento profundos, mas mantenha a conexão verbal.";

        const chapterPrompt = `
            Você é o Escritor de Meditações. Estamos criando a meditação: "${outline.title}".
            
            Escreva o roteiro completo para o capítulo atual:
            **Título:** ${chapter.chapterTitle}
            **Objetivo:** ${chapter.objective}
            **Densidade:** ${chapter.density}
            **Duração Alvo:** ${chapter.targetDuration} minutos.

            ${styleInstruction}
            ${densityInstruction}

            **Contexto Anterior:**
            ${previousContext}

            **Instruções:**
            - Escreva o texto falado completo em Português do Brasil.
            - O texto deve ser fluido, conectando-se com o anterior.
            - GERE MUITO TEXTO se a densidade for alta. Mínimo de 400 palavras para blocos de alta densidade.
            
            Retorne um JSON com um array de partes.
        `;

        const chapterResponse = await ai.models.generateContent({
            model: SCRIPT_GENERATION_MODEL,
            contents: chapterPrompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        parts: { type: Type.ARRAY, items: meditationPartSchema }
                    }
                },
            },
        });

        const chapterData = JSON.parse(chapterResponse.text.trim());
        if (chapterData.parts) {
            fullScript.push(...chapterData.parts);
            // Update context (summary of what happened)
            previousContext = `Acabamos de passar pelo capítulo "${chapter.chapterTitle}" onde o foco foi ${chapter.objective}.`;
        }
    }

    return {
        id: `meditation-${Date.now()}`,
        title: outline.title,
        script: fullScript
    };
};


export const generateMeditationScript = async (prompt: string, durationMinutes: number, style: 'relax' | 'power_up', chatHistory?: Message[]): Promise<Meditation> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const historyContext = chatHistory ? formatChatHistoryForPrompt(chatHistory) : '';
    
    const styleInstruction = style === 'power_up' 
        ? `**ESTILO DE ENERGIA (POWER UP / MANHÃ):**
           - **Objetivo:** Despertar, Energizar, Motivar, Focar.
           - **Tom:** Vibrante, confiante, dinâmico.
           - **Vocabulário:** "Despertar", "Luz", "Força", "Agora", "Capaz", "Fluir".`
        : `**ESTILO DE RELAXAMENTO (NOITE / CALMA):**
           - **Objetivo:** Acalmar, Dormir, Soltar, Curar.
           - **Tom:** Hipnótico, lento, sussurrado, profundo.
           - **Vocabulário:** "Soltar", "Derreter", "Nuvens", "Silêncio", "Paz".`;

    // Use cascade strategy for long sessions (>= 10 mins is a safer threshold for quality)
    if (durationMinutes >= 10) {
        return await generateLongMeditationScript(ai, prompt, durationMinutes, styleInstruction, historyContext);
    }

    // Standard Single-Shot generation for short sessions (< 10 mins)
    const partsPerMin = style === 'power_up' ? 4 : 2; 
    const minParts = Math.max(5, durationMinutes * partsPerMin);

    const fullPrompt = `Você é um mestre em jornadas sensoriais e hipnoterapia Ericksoniana.
Sua missão é criar um roteiro de meditação guiada com base no tema: "${prompt}".

**CONFIGURAÇÃO TÉCNICA:**
- Duração Alvo: **${durationMinutes} minutos**.
- Estrutura: Gere **pelo menos ${minParts} partes (steps)** de texto no script para preencher o tempo adequadamente.
- Formato: Array de objetos JSON.

${styleInstruction}

**INSTRUÇÕES DE CONTEÚDO:**
Seja direto e eficaz. "Power Shot" de consciência se for muito curto.
Adapte o ritmo e as pausas para o tempo solicitado.

O idioma deve ser Português do Brasil.
${historyContext}
`;

    const response = await ai.models.generateContent({
      model: SCRIPT_GENERATION_MODEL,
      contents: fullPrompt,
      config: {
          responseMimeType: 'application/json',
          responseSchema: meditationSchema,
      },
    });

    const jsonText = response.text.trim();
    const parsedResponse = JSON.parse(jsonText);
    
    if (!parsedResponse.title || !Array.isArray(parsedResponse.script)) {
        throw new Error("Formato de script inválido recebido da API.");
    }

    return {
      id: `gemini-meditation-${Date.now()}`,
      ...parsedResponse,
    };

  } catch (error) {
    console.error('Error generating meditation script:', error);
    throw error;
  }
};

/**
 * Summarizes a chat history to create a concise meditation intention.
 */
export const summarizeChatForMeditation = async (chatHistory: Message[], coherenceVector: CoherenceVector, toolStates: ToolStates): Promise<string> => {
    if (!chatHistory || chatHistory.length === 0) {
        return '';
    }
    
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const historyString = chatHistory.map(msg => `${msg.sender === 'user' ? 'Usuário' : 'Mentor'}: ${msg.text}`).join('\n');

        let toolContext = '';
        if (toolStates.dissonanceAnalysis?.result) {
            toolContext += `\n- **Análise de Dissonância Recente:** Padrão '${toolStates.dissonanceAnalysis.result.padrao}', tema '${toolStates.dissonanceAnalysis.result.tema}'.`;
        }

        const vectorContext = `\n\nContexto de Coerência (0-100, Dissonância alta = caos):
        - Emocional: ${coherenceVector.emocional.dissonancia} (Dissonância)
        - Mental: ${coherenceVector.mental.dissonancia} (Dissonância)`;

        const prompt = `
            Analise a conversa e o estado do usuário.
            Extraia uma única frase curta e inspiradora que sirva como INTENÇÃO para uma meditação guiada.
            Exemplos: "Encontrar a paz em meio ao caos", "Ativar a coragem para agir", "Liberar a mágoa e perdoar".
            ${vectorContext}
            ${toolContext}
            
            Histórico:
            ${historyString}

            Responda APENAS com o texto da intenção.
        `;

        const response = await ai.models.generateContent({
            model: SUMMARY_MODEL,
            contents: prompt,
        });

        return response.text.trim();

    } catch (error) {
        console.error('Error summarizing chat for meditation:', error);
        throw error;
    }
};