import { GoogleGenAI } from "@google/genai";
import { ActivityLogEntry } from '../types.ts';
import { calculateUcs } from '../store.ts';
import { toolMetadata } from "../constants.tsx";

const SUMMARY_MODEL = 'gemini-2.5-flash';

export const generateProgressSummary = async (
    activityLog: ActivityLogEntry[],
    period: '7d' | '30d'
): Promise<string> => {
    if (activityLog.length < 2) {
        return "Ainda não há dados suficientes para gerar um resumo. Continue sua jornada e volte em breve!";
    }

    const now = Date.now();
    const periodInDays = period === '7d' ? 7 : 30;
    const startDate = now - periodInDays * 24 * 60 * 60 * 1000;

    const relevantActivities = activityLog
        .filter(entry => entry.timestamp >= startDate)
        .sort((a, b) => a.timestamp - b.timestamp);
    
    if (relevantActivities.length < 2) {
        return `Não há atividades suficientes nos últimos ${periodInDays} dias para gerar um resumo. Use uma ferramenta ou converse com um mentor para começar.`;
    }

    const firstUcs = calculateUcs(relevantActivities[0].vectorSnapshot);
    const lastUcs = calculateUcs(relevantActivities[relevantActivities.length - 1].vectorSnapshot);
    const ucsChange = lastUcs - firstUcs;
    
    const toolUsageCounts: Record<string, number> = {};
    relevantActivities.forEach(entry => {
        if (entry.type === 'tool_usage') {
            const toolName = toolMetadata[entry.data.toolId]?.title || entry.data.toolId;
            toolUsageCounts[toolName] = (toolUsageCounts[toolName] || 0) + 1;
        }
    });

    const mostUsedTools = Object.entries(toolUsageCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([name, count]) => `${name} (${count} vezes)`)
        .join(', ');

    const prompt = `
        Você é o "Arquiteto da Consciência", um mentor de IA sábio e perspicaz.
        Sua tarefa é analisar os dados de progresso de um usuário e fornecer um resumo inspirador e acionável.

        **Dados do Período (${periodInDays} dias):**
        - Pontuação de Coerência (Φ) Inicial: ${firstUcs}
        - Pontuação de Coerência (Φ) Final: ${lastUcs}
        - Variação Total: ${ucsChange > 0 ? `+${ucsChange}` : ucsChange} pontos
        - Ferramentas Mais Usadas: ${mostUsedTools || 'Nenhuma'}

        **Instruções para o Resumo:**
        1.  **Tom:** Seja encorajador, sábio e um pouco poético. Aja como um guia, não como um robô.
        2.  **Análise de Tendência:** Comente sobre a variação da pontuação de Coerência. Se subiu, celebre o progresso. Se desceu, ofereça uma perspectiva de que os desafios são oportunidades.
        3.  **Correlação (O Insight Principal):** Se houver ferramentas usadas, tente criar uma conexão entre o uso delas e a mudança na coerência. Ex: "Notei que seu progresso coincide com o uso frequente da ferramenta X..."
        4.  **Sugestão para o Futuro:** Com base nos dados, ofereça uma sugestão gentil para o próximo ciclo. Pode ser continuar usando uma ferramenta eficaz ou explorar uma nova área.
        5.  **Concisão:** Mantenha o resumo em 2-3 parágrafos curtos.

        Gere o resumo agora em Português do Brasil.
    `;

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: SUMMARY_MODEL,
            contents: prompt,
        });

        return response.text.trim();
    } catch (error) {
        console.error("Error generating progress summary:", error);
        throw error;
    }
};