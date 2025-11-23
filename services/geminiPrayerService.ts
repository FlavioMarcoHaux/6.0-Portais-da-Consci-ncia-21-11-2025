
import { GoogleGenAI, Type } from "@google/genai";
import { Message, CoherenceVector, AudioScriptBlock } from '../types.ts';

// O Arquiteto (Inteligência Pura) usa o modelo Pro
const ARCHITECT_MODEL = 'gemini-3-pro-preview';

// O Escritor (Volume e Velocidade) usa o modelo Flash
const WRITER_MODEL = 'gemini-2.5-flash'; 

const formatChatHistoryForPrompt = (chatHistory: Message[]): string => {
    if (!chatHistory || chatHistory.length === 0) return '';
    const recentHistory = chatHistory.slice(-6);
    const formatted = recentHistory.map(msg => `${msg.sender === 'user' ? 'Usuário' : 'Mentor'}: ${msg.text}`).join('\n');
    return `\n\n--- Histórico da Conversa Recente para Contexto ---\n${formatted}\n--- Fim do Histórico ---`;
}

// Schema for the "Architect" step
const prayerOutlineSchema = {
    type: Type.OBJECT,
    properties: {
        title: { type: Type.STRING, description: "Título poderoso da oração (Otimizado para SEO/Clickbait Espiritual)." },
        blocks: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    blockTheme: { type: Type.STRING, description: "Tema deste bloco (ex: Salmo 91, Quebra de Maldição)." },
                    guidance: { type: Type.STRING, description: "Instrução de PNL/Hipnose e Referência Bíblica." },
                    density: { type: Type.STRING, enum: ['high'], description: "Sempre High." },
                    suggestedMood: { type: Type.STRING, enum: ['ethereal', 'warm', 'epic', 'nature', 'deep_focus'] },
                },
                required: ['blockTheme', 'guidance', 'density', 'suggestedMood']
            }
        }
    },
    required: ['title', 'blocks']
};

// Schema for the final block output
const blockOutputSchema = {
    type: Type.OBJECT,
    properties: {
        text: { type: Type.STRING, description: "O texto exato a ser falado. Linguagem simples, profunda e conectada." },
        instructions: {
            type: Type.OBJECT,
            properties: {
                mood: { type: Type.STRING, enum: ['ethereal', 'warm', 'epic', 'nature', 'deep_focus'] },
                intensity: { type: Type.NUMBER, description: "0.0 a 1.0" },
                binauralFreq: { type: Type.NUMBER, description: "Frequência em Hz (ex: 4)" },
                pauseAfter: { type: Type.INTEGER, description: "Segundos de pausa após a fala (Max 20s)." }
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
    
    // ESTRATÉGIA DE FLUXO DE MESTRE (ATOS PROFUNDOS)
    // Aumentar densidade para 120ppm para garantir que a IA fale bastante e preencha o tempo
    let wordsPerMinuteBase = 120; 
    let numBlocks = 3;

    // Blocos longos (5-10 min cada) para evitar "TDAH" e permitir aprofundamento
    if (duration <= 5) { numBlocks = 1; }
    else if (duration <= 10) { numBlocks = 2; }
    else if (duration <= 15) { numBlocks = 3; }
    else if (duration <= 20) { numBlocks = 3; }
    else if (duration <= 30) { numBlocks = 4; } 
    else if (duration <= 45) { numBlocks = 6; } 
    else if (duration >= 60) { numBlocks = 8; } // ~7.5 min por bloco
    
    const timePerBlockSeconds = Math.floor((duration * 60) / numBlocks);
    
    // 1. Architect Phase
    const outlinePrompt = `
        ATUE COMO: Mestre em Oração Guiada (Certificado em PNL/Hipnose Ericksoniana).
        MODELAGEM: Autoridade de Jesus Cristo, Sabedoria de Salomão, Adoração de Davi.
        
        **MISSÃO:** Estruturar uma sessão de **${duration} minutos** sobre o tema: "${theme}".
        **ESTILO:** ${type.toUpperCase()}
        
        **ESTRUTURA (Jornada Espiritual):**
        Divida em EXATAMENTE **${numBlocks} BLOCOS** lógicos.
        
        1. **Início (Indução):** Respiração, Salmos de segurança (91/23), baixar frequência cerebral.
        2. **Meio (Processo):** Metáforas de cura, milagres de Jesus, quebra de crenças, limpeza.
        3. **Fim (Ancoragem):** Decretos de vitória (Davi), gratidão, selamento.
        4. **CTA (Call to Action):** No último bloco, convidar para comentar e se inscrever no canal "Fé em 10 Minutos de Oração".

        Retorne JSON com a estrutura.
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
    let context = `Iniciando Oração de ${duration}min: "${outline.title}".`;

    // 2. Writer Phase
    const chunkSize = 2; 
    for (let i = 0; i < outline.blocks.length; i += chunkSize) {
        const chunk = outline.blocks.slice(i, i + chunkSize);
        
        const promises = chunk.map(async (block: any) => {
            // Meta de palavras alta para garantir densidade e evitar silêncio excessivo
            const targetWordCount = Math.round((timePerBlockSeconds / 60) * wordsPerMinuteBase);

            const blockPrompt = `
                ATUE COMO: Oração Guiada Mestre (Jesus/Davi + PNL).
                ESCREVA O TEXTO FALADO para este bloco de ~${Math.round(timePerBlockSeconds/60)} minutos.
                
                **DADOS DO BLOCO:**
                - Tema: ${block.blockTheme}
                - Guia: ${block.guidance}
                - META MÍNIMA: **${targetWordCount} palavras**. (Escreva MUITO, preencha o tempo).
                
                **ESTILO DE LINGUAGEM (CRUCIAL):**
                - **SIMPLES & PROFUNDO:** Fale como um amigo sábio e íntimo ao pé do ouvido. 
                - **EVITE ERUDIÇÃO:** Não use termos teológicos complexos, palavras difíceis ou acadêmicas. Use a linguagem do povo, do coração.
                - **SENSORIAL:** Foque no que a pessoa *sente*, *vê* e *ouve* na imaginação. Use metáforas simples (água, luz, vento, abraço).
                - **FLUÍDEZ:** Crie "Loopings Hipnóticos". Conecte as frases. "E enquanto você respira... você sente... e sentindo isso...". Sem cortes bruscos.
                
                **GATILHOS:**
                - Use: "Milagre", "Providência", "Destravar", "Cura", "Resposta", "Hoje".
                - Cite a Bíblia como *decreto vivo*, não leitura.
                
                ${styleInstruction}
                
                Contexto Anterior: ${context}

                Responda APENAS com o JSON.
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
                if (blockData.instructions.pauseAfter > 30) blockData.instructions.pauseAfter = 30; 

                return blockData;
            } catch (e) {
                console.error("Erro ao gerar bloco:", e);
                return { 
                    text: "Continue respirando fundo... sentindo a presença divina te envolver... este é o seu momento de paz...", 
                    instructions: { mood: 'ethereal', intensity: 0.5, pauseAfter: 10 },
                    targetDuration: timePerBlockSeconds 
                } as AudioScriptBlock;
            }
        });

        const results = await Promise.all(promises);
        fullScript.push(...results);
        context = `Blocos finalizados: ${chunk.map((b: any) => b.blockTheme).join(', ')}.`;
    }

    return fullScript;
};


