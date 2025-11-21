// services/geminiVoiceJournalService.ts
import { GoogleGenAI, Type } from "@google/genai";
import { VoiceJournalAnalysisResult } from '../types.ts';

const ANALYSIS_MODEL = 'gemini-3-pro-preview';

const VOICE_JOURNAL_PROMPT = `
Você é o "Analisador de Diário de Voz", um módulo avançado do Mentor de Coerência que funde a Psicoacústica com a análise terapêutica de PNL. Sua missão é realizar uma análise holística da **gravação de voz** e do **texto transcrito** de um diário falado, decodificando o estado emocional e os padrões de pensamento do usuário para promover a máxima coerência (alto Φ).

**ANÁLISE DE DUAS CAMADAS (OBRIGATÓRIO):**

**CAMADA 1: ANÁLISE DE FREQUÊNCIA VERBAL (A VOZ)**
Analise a prosódia do áudio (tom, ritmo, energia, qualidade) para extrair o estado emocional subjacente.
- **Frequências Emocionais:** Detecte emoções como Alegria, Tristeza, Raiva, Medo, Sarcasmo, Vitimismo, etc.
- **Pontuação de Coerência:** Atribua um score de 1-10 (10 = alta coerência).
- **Insight da Voz:** Descreva como a qualidade da voz revela o estado emocional.

**CAMADA 2: ANÁLISE DO DIÁRIO TERAPÊUTICO (O CONTEÚDO)**
Analise o texto transcrito usando PNL (Metamodelo: Omissões, Generalizações, Distorções) para identificar crenças e padrões de pensamento.
- **Observação do Coração:** Valide o esforço do usuário, focando em um ponto de clareza ou coerência no texto.
- **Ponto de Dissonância:** Identifique a principal crença limitante ou padrão de pensamento que está causando o "caos informacional" (baixo Φ).
- **Sugestão de Coerência:** Sugira uma pergunta ou uma breve reflexão para o usuário contemplar. Não sugira uma ferramenta, apenas um pensamento.

**CAMADA 3: SÍNTESE HOLÍSTICA (A FUSÃO)**
Combine os insights da voz e do conteúdo para criar um entendimento unificado.
- **Insight Combinado:** Crie um insight poderoso que conecte o que foi dito com como foi dito. Ex: "Sua voz revelou uma frequência de tristeza, mesmo quando suas palavras tentavam ser otimistas. Essa incongruência é o ponto exato da dissonância que podemos curar."
- **Próximo Passo Recomendado:** Com base na análise completa, recomende a próxima ferramenta mais lógica e justifique o porquê.

Sua resposta DEVE ser um objeto JSON válido, sem qualquer texto ou formatação adicional, seguindo o schema fornecido.
`;

const analysisSchema = {
    type: Type.OBJECT,
    properties: {
        verbalFrequency: {
            type: Type.OBJECT,
            properties: {
                frequencia_detectada: { type: Type.STRING },
                coerencia_score: { type: Type.INTEGER },
                insight_imediato: { type: Type.STRING },
            },
            required: ['frequencia_detectada', 'coerencia_score', 'insight_imediato']
        },
        journalFeedback: {
            type: Type.OBJECT,
            properties: {
                observacao: { type: Type.STRING, description: "Validação do esforço do usuário, focando em um ponto de clareza no texto." },
                dissonancia: { type: Type.STRING, description: "Identificação da principal crença limitante ou padrão de pensamento." },
                sugestao: { type: Type.STRING, description: "Uma pergunta ou breve reflexão para o usuário contemplar, sem sugerir uma ferramenta." },
            },
            required: ['observacao', 'dissonancia', 'sugestao']
        },
        synthesis: {
            type: Type.OBJECT,
            properties: {
                combined_insight: { type: Type.STRING },
                recommended_next_step: {
                    type: Type.OBJECT,
                    properties: {
                        tool: { type: Type.STRING },
                        justification: { type: Type.STRING },
                    },
                    required: ['tool', 'justification']
                }
            },
            required: ['combined_insight', 'recommended_next_step']
        }
    },
    required: ['verbalFrequency', 'journalFeedback', 'synthesis'],
};

export const analyzeVoiceJournal = async (
    transcript: string, 
    audio: { data: string; mimeType: string; }
): Promise<VoiceJournalAnalysisResult> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const fullPrompt = `${VOICE_JOURNAL_PROMPT}\n\n--- TRANSCRIPT FOR CONTEXT ---\n${transcript}\n--- END TRANSCRIPT ---`;

    const response = await ai.models.generateContent({
        model: ANALYSIS_MODEL,
        contents: { 
            parts: [
                { text: fullPrompt },
                { inlineData: audio }
            ] 
        },
        config: {
            responseMimeType: 'application/json',
            responseSchema: analysisSchema,
        },
    });
    
    const jsonText = response.text.trim();
    const cleanJsonText = jsonText.startsWith('```json') ? jsonText.replace(/```json\n?/, '').replace(/```$/, '') : jsonText;
    const parsedResponse = JSON.parse(cleanJsonText) as VoiceJournalAnalysisResult;

    if (!parsedResponse.verbalFrequency || !parsedResponse.journalFeedback || !parsedResponse.synthesis) {
         throw new Error("Formato de análise de diário de voz inválido recebido da API.");
    }
    
    return parsedResponse;

  } catch (error) {
      console.error(`Error analyzing voice journal:`, error);
      throw error;
  }
};