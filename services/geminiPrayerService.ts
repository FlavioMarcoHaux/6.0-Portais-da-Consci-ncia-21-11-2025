
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
        title: { type: Type.STRING, description: "Título poderoso da oração." },
        blocks: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    blockTheme: { type: Type.STRING, description: "Tema deste bloco (ex: Indução Hipnótica, Salmo 23, Ancoragem de Milagre)." },
                    guidance: { type: Type.STRING, description: "Instrução de PNL/Hipnose específica para este bloco." },
                    density: { type: Type.STRING, enum: ['high'], description: "Sempre High para fluxo contínuo." },
                    suggestedMood: { type: Type.STRING, enum: ['ethereal', 'warm', 'epic', 'nature', 'deep_focus'], description: "Atmosfera sonora." },
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
        text: { type: Type.STRING, description: "O texto exato a ser falado. Deve ser LONGO e FLUÍDO." },
        instructions: {
            type: Type.OBJECT,
            properties: {
                mood: { type: Type.STRING, enum: ['ethereal', 'warm', 'epic', 'nature', 'deep_focus'] },
                intensity: { type: Type.NUMBER, description: "0.0 a 1.0" },
                binauralFreq: { type: Type.NUMBER, description: "Frequência em Hz (ex: 4 para Theta)" },
                pauseAfter: { type: Type.INTEGER, description: "Segundos de pausa após a fala (Max 30s)." }
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
    
    // ESTRATÉGIA DE FLUXO CONTÍNUO (HIPNOSE ERICKSONIANA)
    // Menos blocos, mas muito mais longos e densos para evitar a sensação de "quebra" ou TDAH.
    // Base de palavras aumentada para 120 palavras/minuto para garantir que o tempo seja preenchido com conteúdo.
    
    let numBlocks = 3; // Mínimo
    let wordsPerMinuteBase = 120; // Ritmo de fala hipnótico mas constante e fluido.

    // Cálculo de blocos baseado em ciclos de aprofundamento (Deepening Cycles)
    // Cada bloco terá entre 3 a 6 minutos de fala contínua.
    if (duration === 5) { numBlocks = 2; }
    else if (duration === 10) { numBlocks = 3; }
    else if (duration === 15) { numBlocks = 4; }
    else if (duration === 20) { numBlocks = 5; }
    else if (duration === 30) { numBlocks = 6; } // ~5 min por bloco
    else if (duration === 45) { numBlocks = 9; } // ~5 min por bloco
    else if (duration === 60) { numBlocks = 12; } // ~5 min por bloco (Ideal para transe profundo)
    
    const timePerBlockSeconds = Math.floor((duration * 60) / numBlocks);
    
    // 1. Architect Phase (Gemini 3 Pro)
    const outlinePrompt = `
        Você é um Mestre em Oração Guiada e Hipnoterapia Ericksoniana.
        Crie a ESTRUTURA para uma sessão poderosa de **${duration} minutos**.
        
        **PERSONA:** Você modela a sabedoria de Jesus Cristo, Salomão e Davi, combinada com técnicas avançadas de PNL.
        **TEMA:** "${theme}"
        **ESTILO:** ${type.toUpperCase()}
        
        **OBJETIVO:** Criar uma psicosfera de milagres e alta conexão espiritual.
        **ESTRUTURA:** Divida a sessão em EXATAMENTE **${numBlocks} atos (blocos longos)**. O fluxo deve ser contínuo, sem quebras bruscas.
        
        **Roteiro da Jornada:**
        1. Indução e Conexão (Respiração, Salmos, Foco Interno).
        2. Aprofundamento (Metaforas, Histórias Bíblicas, Transe).
        3. Trabalho Terapêutico/Espiritual (Ressignificação, Milagres, Davi/Salomão).
        4. Clímax e Gratidão (Louvor, Êxtase).
        5. Encerramento e CTA (Chamada para ação no canal "Fé em 10 Minutos de Oração").

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
    let context = `Iniciando sessão de ${duration}min: "${outline.title}".`;

    // 2. Writer Phase (Gemini 2.5 Flash - Alta Densidade e Volume)
    // Processamento sequencial ou pequenos lotes para manter coerência narrativa
    const chunkSize = 3;
    for (let i = 0; i < outline.blocks.length; i += chunkSize) {
        const chunk = outline.blocks.slice(i, i + chunkSize);
        
        const promises = chunk.map(async (block: any) => {
            // Alvo de palavras alto para evitar silêncios
            const targetWordCount = Math.round((timePerBlockSeconds / 60) * wordsPerMinuteBase);

            const blockPrompt = `
                ATUE COMO: Mestre em Oração Guiada e Hipnose Ericksoniana.
                ESCREVA O ROTEIRO FALADO para este bloco de ${Math.round(timePerBlockSeconds/60)} minutos.
                
                **DADOS DO BLOCO:**
                - Tema: ${block.blockTheme}
                - Guia: ${block.guidance}
                - Palavras-Alvo: Aprox. **${targetWordCount} palavras**. (É CRUCIAL ESCREVER BASTANTE).
                
                **INSTRUÇÕES DE FLUXO E CONTEÚDO (MÁXIMA PRIORIDADE):**
                1. **Fluxo Contínuo:** O texto deve fluir como um rio. Evite frases curtas demais. Use conectivos hipnóticos ("e enquanto você ouve...", "isso faz com que...", "perceba agora...").
                2. **Bíblia e PNL:** Cite Salmos e passagens bíblicas (Davi/Salomão) misturados com comandos embutidos de PNL.
                3. **SEO Gatilhos:** Use palavras de poder: "Milagre", "Cura", "Providência", "Destravar", "Céu Aberto".
                4. **CTA:** Se for o último bloco, inclua um convite carinhoso para interagir com o canal "Fé em 10 Minutos de Oração".
                5. **NÃO PARE:** Escreva até completar o pensamento e preencher o tempo. Não tenha pressa. Aprofunde. Aprofunde mais.

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
                
                // Força o targetDuration para o motor de áudio saber o tempo alvo
                blockData.targetDuration = timePerBlockSeconds;
                
                // Validação de segurança para pausas
                if (blockData.instructions.pauseAfter > 30) blockData.instructions.pauseAfter = 20; 

                return blockData;
            } catch (e) {
                console.error("Erro ao gerar bloco:", e);
                return { 
                    text: "Respire fundo... sinta a presença de Deus te envolvendo agora... permaneça neste amor...", 
                    instructions: { mood: 'ethereal', intensity: 0.5, pauseAfter: 10 },
                    targetDuration: timePerBlockSeconds 
                } as AudioScriptBlock;
            }
        });

        const results = await Promise.all(promises);
        fullScript.push(...results);
        context = `Blocos anteriores trataram de: ${chunk.map((b: any) => b.blockTheme).join(', ')}.`;
    }

    return fullScript;
};


