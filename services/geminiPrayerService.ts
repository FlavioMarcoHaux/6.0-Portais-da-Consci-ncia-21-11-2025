import { GoogleGenAI, Type } from "@google/genai";
import { Message, CoherenceVector, AudioScriptBlock } from '../types.ts';

// O Arquiteto (Inteligência Pura) usa o modelo Pro
const ARCHITECT_MODEL = 'gemini-3-pro-preview';

// O Escritor (Volume e Velocidade) usa o modelo Flash para economizar cota e tempo
const WRITER_MODEL = 'gemini-2.5-flash'; 

const formatChatHistoryForPrompt = (chatHistory: Message[]): string => {
    if (!chatHistory || chatHistory.length === 0) return '';
    const recentHistory = chatHistory.slice(-6);
    const formatted = recentHistory.map(msg => `${msg.sender === 'user' ? 'Usuário' : 'Mentor'}: ${msg.text}`).join('\n');
    return `\n\n--- Histórico da Conversa Recente para Contexto ---\n${formatted}\n--- Fim do Histórico ---`;
}

// Schema for the "Architect" step of the prayer cascade
const prayerOutlineSchema = {
    type: Type.OBJECT,
    properties: {
        title: { type: Type.STRING, description: "Título da oração." },
        blocks: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    blockTheme: { type: Type.STRING, description: "Tema deste bloco (ex: Indução, Salmo, Gratidão)." },
                    guidance: { type: Type.STRING, description: "Instrução específica para a geração deste bloco." },
                    density: { type: Type.STRING, enum: ['high', 'medium', 'low'], description: "Nível de verbosidade do texto." },
                    suggestedMood: { type: Type.STRING, enum: ['ethereal', 'warm', 'epic', 'nature', 'deep_focus'], description: "Emoção sugerida para a trilha sonora." },
                },
                required: ['blockTheme', 'guidance', 'density', 'suggestedMood']
            }
        }
    },
    required: ['title', 'blocks']
};

// Schema for the final block output (Writer phase)
const blockOutputSchema = {
    type: Type.OBJECT,
    properties: {
        text: { type: Type.STRING, description: "O texto exato a ser falado." },
        instructions: {
            type: Type.OBJECT,
            properties: {
                mood: { type: Type.STRING, enum: ['ethereal', 'warm', 'epic', 'nature', 'deep_focus'] },
                intensity: { type: Type.NUMBER, description: "0.0 a 1.0" },
                binauralFreq: { type: Type.NUMBER, description: "Frequência em Hz (ex: 4 para Theta)" },
                pauseAfter: { type: Type.INTEGER, description: "Segundos de pausa após a fala." }
            },
            required: ['mood', 'intensity', 'pauseAfter']
        }
    },
    required: ['text', 'instructions']
};

const generateLongPrayer = async (
    ai: GoogleGenAI,
    theme: string,
    duration: number,
    type: 'diurna' | 'noturna' | 'terapeutica',
    styleInstruction: string,
    historyContext: string
): Promise<AudioScriptBlock[]> => {
    
    // ESTRATÉGIA: "32 BLOCOS DE MAGIA IMPLÍCITA"
    // Para atingir 27.000+ tokens em 60 min, precisamos de granularidade extrema.
    // 32 blocos x ~850 tokens/bloco = ~27.200 tokens.
    
    let numBlocks = 8; // Base para curtas
    // Cálculo de palavras inflacionado para garantir densidade (350 palavras/min na escrita gera sobra para leitura lenta)
    let wordsPerMinuteBase = 350; 

    if (duration === 15) { numBlocks = 10; }
    else if (duration === 20) { numBlocks = 14; }
    else if (duration === 30) { numBlocks = 20; }
    else if (duration === 45) { numBlocks = 26; }
    else if (duration >= 60) { 
        numBlocks = 32; // Estratégia confirmada para 1 hora
    }
    
    // Time-Boxing: Tempo alvo por bloco (ex: 60min / 32 = ~1.8 min por bloco)
    const timePerBlockSeconds = Math.floor((duration * 60) / numBlocks);
    
    // 1. Architect Phase (Gemini 3 Pro - Inteligência)
    const outlinePrompt = `
        Você é o Arquiteto de Jornadas Espirituais de Alta Densidade.
        Crie a ESTRUTURA FRACTAL para uma experiência de **${duration} minutos**.
        
        Tema: "${theme}"
        Estilo: ${type.toUpperCase()}
        ${styleInstruction}

        **Engenharia do Tempo (Micro-Capítulos):**
        - Divida a jornada em EXATAMENTE **${numBlocks} micro-blocos**.
        - Estrutura: Indução (4 blocos) -> Aprofundamento (6 blocos) -> Trabalho Terapêutico/Salmos (12 blocos) -> Clímax (6 blocos) -> Retorno (4 blocos).
        
        **Instrução para o Índice:**
        Seja conciso na descrição dos blocos aqui no índice para não estourar o limite de saída, mas defina 'density: high' para a maioria.

        Retorne JSON.
    `;

    const outlineResponse = await ai.models.generateContent({
        model: ARCHITECT_MODEL,
        contents: outlinePrompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: prayerOutlineSchema,
        },
    });

    const outline = JSON.parse(outlineResponse.text.trim());
    const fullScript: AudioScriptBlock[] = [];
    let context = `Iniciando oração de ${duration}min: "${outline.title}".`;

    // 2. Writer Phase (Gemini 2.5 Flash - Velocidade e Volume Massivo)
    // Processamento em lote paralelo (chunks de 4) para acelerar a geração de 32 blocos
    const chunkSize = 4;
    for (let i = 0; i < outline.blocks.length; i += chunkSize) {
        const chunk = outline.blocks.slice(i, i + chunkSize);
        
        const promises = chunk.map(async (block: any) => {
            const targetWordCount = Math.round((timePerBlockSeconds / 60) * wordsPerMinuteBase);

            // Instrução de "Magia Implícita" e Alta Densidade
            const densityInstruction = block.density === 'high' 
                ? `**MODO MAGIA IMPLÍCITA (ALTA DENSIDADE):** Escreva um texto longo e rico (aprox. **${targetWordCount} palavras**).
                   - Use **Comandos Embutidos** (Embedded Commands) disfarçados na narrativa.
                   - Use **Pressuposições** de que a mudança já está ocorrendo.
                   - Use **Descrição Sensorial Vívida** (V/A/C) para criar realidade.
                   - Não seja repetitivo; seja *profundo*. Explore nuances, detalhes e camadas.`
                : `**MODO ESPAÇO:** Escreva menos (${Math.round(targetWordCount * 0.6)} palavras). Foque em frases de impacto e silêncio.`;

            const blockPrompt = `
                Escreva o roteiro FALADO para este micro-bloco da oração.
                Tema do Bloco: ${block.blockTheme}
                Guia: ${block.guidance}
                
                ${styleInstruction}
                ${densityInstruction}
                
                Contexto Global: ${outline.title}
                Contexto Imediato: Estamos no bloco ${fullScript.length + 1} de ${numBlocks}.

                Instruções:
                - Texto pronto para falar (TTS).
                - Português do Brasil natural, hipnótico e terapêutico.
                - Retorne JSON.
            `;

            try {
                const blockResponse = await ai.models.generateContent({
                    model: WRITER_MODEL,
                    contents: blockPrompt,
                    config: {
                        responseMimeType: 'application/json',
                        responseSchema: blockOutputSchema,
                    }
                });
                const blockData = JSON.parse(blockResponse.text.trim()) as AudioScriptBlock;
                blockData.targetDuration = timePerBlockSeconds;
                return blockData;
            } catch (e) {
                console.error("Erro ao gerar bloco:", e);
                return { 
                    text: "Respire fundo e sinta a conexão...", 
                    instructions: { mood: 'ethereal', intensity: 0.5, pauseAfter: 5 },
                    targetDuration: timePerBlockSeconds 
                } as AudioScriptBlock;
            }
        });

        const results = await Promise.all(promises);
        fullScript.push(...results);
        context = `Últimos blocos focaram em: ${chunk.map((b: any) => b.blockTheme).join(', ')}.`;
    }

    return fullScript;
};


