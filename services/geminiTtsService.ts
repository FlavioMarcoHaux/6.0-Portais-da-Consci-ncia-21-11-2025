import { GoogleGenAI, Modality } from "@google/genai";

const TTS_MODEL = "gemini-2.5-flash-preview-tts";

// Define the available voice names for type safety.
export type TtsVoice = 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';
export type TtsContext = 'meditation-relax' | 'meditation-power' | 'meditation' | 'default';

export const generateSpeech = async (
  text: string, 
  voiceName: TtsVoice = 'Zephyr',
  context: TtsContext = 'default',
  userPrompt?: string
): Promise<{ data: string; mimeType: string; } | null> => {
  try {
    // Instantiate client right before the call to use the latest key
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    let promptText = text;
    
    // Handle contexts
    const effectiveContext = context === 'meditation' ? 'meditation-relax' : context;

    if (effectiveContext.startsWith('meditation')) {
        let styleInstruction = "";

        if (effectiveContext === 'meditation-power') {
             // Power Up Style
             styleInstruction = "Fale com um tom inspirador, motivador e levemente energético. O ritmo deve ser fluido, vivo e assertivo, não sonolento. Transmita confiança, força e despertar. Evite falar rápido demais, mas mantenha uma cadência ativa.";
        } else {
            // Relax Style (Default)
             styleInstruction = "Fale de forma extremamente calma, lenta e com pausas longas, criando uma atmosfera de relaxamento profundo e transe hipnótico. O tom deve ser suave, aveludado e acolhedor, ideal para dormir ou acalmar a ansiedade.";
        }

        // Legacy support override
        if (userPrompt && effectiveContext === 'meditation-relax') {
            const fastKeywords = ['rápida', 'energia', 'energizar', 'foco', 'motivação', 'despertar', 'ânimo', 'vigor'];
            const lowerUserPrompt = userPrompt.toLowerCase();
            if (fastKeywords.some(keyword => lowerUserPrompt.includes(keyword))) {
                 styleInstruction = "Fale em um ritmo um pouco mais rápido e energizado, mas ainda claro e positivo, para motivar e focar.";
            }
        }
        
        promptText = `${styleInstruction}: "${text}"`;
    }

    const response = await ai.models.generateContent({
      model: TTS_MODEL,
      contents: [{ parts: [{ text: promptText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName },
          },
        },
      },
    });

    const audioPart = response.candidates?.[0]?.content?.parts?.[0];
    if (audioPart?.inlineData?.data) {
      return {
        data: audioPart.inlineData.data,
        mimeType: audioPart.inlineData.mimeType,
      };
    }
    return null;
  } catch (error) {
    console.error("Error generating speech:", error);
    // Do not throw, return null so the render engine can insert silence instead of crashing
    return null;
  }
};