const getPrayerRecommendationPrompt = (vector: CoherenceVector, chatHistory?: Message[]): string => {
    const historyContext = chatHistory ? formatChatHistoryForPrompt(chatHistory) : '';
    const userStateContext = `
    Estado Atual (Dissonância = Dor/Necessidade):
    - Propósito: ${vector.proposito.dissonancia}%
    - Mental: ${vector.mental.dissonancia}%
    - Emocional: ${vector.emocional.dissonancia}%
    - Recursos/Financeiro: ${vector.recursos.dissonancia}%
    `;

    return `
    Você é um Mentor Espiritual Profundo.
    Identifique a maior dor do usuário e sugira UM tema de oração poderoso para "Destravar" essa área.
    Use linguagem de "Fé em 10 Minutos". Ex: "Destravando a Prosperidade Sobrenatural", "Cura Profunda da Ansiedade", "Oração de Guerra Espiritual para a Família".

    ${userStateContext}
    ${historyContext}

    Responda APENAS com o título do tema.
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
      if (type === 'diurna') styleInstruction = "ESTILO: DIURNO (Poder, Fogo, Autoridade de Davi). Voz firme, comandos de vitória, gratidão antecipada. Quebra de maldições e ativação de bênçãos.";
      else if (type === 'noturna') styleInstruction = "ESTILO: NOTURNO (Paz, Espírito Santo, Salmos de Refúgio). Voz macia, lenta, indução ao sono profundo em Deus. Entrega total das preocupações.";
      else styleInstruction = "ESTILO: TERAPÊUTICO (Cura Interior, Ressignificação, Sabedoria de Salomão). Uso intenso de Metáforas Terapêuticas e PNL para curar traumas e memórias.";
  
      const historyContext = chatHistory ? formatChatHistoryForPrompt(chatHistory) : '';
      
      return await generateLongPrayer(ai, theme, duration, type, styleInstruction, historyContext);
  
    } catch (error) {
        console.error(`Error generating guided prayer:`, error);
        throw error;
    }
  };