const getPrayerRecommendationPrompt = (vector: CoherenceVector, chatHistory?: Message[]): string => {
    const historyContext = chatHistory ? formatChatHistoryForPrompt(chatHistory) : '';
    const userStateContext = `
    O estado de coerência atual do usuário é (0-100, Coerência/Dissonância):
    - Propósito: ${vector.proposito.coerencia}/${vector.proposito.dissonancia}
    - Mental: ${vector.mental.coerencia}/${vector.mental.dissonancia}
    - Relacional: ${vector.relacional.coerencia}/${vector.relacional.dissonancia}
    - Emocional: ${vector.emocional.coerencia}/${vector.emocional.dissonancia}
    - Somático (Corpo): ${vector.somatico.coerencia}/${vector.somatico.dissonancia}
    - Recursos: ${vector.recursos.coerencia}/${vector.recursos.dissonancia}
    `;

    return `
    Você é o Mentor de Coerência.
    Baseado no contexto abaixo, identifique a necessidade mais premente do usuário.
    Crie um tema de oração curto, positivo e inspirador que aborde essa necessidade.

    **Contexto do Usuário:**
    ${userStateContext}
    ${historyContext}

    **Formato de Saída OBRIGATÓRIO:**
    Responda **APENAS** com o tema da oração (uma frase curta).
    `;
};

export const recommendPrayerTheme = async (vector: CoherenceVector, chatHistory?: Message[]): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = getPrayerRecommendationPrompt(vector, chatHistory);

    // Recomendação pode continuar no Pro pois é uma chamada única e curta
    const response = await ai.models.generateContent({
        model: ARCHITECT_MODEL,
        contents: prompt,
    });
    
    return response.text.trim();
  } catch (error) {
      console.error(`Error recommending prayer theme:`, error);
      throw error;
  }
};

export const generateGuidedPrayer = async (theme: string, duration: number, type: 'diurna' | 'noturna' | 'terapeutica', chatHistory?: Message[]): Promise<AudioScriptBlock[]> => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      let styleInstruction = "";
      if (type === 'diurna') styleInstruction = "Estilo: Diurno (Energia, Sol, Força). Foco em Gratidão Antecipada e Ativação. Use PNL (Modal Operators of Possibility) para ancorar poder e presença.";
      else if (type === 'noturna') styleInstruction = "Estilo: Noturno (Paz, Lua, Relaxamento). Foco em Limpeza e Sono Profundo. Use Hipnose (Milton Model) para induzir ondas Delta e soltura.";
      else styleInstruction = "Estilo: Terapêutico (Profundo, Cura, Hipnose Ericksoniana). Foco em Ressignificação, Perdão e Milagres. Use metáforas complexas, loops aninhados e comandos embutidos para reprogramação subconsciente.";
  
      const historyContext = chatHistory ? formatChatHistoryForPrompt(chatHistory) : '';
      
      return await generateLongPrayer(ai, theme, duration, type, styleInstruction, historyContext);
  
    } catch (error) {
        console.error(`Error generating guided prayer:`, error);
        throw error;
    }
  };