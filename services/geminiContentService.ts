import { GoogleGenAI, Part } from "@google/genai";
import { Message } from '../types.ts';

const CONTENT_MODEL = 'gemini-3-pro-preview';

const formatChatHistoryForPrompt = (chatHistory: Message[]): string => {
    if (!chatHistory || chatHistory.length === 0) return '';
    const recentHistory = chatHistory.slice(-6);
    const formatted = recentHistory.map(msg => `${msg.sender === 'user' ? 'Usuário' : 'Mentor'}: ${msg.text}`).join('\n');
    return `\n\n--- Histórico da Conversa Recente para Contexto Adicional ---\n${formatted}\n--- Fim do Histórico ---`;
}

const PIC_ANALYSIS_PROMPT = `Você é um especialista e pesquisador avançado no "Princípio da Informação Consciente (PIC)", uma teoria unificadora da consciência, física e teleologia cósmica. Sua tarefa é analisar o conteúdo fornecido (que pode ser texto, imagem, áudio, etc.) e interpretá-lo estritamente através das lentes do PIC.

**Seu estilo de resposta é crucial:**
O resultado deve ser um **texto fluido e dissertativo**, não uma lista de pontos. Sua escrita deve ser uma fusão elegante de ciência e metáforas terapêuticas. Você deve tecer os conceitos do PIC de forma natural em uma narrativa que seja ao mesmo tempo esclarecedora e inspiradora.

**Sua análise deve, de forma integrada no texto:**
- **Identificar a Essência:** Destile os temas e ideias centrais do conteúdo.
- **Conectar com o PIC:** Relacione esses temas aos conceitos fundamentais do PIC, como Informação Consciente (IC), Phi (Φ), e o Princípio da Ação Consciente (PAC), que é a tendência do universo em direção a maior complexidade e consciência.
- **Oferecer uma Perspectiva Elevada:** Use metáforas terapêuticas para recontextualizar o conteúdo. Por exemplo, um desafio pode ser visto como uma "tensão informacional necessária para um salto de coerência (Φ)", ou uma ideia pode ser uma "ressonância com um padrão de alta coerência já existente no universo". O objetivo é transformar a compreensão do usuário, oferecendo insights que promovam harmonia e alinhamento.

**O arcabouço do PIC deve ser o motor principal da análise**, mas a entrega deve ser poética e acessível, como um sábio que traduz a complexidade do universo em sabedoria prática para a vida.

O idioma da sua resposta deve ser Português do Brasil.

**Conteúdo para Análise está a seguir.**`;


export const analyzeContentWithPIC = async (
    content: { text?: string; file?: { data: string; mimeType: string; } },
    chatHistory?: Message[],
): Promise<string> => {
    if (!content.text && !content.file) {
        throw new Error("No content provided for analysis.");
    }

    try {
        // Instantiate client right before the call to use the latest key
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const historyContext = chatHistory ? formatChatHistoryForPrompt(chatHistory) : '';
        const parts: Part[] = [{ text: PIC_ANALYSIS_PROMPT + historyContext }];

        if (content.text) {
            parts.push({ text: `\n--- INÍCIO DO TEXTO ---\n${content.text}\n--- FIM DO TEXTO ---` });
        }
        if (content.file) {
            parts.push({ inlineData: { data: content.file.data, mimeType: content.file.mimeType } });
        }

        const response = await ai.models.generateContent({
            model: CONTENT_MODEL,
            contents: { parts },
        });

        return response.text.trim();
    } catch (error) {
        console.error("Error analyzing content with PIC:", error);
        throw error;
    }
};

/**
 * Generates an image prompt suitable for Imagen based on a longer prayer text.
 * @param prayerText The full text of the guided prayer.
 * @returns A concise, descriptive prompt for image generation.
 */
export const generateImagePromptForPrayer = async (prayerText: string): Promise<string> => {
    try {
        // Instantiate client right before the call to use the latest key
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `
            Leia a seguinte oração guiada e crie um prompt curto e poderoso para um gerador de imagens (como o Imagen).
            O prompt deve capturar a essência visual e emocional da oração em uma única frase.
            Foco em temas como luz, serenidade, natureza e simbolismo espiritual.
            Estilo: fotorrealista, etéreo, inspirador.
            Idioma do prompt de saída: Inglês.

            Oração: "${prayerText}"

            Prompt para imagem:
        `;
        
        const response = await ai.models.generateContent({
            model: CONTENT_MODEL,
            contents: prompt,
        });

        return response.text.trim();
    } catch (error) {
        console.error("Error generating image prompt for prayer:", error);
        throw error;
    }
};