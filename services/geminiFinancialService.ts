import { GoogleGenAI, Type } from "@google/genai";
import { SpendingEntry, ToolId } from '../types.ts';

const ANALYSIS_MODEL = 'gemini-3-pro-preview';

export const analyzeSpendingPatterns = async (entries: SpendingEntry[]): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const dataString = JSON.stringify(entries.map(e => ({ valor: e.value, categoria: e.category, emocao: e.emotion })));

        const prompt = `Atuando como um Terapeuta Financeiro, analise estes dados de gastos e emoções: ${dataString}. 
        Identifique o principal padrão de 'gastos emocionais', explique a possível função psicológica desse comportamento e ofereça uma pergunta gentil para reflexão.
        
        Exemplo de Resposta:
        "Seu mapa revela um padrão interessante: a sensação de Tédio parece ser um forte gatilho para gastos em Lazer e Comida. É como se você estivesse usando o dinheiro para 'comprar' pequenas doses de entusiasmo. Isso é uma estratégia perfeitamente humana para buscar alegria. A pergunta que podemos explorar é: 'Que outra atividade, talvez sem custo, poderia trazer essa mesma sensação de novidade e prazer quando o tédio aparecer?'"

        Sua resposta deve ser fluida, empática e sem julgamentos. Responda em Português do Brasil.`;

        const response = await ai.models.generateContent({
            model: ANALYSIS_MODEL,
            contents: prompt,
        });

        return response.text;
    } catch (error) {
        console.error("Error analyzing spending patterns:", error);
        throw error;
    }
};

const nextStepSchema = {
    type: Type.OBJECT,
    properties: {
        toolId: {
            type: Type.STRING,
            description: 'O ID da ferramenta recomendada.',
            enum: ['meditation', 'belief_resignifier', 'therapeutic_journal']
        },
        payload: {
            type: Type.STRING,
            description: 'O tema ou intenção para pré-preencher na ferramenta.'
        }
    },
    required: ['toolId', 'payload'],
};

export const generateNextStepFromAnalysis = async (analysisText: string): Promise<{ toolId: ToolId; payload: string; }> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const prompt = `Você é um "Orquestrador de Jornada" do aplicativo Portais da Consciência. Sua tarefa é ler a análise financeira e emocional a seguir, que foi gerada para um usuário, e sugerir o próximo passo mais lógico e terapêutico para ele.

**Análise Recebida:**
"${analysisText}"

**Sua Missão:**
Com base na análise, decida qual ferramenta ajudaria mais o usuário a trabalhar no padrão identificado. Sua resposta DEVE ser um objeto JSON.

- Se o padrão é sobre ansiedade, estresse ou necessidade de calma, sugira a ferramenta 'meditation' com um 'payload' (tema) focado em acalmar.
- Se o padrão é sobre uma crença limitante sobre dinheiro (ex: "dinheiro é difícil"), sugira 'belief_resignifier' com um 'payload' que seja a crença a ser trabalhada.
- Se o padrão é mais complexo e precisa de reflexão profunda, sugira 'therapeutic_journal' com um 'payload' que seja uma pergunta para guiar a escrita.

**Ferramentas disponíveis para sugestão (toolId):**
- 'meditation'
- 'belief_resignifier'
- 'therapeutic_journal'

**Formato de Saída OBRIGATÓRIO:**
Responda APENAS com o objeto JSON, sem nenhum texto ou formatação adicional.`;

        const response = await ai.models.generateContent({
            model: ANALYSIS_MODEL,
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: nextStepSchema,
            },
        });

        const jsonText = response.text.trim();
        const parsedResponse = JSON.parse(jsonText);

        if (!parsedResponse.toolId || !parsedResponse.payload) {
            throw new Error("Resposta da IA para o próximo passo está em formato inválido.");
        }

        return parsedResponse as { toolId: ToolId; payload: string; };

    } catch (error) {
        console.error("Error generating next step from analysis:", error);
        throw error;
    }
};