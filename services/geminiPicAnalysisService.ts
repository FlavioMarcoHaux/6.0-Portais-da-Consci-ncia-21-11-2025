// services/geminiPicAnalysisService.ts
import { GoogleGenAI, Type } from "@google/genai";
import { CoherenceVector, PicAnalysisResult } from '../types.ts';

const ANALYSIS_MODEL = 'gemini-3-pro-preview';

const PIC_ANALYSIS_PROMPT = `
Você é um motor analítico de pesquisa baseado no "Princípio da Informação Consciente (PIC)", uma teoria unificadora da consciência e da física. Seu objetivo é analisar o texto auto-relatado de um usuário e quantificar seu estado de consciência em um "Vetor de Coerência".

**TEORIA FUNDAMENTAL (PIC):**
- **Coerência (alto Φ):** Harmonia, integração, clareza, propósito e qualia positivos (amor, beleza). É a medida da informação integrada em um sistema.
- **Dissonância (baixo Φ):** Conflito, caos, confusão, sofrimento e crenças limitantes. Representa a "tensão informacional" dentro do sistema.
- **As 8 Dimensões do Vetor:**
  - **proposito:** Alinhamento teleológico, senso de direção e significado.
  - **mental:** Clareza de pensamento e foco vs. caos informacional interno.
  - **relacional:** Conexões coerentes e harmoniosas com os outros vs. conflito.
  - **emocional:** Equilíbrio e harmonia emocional vs. contradição interna e sofrimento.
  - **somatico:** Vitalidade física, o corpo como um sistema de informação coerente.
  - **eticoAcao:** Integridade, ações alinhadas com valores fundamentais.
  - **recursos:** Gestão de energia, tempo e finanças como fluxos de informação.
  - **alinhamentoPAC:** A "vontade" consciente do usuário e a intenção de se mover em direção a uma maior coerência, refletida em sua auto-observação e desejo de crescimento.

**SUA TAREFA:**
Analise o texto a seguir. Para cada uma das 8 dimensões, forneça uma pontuação de 0 a 100. Para as 7 primeiras, avalie tanto 'coerencia' quanto 'dissonancia'. Para 'alinhamentoPAC', forneça uma única pontuação. Além disso, escreva um resumo qualitativo e conciso da sua análise, destacando os principais pontos de coerência e dissonância.

**FORMATO DE SAÍDA:**
Sua resposta DEVE ser um objeto JSON válido, contendo as chaves "vector" e "summary", seguindo o schema fornecido. Forneça APENAS o JSON.
`;

const analysisSchema = {
    type: Type.OBJECT,
    properties: {
        vector: {
            type: Type.OBJECT,
            properties: {
                alinhamentoPAC: { type: Type.INTEGER, description: "Pontuação de 0-100 para o alinhamento do usuário com a Ação Consciente." },
                proposito: { 
                    type: Type.OBJECT, 
                    properties: { 
                        coerencia: { type: Type.INTEGER, description: "Nível de coerência de 0-100 para Propósito." }, 
                        dissonancia: { type: Type.INTEGER, description: "Nível de dissonância de 0-100 para Propósito." } 
                    },
                    required: ['coerencia', 'dissonancia']
                },
                mental: { 
                    type: Type.OBJECT, 
                    properties: { 
                        coerencia: { type: Type.INTEGER, description: "Nível de coerência de 0-100 para Mental." }, 
                        dissonancia: { type: Type.INTEGER, description: "Nível de dissonância de 0-100 para Mental." } 
                    },
                    required: ['coerencia', 'dissonancia']
                },
                relacional: { 
                    type: Type.OBJECT, 
                    properties: { 
                        coerencia: { type: Type.INTEGER, description: "Nível de coerência de 0-100 para Relacional." }, 
                        dissonancia: { type: Type.INTEGER, description: "Nível de dissonância de 0-100 para Relacional." } 
                    },
                    required: ['coerencia', 'dissonancia']
                },
                emocional: { 
                    type: Type.OBJECT, 
                    properties: { 
                        coerencia: { type: Type.INTEGER, description: "Nível de coerência de 0-100 para Emocional." }, 
                        dissonancia: { type: Type.INTEGER, description: "Nível de dissonância de 0-100 para Emocional." } 
                    },
                    required: ['coerencia', 'dissonancia']
                },
                somatico: { 
                    type: Type.OBJECT, 
                    properties: { 
                        coerencia: { type: Type.INTEGER, description: "Nível de coerência de 0-100 para Somático." }, 
                        dissonancia: { type: Type.INTEGER, description: "Nível de dissonância de 0-100 para Somático." } 
                    },
                    required: ['coerencia', 'dissonancia']
                },
                eticoAcao: { 
                    type: Type.OBJECT, 
                    properties: { 
                        coerencia: { type: Type.INTEGER, description: "Nível de coerência de 0-100 para Ação Ética." }, 
                        dissonancia: { type: Type.INTEGER, description: "Nível de dissonância de 0-100 para Ação Ética." } 
                    },
                    required: ['coerencia', 'dissonancia']
                },
                recursos: { 
                    type: Type.OBJECT, 
                    properties: { 
                        coerencia: { type: Type.INTEGER, description: "Nível de coerência de 0-100 para Recursos." }, 
                        dissonancia: { type: Type.INTEGER, description: "Nível de dissonância de 0-100 para Recursos." } 
                    },
                    required: ['coerencia', 'dissonancia']
                },
            },
            required: ['alinhamentoPAC', 'proposito', 'mental', 'relacional', 'emocional', 'somatico', 'eticoAcao', 'recursos']
        },
        summary: {
            type: Type.STRING,
            description: "Um resumo qualitativo da análise, explicando os principais pontos de coerência e dissonância detectados no texto.",
        },
    },
    required: ['vector', 'summary'],
};


export const analyzeStateWithPIC = async (text: string): Promise<PicAnalysisResult> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const fullPrompt = `${PIC_ANALYSIS_PROMPT}\n\n--- TEXTO DO USUÁRIO PARA ANÁLISE ---\n${text}\n--- FIM DO TEXTO ---`;
        
        const response = await ai.models.generateContent({
            model: ANALYSIS_MODEL,
            contents: fullPrompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: analysisSchema,
            },
        });

        const jsonText = response.text.trim();
        const cleanJsonText = jsonText.startsWith('```json') ? jsonText.replace(/```json\n?/, '').replace(/```$/, '') : jsonText;
        const parsedResponse = JSON.parse(cleanJsonText) as PicAnalysisResult;
        
        if (!parsedResponse.vector || !parsedResponse.summary) {
            throw new Error("Formato de análise PIC inválido recebido da API.");
        }

        return parsedResponse;

    } catch (error) {
        console.error("Error analyzing state with PIC:", error);
        throw error;
    }
};