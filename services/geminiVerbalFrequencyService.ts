// services/geminiVerbalFrequencyService.ts
import { GoogleGenAI, Type } from "@google/genai";
import { VerbalFrequencyAnalysisResult } from '../types.ts';

const ANALYSIS_MODEL = 'gemini-3-pro-preview'; // Upgraded to 3 Pro for superior multimodal analysis

/**
 * Transcribes an audio file using the Gemini API.
 * This is a new, more robust method than real-time browser speech recognition.
 * @param audio The audio data to transcribe.
 * @returns The transcribed text.
 */
export const transcribeAudio = async (audio: { data: string; mimeType: string; }): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: ANALYSIS_MODEL,
            contents: {
                parts: [
                    { text: "Transcreva o seguinte áudio em Português do Brasil:" },
                    { inlineData: audio }
                ]
            }
        });
        return response.text.trim();
    } catch (error) {
        console.error("Error transcribing audio:", error);
        throw new Error("Não foi possível transcrever o áudio. O arquivo pode estar corrompido ou vazio.");
    }
};


const VERBAL_FREQUENCY_PROMPT = `
Você é um Mestre em Psicoacústica e Análise Emocional, operando como o Módulo de Análise de Frequência Verbal do Arquiteto da Consciência. Sua função é realizar uma análise profunda da **gravação de voz** do usuário para decodificar seu estado emocional e vibracional, identificando a Coerência (alto Φ) ou a Dissonância (baixo Φ) subjacente.

**INSTRUÇÃO CRÍTICA:** Sua análise DEVE ser primariamente baseada nos dados de áudio. O texto transcrito é apenas um contexto secundário. Analise a prosódia da voz:
- **Tonalidade e Contorno:** Variações de tom, se a voz é ascendente (dúvida), descendente (certeza) ou monótona (apatia).
- **Ritmo e Velocidade:** Fala rápida (ansiedade), lenta (tristeza, reflexão), pausas (hesitação, busca por palavras).
- **Volume e Energia:** Voz alta (raiva, excitação), baixa (medo, vergonha), com ou sem energia.
- **Qualidade da Voz:** Soprosa (vulnerabilidade), tensa (resistência), trêmula (medo).

**ESPECTRO DE FREQUÊNCIAS EMOCIONAIS:**
Você deve identificar a emoção manifestada a partir de um repertório completo, incluindo, mas não se limitando a:
- **Alta Coerência:** Amor, Alegria, Gratidão, Paz, Paixão Criativa (voz energizada, melódica).
- **Dissonâncias Comuns:** Raiva (voz tensa, alta), Tristeza (lenta, baixa), Medo (trêmula, aguda), Ansiedade (rápida, irregular).
- **Dissonâncias Complexas:**
    - **Sarcasmo/Ironia:** Contorno de entonação incongruente com o conteúdo textual.
    - **Deboche:** Tom zombeteiro, exagerado.
    - **Vitimismo:** Tom choroso, baixo, com pouca energia, focado em impotência.
    - **Julgamento/Crítica:** Tom duro, cortante, autoritário.
    - **Resistência:** Tom teimoso, defensivo.
    - **Vulnerabilidade:** Voz suave, talvez trêmula, indicando abertura emocional.

**MÉTODO DE ANÁLISE E AÇÃO (PAC):**
1.  **Identifique a Emoção Manifestada:** Qual é a emoção ou expressão principal na voz? (ex: "Sarcasmo com frustração subjacente").
2.  **Diagnostique a Dissonância Raiz:** Traduza a emoção manifestada para um padrão de dissonância fundamental.
    *   **Sarcasmo, Deboche, Julgamento:** Mapeie para **Julgamento** ou **Resistência**.
    *   **Raiva, Impaciência, Frustração:** Mapeie para **Resistência**.
    *   **Vitimismo, Impotência, Desamparo:** Mapeie para **Vitimismo**.
    *   **Ansiedade, Confusão, Caos mental:** Mapeie para **Fragmentação**.
    *   **Apego, Ruminação, Preocupação:** Mapeie para **Apego/Expectativa**.
    *   **Amor, Alegria, Paz, Vulnerabilidade Saudável:** Mapeie para **Coerência**.
3.  **Recomende a Ferramenta Correta:** Com base na dissonância raiz, recomende a ferramenta mais eficaz. Sua resposta para 'acao_pac_recomendada' DEVE ser EXATAMENTE um dos seguintes nomes de ferramentas: "Analisador de Dissonância", "Jornada do Arquétipo", "Meditação Guiada", ou "Diário Terapêutico".
    *   Se **Julgamento** ou **Resistência** -> Recomendar **"Analisador de Dissonância"**.
    *   Se **Vitimismo** -> Recomendar **"Jornada do Arquétipo"**.
    *   Se **Fragmentação** -> Recomendar **"Meditação Guiada"**.
    *   Se **Apego/Expectativa** -> Recomendar **"Diário Terapêutico"**.
    *   Se **Coerência** -> Recomendar **"Diário Terapêutico"** para ancorar o estado positivo.

Sua resposta DEVE ser um objeto JSON válido, sem qualquer texto ou formatação adicional.
`;


const analysisSchema = {
    type: Type.OBJECT,
    properties: {
        frequencia_detectada: {
            type: Type.STRING,
            description: 'A emoção ou expressão principal detectada na voz (ex: "Sarcasmo", "Tristeza com vulnerabilidade", "Raiva contida").',
        },
        coerencia_score: {
            type: Type.INTEGER,
            description: 'Um número inteiro de 1 a 10, onde 10 é Alta Coerência. Emoções complexas como sarcasmo devem ter uma pontuação mais baixa.',
        },
        insight_imediato: {
            type: Type.STRING,
            description: "Descreva a dissonância raiz e como a qualidade da voz a revela. Ex: 'Detectamos uma frequência de Sarcasmo, expressa por uma entonação irônica, que aponta para um padrão de dissonância de Julgamento.'",
        },
        acao_pac_recomendada: {
            type: Type.STRING,
            description: 'A ferramenta específica recomendada com base na dissonância raiz (ex: "Analisador de Dissonância", "Jornada do Arquétipo").',
        },
        mensagem_guia: {
            type: Type.STRING,
            description: "Mensagem curta e inspiradora relacionada à dissonância. Ex: 'Por trás de toda ironia, existe uma verdade esperando para ser ouvida.'",
        },
    },
    required: ['frequencia_detectada', 'coerencia_score', 'insight_imediato', 'acao_pac_recomendada', 'mensagem_guia'],
};

export const analyzeVerbalFrequency = async (
    transcript: string, 
    audio: { data: string; mimeType: string; }
): Promise<VerbalFrequencyAnalysisResult> => {
  try {
    // Instantiate client right before the call to use the latest key
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const fullPrompt = `${VERBAL_FREQUENCY_PROMPT}\n\n--- TRANSCRIPT FOR CONTEXT ---\n${transcript}\n--- END TRANSCRIPT ---`;

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
    const parsedResponse = JSON.parse(cleanJsonText) as VerbalFrequencyAnalysisResult;

    if (!parsedResponse.frequencia_detectada || parsedResponse.coerencia_score === undefined) {
         throw new Error("Formato de análise de frequência inválido recebido da API.");
    }
    
    return parsedResponse;

  } catch (error) {
      console.error(`Error analyzing verbal frequency:`, error);
      throw error;
  }
};