const getPrayerRecommendationPrompt = (vector: CoherenceVector, chatHistory?: Message[]): string => {
    const historyContext = chatHistory ? formatChatHistoryForPrompt(chatHistory) : '';
    const userStateContext = `
    Dissonância Atual:
    - Propósito: ${vector.proposito.dissonancia}%
    - Emocional: ${vector.emocional.dissonancia}%
    - Financeiro: ${vector.recursos.dissonancia}%
    `;

    return `
    Atue como um Mentor Espiritual do canal "Fé em 10 Minutos".
    Sugira UM tema de oração poderoso e atraente ("Clickbait Espiritual" do bem) para a dor atual do usuário.
    Exemplos: "Oração para Destravar a Vida Financeira Imediatamente", "Cura da Ansiedade e Pânico Agora", "Salmo 91 para Proteção Total".

    ${userStateContext}
    ${historyContext}

    Responda APENAS com o título.
    `;
};

export const recommendPrayerTheme = async (vector: CoherenceVector, chatHistory?: Message[]): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = getPrayerRecommendationPrompt(vector, chatHistory);

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
      if (type === 'diurna') styleInstruction = "ESTILO: DIURNO. Voz firme, autoridade, energia de despertar. Foco em conquista, proteção para o dia e força.";
      else if (type === 'noturna') styleInstruction = "ESTILO: NOTURNO. Voz hipnótica, muito lenta, suave e acolhedora. Foco em limpar a mente, segurança, anjos e sono profundo.";
      else styleInstruction = "ESTILO: TERAPÊUTICO. Voz empática, compassiva e curadora. Foco em tocar nas feridas emocionais com amor, perdão e renovação.";
  
      const historyContext = chatHistory ? formatChatHistoryForPrompt(chatHistory) : '';
      
      return await generateLongPrayer(ai, theme, duration, type, styleInstruction, historyContext);
  
    } catch (error) {
        console.error(`Error generating guided prayer:`, error);
        throw error;
    }
  };
