
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
        title: { type: Type.STRING, description: "Título poderoso da oração (Otimizado para SEO)." },
        blocks: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    blockTheme: { type: Type.STRING, description: "Tema deste bloco (ex: Salmo 91, Quebra de Maldição, Ancoragem de Milagre)." },
                    guidance: { type: Type.STRING, description: "Instrução de PNL/Hipnose e Referência Bíblica para este bloco." },
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
        text: { type: Type.STRING, description: "O texto exato a ser falado. Deve ser LONGO, DENSO e FLUÍDO." },
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
    
    // ESTRATÉGIA DE FLUXO DE MESTRE (HIPNOTERAPIA & ESPIRITUALIDADE)
    // Para evitar "TDAH" e quebras, usamos blocos extremamente densos.
    // Cada bloco funciona como um "Ato" completo de uma sessão de hipnose profunda.
    
    let numBlocks = 3; 
    let wordsPerMinuteBase = 130; // Aumentado para garantir densidade verbal alta.

    // Cálculo de Atos para Jornada do Herói Espiritual
    if (duration <= 5) { numBlocks = 1; }
    else if (duration <= 10) { numBlocks = 2; }
    else if (duration <= 15) { numBlocks = 3; }
    else if (duration <= 20) { numBlocks = 4; }
    else if (duration <= 30) { numBlocks = 5; } 
    else if (duration <= 45) { numBlocks = 7; } 
    else if (duration >= 60) { numBlocks = 10; } // Blocos de ~6 min cada = Profundidade Extrema
    
    const timePerBlockSeconds = Math.floor((duration * 60) / numBlocks);
    
    // 1. Architect Phase (Gemini 3 Pro) - O Estrategista Espiritual
    const outlinePrompt = `
        Você é um Mestre em Oração Guiada, com treinamento em PNL e Hipnose Ericksoniana.
        Especialista em modelar a autoridade de Jesus Cristo, a sabedoria de Salomão e a adoração de Davi.
        
        **MISSÃO:** Criar a ESTRUTURA para uma sessão profunda de **${duration} minutos** sobre o tema: "${theme}".
        **ESTILO:** ${type.toUpperCase()}
        
        **ESTRUTURA DA SESSÃO (Hipnose Espiritual):**
        Divida a sessão em EXATAMENTE **${numBlocks} ATOS**. O fluxo deve ser uma escada que desce para o espírito e sobe para o céu.
        
        1. **Indução (Salmos & Respiração):** Uso de Salmos (23, 91) para criar segurança e transe leve.
        2. **Aprofundamento (Metáforas de Jesus):** Parábolas e cura interior. Quebra de padrão.
        3. **Clímax (Autoridade de Davi):** Guerra espiritual, decretos de milagres, uso de palavras de poder.
        4. **Integração (Sabedoria de Salomão):** Selando a benção, gratidão antecipada.
        5. **CTA Poderoso:** Convite para ação no canal "Fé em 10 Minutos de Oração".

        Retorne JSON com a estrutura dos blocos.
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
    let context = `Iniciando Sessão Mestra de ${duration}min: "${outline.title}".`;

    // 2. Writer Phase (Gemini 2.5 Flash) - O Orador Ungido
    const chunkSize = 2; // Processar em pares para manter coerência
    for (let i = 0; i < outline.blocks.length; i += chunkSize) {
        const chunk = outline.blocks.slice(i, i + chunkSize);
        
        const promises = chunk.map(async (block: any) => {
            // Alvo de palavras para preencher o tempo sem silêncio constrangedor
            const targetWordCount = Math.round((timePerBlockSeconds / 60) * wordsPerMinuteBase);

            const blockPrompt = `
                ATUE COMO: Mestre em Oração Guiada (Modelagem: Jesus/Davi/Salomão + PNL Avançada).
                ESCREVA O ROTEIRO FALADO para este bloco de ~${Math.round(timePerBlockSeconds/60)} minutos.
                
                **DADOS DO BLOCO:**
                - Tema: ${block.blockTheme}
                - Instrução: ${block.guidance}
                - META DE TEXTO: Mínimo de **${targetWordCount} palavras**. (ESCREVA EXTENSIVAMENTE).
                
                **REGRAS DE OURO (FLUXO MESTRE):**
                1. **FLUXO CONTÍNUO (Sem TDAH):** Não faça frases curtas e picotadas. Use "Loopings Hipnóticos" (ex: "E enquanto você sente essa paz, essa paz se expande, e expandindo ela toca seu coração..."). Conecte tudo.
                2. **BÍBLIA VIVA:** Cite a Bíblia não como leitura, mas como decreto. "Como disse o Salmista...", "Assim como Jesus ordenou...".
                3. **SEO & GATILHOS:** Use palavras-chave de alto impacto espiritual: "Milagre Imediato", "Destravar Financeiro", "Cura Divina", "Providência", "Céu Aberto", "Anjos", "Batalha Espiritual".
                4. **PSICOSFERA:** Descreva a atmosfera. "Sinta o peso da Glória", "O vento do Espírito", "O calor da presença".
                5. **CTA (Apenas no último bloco):** Convide com autoridade para se inscrever e comentar no canal "Fé em 10 Minutos de Oração".
                
                ${styleInstruction}
                
                Contexto Anterior: ${context}

                Responda APENAS com o JSON. O texto deve ser pronto para falar.
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
                // Limite de segurança para pausas, o engine de áudio gerencia o resto
                if (blockData.instructions.pauseAfter > 30) blockData.instructions.pauseAfter = 20; 

                return blockData;
            } catch (e) {
                console.error("Erro ao gerar bloco:", e);
                return { 
                    text: "E neste momento de silêncio, Deus trabalha em seu favor... receba a paz que excede todo entendimento... continue respirando Sua graça...", 
                    instructions: { mood: 'ethereal', intensity: 0.5, pauseAfter: 15 },
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
    Estado Atual (Dissonância detectada):
    - Propósito: ${vector.proposito.dissonancia}%
    - Emocional: ${vector.emocional.dissonancia}%
    - Financeiro/Recursos: ${vector.recursos.dissonancia}%
    `;

    return `
    Você é um Mentor Espiritual Profundo (Modelo Canal "Fé em 10 Minutos").
    Identifique a maior dor oculta do usuário e sugira UM tema de oração "Clickbait Espiritual" (título poderoso e irresistível).
    Exemplos: "Oração Urgente para Destravar a Vida Financeira", "Quebra de Maldição Hereditária Agora", "Cura da Ansiedade em 10 Minutos".

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
      if (type === 'diurna') styleInstruction = "ESTILO: DIURNO (Fogo de Elias). Voz firme, autoridade, decretos de vitória para o dia. Energia alta, despertar, conquista, batalha espiritual.";
      else if (type === 'noturna') styleInstruction = "ESTILO: NOTURNO (Colo do Pai). Voz macia, sussurrada, hipnótica. Salmos de proteção (91), entrega de ansiedade, indução ao sono profundo e reparador.";
      else styleInstruction = "ESTILO: TERAPÊUTICO (Cura de Jesus). Foco em traumas, perdão, limpeza de memórias. Uso de metáforas de cura, toque divino, ressignificação emocional profunda.";
  
      const historyContext = chatHistory ? formatChatHistoryForPrompt(chatHistory) : '';
      
      return await generateLongPrayer(ai, theme, duration, type, styleInstruction, historyContext);
  
    } catch (error) {
        console.error(`Error generating guided prayer:`, error);
        throw error;
    }
  };
