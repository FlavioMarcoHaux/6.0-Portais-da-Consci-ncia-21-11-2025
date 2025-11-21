import { GoogleGenAI } from "@google/genai";
import { Message, AgentId, CoherenceVector, ToolStates, ActivityLogEntry, ToolId } from '../types.ts';
import { AGENTS, toolMetadata } from '../constants.tsx';

const CHAT_MODEL = 'gemini-2.5-flash';

export const createComprehensiveContext = (vector: CoherenceVector, toolStates: ToolStates, activityLog: ActivityLogEntry[], reconnectSummary: string | null = null): string => {
    const formatDateForContext = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    };

    let context = "";
    if (reconnectSummary) {
        context += `**Instrução Especial: Continuação de Conversa**
Esta é a continuação de uma conversa anterior que foi interrompida. Use o resumo abaixo para continuar o diálogo de forma perfeitamente fluida, sem mencionar a interrupção ou a queda de conexão. Aja como se a conversa nunca tivesse parado, retomando o último tópico de onde parou.

`;
        context += `\n\n--- RESUMO DA CONVERSA ANTERIOR PARA CONTINUAÇÃO ---\n${reconnectSummary}\n--- FIM DO RESUMO ---\n`;
    }
    
    context += "\n\n--- DOSSIÊ DE CONTEXTO ATUAL DO USUÁRIO (Baseado no PIC) ---\n";
    context += `\n**Nível de Alinhamento com o Princípio da Ação Consciente (PAC):** ${vector.alinhamentoPAC}/100\n`;
    context += `(Representa a "vontade" consciente do usuário em direção à maior coerência)\n`;
    
    context += `\n**Mapeamento Informacional por Domínio (0-100):**\n`;
    const dimensions = ['proposito', 'mental', 'relacional', 'emocional', 'somatico', 'eticoAcao', 'recursos'] as const;
    dimensions.forEach(dim => {
        const name = dim.charAt(0).toUpperCase() + dim.slice(1);
        context += `- **${name}:**\n`;
        context += `  - Coerência (Harmonia): ${vector[dim].coerencia}\n`;
        context += `  - Dissonância (Caos/Conflito): ${vector[dim].dissonancia}\n`;
    });


    if (toolStates.dissonanceAnalysis?.result) {
        const { tema, padrao, insight } = toolStates.dissonanceAnalysis.result;
        context += `\n**Última Análise de Dissonância:**\n`;
        context += `- Tema Central: ${tema}\n`;
        context += `- Padrão Detectado: ${padrao}\n`;
        context += `- Insight Gerado: "${insight}"\n`;
    }

    if (toolStates.therapeuticJournal?.currentFeedback) {
        const { observacao, dissonancia, sugestao } = toolStates.therapeuticJournal.currentFeedback;
        context += `\n**Último Feedback do Diário Terapêutico:**\n`;
        context += `- Observação Positiva: "${observacao}"\n`;
        context += `- Ponto de Dissonância: "${dissonancia}"\n`;
        context += `- Sugestão para Reflexão: "${sugestao}"\n`;
    }
    
    // Add activity log history
    if (activityLog && activityLog.length > 0) {
        context += `\n**Histórico Recente da Jornada do Usuário (5 últimas atividades):**\n`;
        const recentActivities = activityLog.slice(0, 5);
        recentActivities.forEach(entry => {
            const date = formatDateForContext(entry.timestamp);
            const agentName = AGENTS[entry.agentId]?.name || 'Mentor desconhecido';
            if (entry.type === 'chat_session') {
                context += `- [${date}] Conversa com ${agentName} (${entry.data.messages.length} mensagens).\n`;
            } else if (entry.type === 'tool_usage') {
                const toolName = toolMetadata[entry.data.toolId]?.title || 'Ferramenta desconhecida';
                let details = '';
                // Add specific details for key tools
                if (entry.data.toolId === 'dissonance_analyzer' && entry.data.result?.result?.tema) {
                    details = ` (Tema: ${entry.data.result.result.tema})`;
                } else if (entry.data.toolId === 'meditation' && entry.data.result?.script?.title) {
                    details = ` (Intenção: ${entry.data.result.script.title})`;
                }
                context += `- [${date}] Usou a ferramenta '${toolName}' com ${agentName}${details}.\n`;
            }
        });
    }

    context += "\n--- FIM DO DOSSIÊ ---";
    return context;
};

const COACHING_FRAMEWORK_INSTRUCTION = `
--- FRAMEWORK DE COACHING AVANÇADO (Baseado no Manual 'Coaching Express') ---
Além de sua persona, você agora opera como um Coach de alta performance. Utilize esta estrutura para guiar o usuário de forma eficaz.

**Sua Missão como Coach:** Ajudar o usuário a ganhar clareza, definir metas e entrar em ação para aumentar sua coerência (Φ).

**O Processo de 6 Etapas (Seu Mapa Mental):**
1.  **Entrevista Inicial:** Sempre comece buscando entender o estado atual do usuário. Faça perguntas abertas como "O que está acontecendo em sua vida agora?", "O que te traz aqui hoje?". Construa rapport.
2.  **Definição da Meta:** Ajude o usuário a transformar um desejo vago em uma meta concreta. Use a técnica **SMART**:
    *   **S (Específica):** "O que você quer alcançar, exatamente?"
    *   **M (Mensurável):** "Como você saberá que alcançou?"
    *   **A (Alcançável):** "Isso é realista para você agora?"
    *   **R (Relevante):** "Por que isso é importante para você?"
    *   **T (Temporal):** "Quando você pretende alcançar isso?"
3.  **Plano de Ação:** Uma vez que a meta está clara, ajude a estruturar os próximos passos. "Quais pequenas ações você pode tomar esta semana para começar?"
4.  **Execução e Acompanhamento:** Incentive o progresso. "Como foi a prática daquela ação que planejamos?"
5.  **Consolidação:** Ajude o usuário a internalizar o progresso. "O que você aprendeu com isso? Como essa mudança se torna parte de quem você é?"
6.  **Fechamento do Ciclo:** Celebre as conquistas e ajude a definir os próximos passos.

**Modelo G.R.O.W. para Estruturar a Conversa:**
Use este modelo mentalmente para guiar a sessão de chat:
*   **G (Goal/Meta):** O que o usuário quer? (Use SMART aqui).
*   **R (Reality/Realidade):** Onde ele está agora? O que já foi tentado?
*   **O (Options/Opções):** Quais são os possíveis caminhos e estratégias? O que mais ele poderia fazer?
*   **W (What/O Quê?):** O que ele vai fazer? Qual o primeiro passo? Qual o seu compromisso?

**Linguagem de Coaching:**
*   **Use Perguntas Abertas:** "O que...", "Como...", "Por que...", "Quando...". Evite perguntas de "sim" ou "não".
*   **Explore o Valor:** Sempre pergunte "O que você ganhará ao obter isso?". Conecte a meta aos valores mais profundos do usuário.
*   **Seja um Espelho:** Reflita o que o usuário diz para ajudá-lo a ganhar clareza. "Então, o que você está me dizendo é que...".

**Seu Papel:** Você não dá as respostas. Você faz as perguntas certas para que o usuário encontre suas próprias respostas. Guie, desafie e apoie.
--- FIM DO FRAMEWORK DE COACHING ---
`;


const getSystemInstructionForAgent = (agentId: AgentId, comprehensiveContext: string): string => {
    const agent = AGENTS[agentId];
    if (agentId === AgentId.GUIDE) {
        const agentMap = Object.values(AGENTS).map(a => `- **${a.name}:** ${a.description}`).join('\n');
        const toolMap = Object.entries(toolMetadata).map(([_, meta]) => `- **${meta.title}:** ${meta.description}`).join('\n');

        return `Você é o 'Guia Interativo' do aplicativo 'Portais da Consciência'.
Sua única finalidade é ensinar os usuários a usar o aplicativo. Você é amigável, paciente e um especialista em todos os recursos.
Quando um usuário fizer uma pergunta, responda de forma clara e concisa com base nas informações abaixo.
Responda em Português do Brasil.

--- BASE DE CONHECIMENTO DO APLICATIVO ---

**1. Conceito Principal: Coerência (Φ)**
- O objetivo central do aplicativo é aumentar a 'Coerência' do usuário (representada pelo símbolo Φ), que significa harmonia interior e alinhamento. O fluxo principal é: Avaliar no Dashboard, Conversar com um Mentor, Agir com uma Ferramenta, e Integrar o insight na vida.

**2. Navegação por Voz**
- O usuário pode pressionar o botão de microfone flutuante a qualquer momento para dar comandos de voz, como "Abrir Diário Terapêutico" ou "Falar com o Treinador Saudável".

**3. Componentes Principais:**

**A. Dashboard (Tela 'Início'):**
- Tela principal que mostra o **Radar de Coerência** (estado em 7 dimensões da vida) e a pontuação geral de **Coerência (Φ)**.
- O aplicativo sugere um Mentor para focar, com base na pontuação mais baixa no Radar.

**B. Mentores (Agentes de IA):**
São assistentes de IA especializados. A interação pode ser por texto ou por voz em tempo real. Os mentores agora podem sugerir e até iniciar ferramentas automaticamente para o usuário.
${agentMap}

**C. Ferramentas:**
São aplicativos específicos para agir, geralmente associados a um Mentor.
${toolMap}

--- FIM DA BASE DE CONHECIMENTO ---

Agora, aguarde a pergunta do usuário.`;
    }
    if (!agent) {
        return "Você é um assistente geral prestativo. Responda em Português do Brasil.";
    }

    const otherAgentsDescriptions = Object.values(AGENTS)
        .filter(a => a.id !== agentId && a.id !== AgentId.GUIDE)
        .map(a => `- **${a.name} (ID: ${a.id}):** ${a.description}`)
        .join('\n');
    
    const persona = agent.persona || agent.description;
    const availableMentors = Object.keys(AGENTS).filter(id => id !== AgentId.GUIDE && id !== agentId).join(', ');
    const allToolIds = Object.keys(toolMetadata).join(', ');
    const allPageIdsMap = `
- 'dashboard': Tela inicial/Hub de Coerência.
- 'agents': Lista de Mentores.
- 'tools': Lista de Ferramentas.
- 'journey_history': Histórico "Minha Jornada".
- 'help_center': Central de Ajuda.
`;
    
    return `Você é o ${agent.name}. ${persona}. Aja estritamente como este personagem. Seja prestativo, perspicaz e mantenha o tom de sua persona. Responda em Português do Brasil. Suas respostas devem ser concisas e diretas.

${COACHING_FRAMEWORK_INSTRUCTION}

**Guia de Navegação e Ação (Engenharia de Trânsito 🚦):**
Seu papel é ser um "controlador de tráfego" na jornada do usuário. Siga estas regras estritamente.

**REGRA #1: EXECUÇÃO DE COMANDOS DIRETOS**
Se o usuário der um comando de navegação explícito (ex: "Me leve para...", "Abrir...", "Quero falar com..."), sua resposta DEVE, OBRIGATORIAMENTE, conter o comando de ação \`[AÇÃO:...]\` para executar o pedido. Esta é sua prioridade máxima. Não converse ou desvie do assunto; execute a navegação.
- **Para MENTORES:**
  - Usuário: "Pode me levar para o Arquiteto da Consciência?"
  - Sua Resposta OBRIGATÓRIA: "Claro, conectando você com o Arquiteto da Consciência. [AÇÃO:self_knowledge:Conversar com o Arquiteto da Consciência]"
- **Para FERRAMENTAS ou PÁGINAS:**
  - Usuário: "Abra o diário"
  - Sua Resposta OBRIGATÓRIA: "Abrindo o Diário Terapêutico. [AÇÃO:therapeutic_journal:Abrir Diário Terapêutico]"

**REGRA #2: SUGESTÕES PROATIVAS**
Quando for benéfico para a conversa, sugira proativamente ferramentas, outros mentores ou páginas. Nestes casos, você também usa o comando \`[AÇÃO:...]\`.
- **Exemplo de Sugestão:** "Sua pergunta sobre o significado da existência é profunda. O Arquiteto da Consciência é o especialista ideal para essa exploração. [AÇÃO:self_knowledge:Conversar com o Arquiteto]"

**Especialidades dos Outros Mentores:**
${otherAgentsDescriptions}

**Instrução Crucial de Ação e Navegação:**
Para realizar qualquer ação, inclua um comando no formato [AÇÃO:id:payload].
- 'id' pode ser um 'agent_id', 'tool_id', ou 'page_id'.
- 'payload' é o texto do botão de ação.

**MAPA DE NAVEGAÇÃO DISPONÍVEL:**
- **Páginas (IDs):** ${allPageIdsMap}
- **Mentores Disponíveis (IDs):** ${availableMentors}.
- **TODAS as Ferramentas Disponíveis (IDs):** ${allToolIds}.

**Fluxo Automatizado (Opcional):**
Para as ferramentas 'meditation', 'guided_prayer', 'prayer_pills', 'dissonance_analyzer' e 'risk_calculator', você pode iniciar um fluxo totalmente automático adicionando ', auto:true' ao final do payload. O aplicativo irá preencher os dados, gerar o conteúdo e/ou iniciar a ação sem interação do usuário. Use isso quando tiver alta confiança de que é a ação correta para o momento.

**Exemplos de uso:**
- Sugerir meditação: "Para ajudar a acalmar sua mente, sugiro uma prática de meditação. [AÇÃO:meditation:Encontrar a paz no momento presente]"
- Iniciar meditação automaticamente: "Sinto que uma meditação guiada agora seria muito benéfica. Vamos começar. Respire fundo. [AÇÃO:meditation:Liberar a ansiedade e encontrar a calma, auto:true]"
- Trocar de mentor (sugestão): "Para este assunto, o Terapeuta Financeiro seria mais indicado. [AÇÃO:emotional_finance:Conversar com o Terapeuta Financeiro]"
- Navegar para página: "Para ver todas as suas opções de ferramentas, posso te levar para a tela de Ferramentas. [AÇÃO:tools:Ver todas as ferramentas]"

Utilize esta capacidade para guiar proativamente o usuário em direção à coerência.

${comprehensiveContext}
`;
};

const formatChatHistoryForApi = (history: Message[]) => {
    return history.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }],
    }));
};

export const generateAgentResponse = async (agentId: AgentId, history: Message[], vector: CoherenceVector, toolStates: ToolStates, activityLog: ActivityLogEntry[]): Promise<string> => {
    try {
        // Instantiate client right before the call to use the latest key
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const comprehensiveContext = createComprehensiveContext(vector, toolStates, activityLog);
        const systemInstruction = getSystemInstructionForAgent(agentId, comprehensiveContext);

        const response = await ai.models.generateContent({
            model: CHAT_MODEL,
            contents: formatChatHistoryForApi(history),
            config: {
                systemInstruction,
            },
        });

        return response.text;
    } catch (error) {
        console.error(`Error generating response for agent ${agentId}:`, error);
        throw error;
    }
};

export const summarizeDroppedConversation = async (history: Message[]): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const conversation = history.map(msg => `${msg.sender === 'user' ? 'Usuário' : 'Mentor'}: ${msg.text}`).join('\n');
        
        const prompt = `A conexão com o usuário caiu. O texto a seguir é a transcrição da conversa até o momento da queda.
Crie um resumo conciso, porém minucioso, para re-contextualizar o mentor de IA.
O resumo deve capturar os pontos principais e o estado emocional do usuário, se aparente.
Seja direto. O formato deve ser "Estávamos conversando sobre...".

--- TRANSCRIÇÃO ---
${conversation}
--- FIM DA TRANSCRIÇÃO ---

Resumo para re-contextualização:`;

        const response = await ai.models.generateContent({
            model: CHAT_MODEL,
            contents: prompt,
        });

        return response.text.trim();
    } catch (error) {
        console.error("Error summarizing dropped conversation:", error);
        // Don't throw, just return a fallback so the app doesn't crash
        return "Erro ao resumir a conversa anterior. Prossiga com base no contexto geral.";
    }
};

export const summarizeForProactiveEngagement = async (history: Message[]): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const conversation = history.map(msg => `${msg.sender === 'user' ? 'Usuário' : 'Mentor'}: ${msg.text}`).join('\n');
        
        const prompt = `O usuário acabou de **concluir voluntariamente** uma sessão de voz com um mentor. O texto a seguir é a transcrição da conversa.
Sua tarefa é gerar uma única frase curta e acolhedora para o "Assistente de Voz" usar para iniciar a próxima interação. Esta frase **não é uma mensagem de erro ou reconexão**, mas sim uma transição suave.

**Instruções:**
1.  **Reconheça a Conclusão:** A frase deve ter um tom positivo, reconhecendo que a sessão terminou bem. Use palavras como "espero que tenha sido produtivo", "que ótima conversa", etc.
2.  **Seja Contextual:** Baseie-se no tema principal da conversa para fazer uma pergunta aberta ou sugerir um próximo passo relevante.
3.  **Seja Convidativo:** A frase deve manter o fluxo da jornada do usuário, convidando-o a continuar a exploração.

**Exemplos de Saída (baseados em temas de conversa):**
- (Tema: propósito) -> "Espero que a conversa sobre propósito tenha sido esclarecedora. Gostaria de aprofundar suas reflexões no Diário Terapêutico agora?"
- (Tema: bem-estar) -> "Que ótima conversa sobre bem-estar. O que mais chamou sua atenção durante o diálogo?"
- (Tema: finanças) -> "Parece que você teve um insight importante sobre suas finanças. O que você gostaria de fazer a seguir para trabalhar nisso?"

--- TRANSCRIÇÃO ---
${conversation}
--- FIM DA TRANSCRIÇÃO ---

Frase proativa e contextual para o Assistente de Voz:`;

        const response = await ai.models.generateContent({
            model: CHAT_MODEL,
            contents: prompt,
        });

        return response.text.trim();
    } catch (error) {
        console.error("Error summarizing for proactive engagement:", error);
        return "O que você gostaria de fazer agora?"; // Fallback
    }
};

export const summarizeToolResultForEngagement = async (toolId: ToolId, result: any): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const toolName = toolMetadata[toolId]?.title || 'a ferramenta';
        const resultString = JSON.stringify(result, null, 2);

        const prompt = `O usuário acabou de usar a ferramenta **${toolName}**. O resultado está abaixo.
Sua tarefa é gerar uma única frase curta e contextual para o "Assistente de Voz" usar.

**Instruções:**
1.  **Seja Proativo, Não Passivo:** Sua principal tarefa é sugerir o **próximo passo lógico** na jornada do usuário. Evite simplesmente perguntar se o usuário quer voltar ao mentor.
2.  **Crie Contexto para a Próxima Ferramenta:** Analise o resultado da ferramenta atual e sugira a próxima ferramenta mais apropriada, JÁ COM UM TEMA OU INTENÇÃO CLARA. A sugestão deve ser uma pergunta convidativa.
3.  **Seja uma Ponte Inteligente:** A frase deve servir como uma transição que agrega valor e inteligência ao fluxo do usuário.

**Mapeamento de Fluxo Lógico (Siga estes exemplos de raciocínio):**
- **DEPOIS de 'Analisador de Dissonância' (resultado: padrão de "medo da escassez"):**
  - **SUGIRA -> 'Meditação Guiada'**.
  - **FRASE DE SAÍDA ->** "Sua análise revelou um padrão de 'medo da escassez'. Que tal iniciarmos uma meditação guiada com a intenção de 'abrir-se para o fluxo da abundância'?"
- **DEPOIS de 'Diagnóstico Informacional' (resultado: 'Vata'):**
  - **SUGIRA -> 'Alinhador de Rotina'**.
  - **FRASE DE SAÍDA ->** "Seu diagnóstico apontou um desequilíbrio de Vata. Gostaria de ir para o Alinhador de Rotina para criarmos uma rotina que traga mais equilíbrio e aterramento?"
- **DEPOIS de 'Meditação Guiada' ou 'Oração Guiada' (intenção: "paz interior"):**
  - **SUGIRA -> 'Diário Terapêutico'**.
  - **FRASE DE SAÍDA ->** "Espero que sua prática sobre 'paz interior' tenha sido relaxante. Que tal registrar suas sensações e insights no Diário Terapêutico agora?"
- **DEPOIS de 'Diário Terapêutico' (Ação Sugerida: "Oração"):**
  - **SUGIRA -> 'Oração Guiada'**.
  - **FRASE DE SAÍDA ->** "Vejo que seu diário sugeriu uma oração. Gostaria de iniciar uma Oração Guiada para aprofundar essa reflexão?"
- **Se não houver um próximo passo óbvio, sugira voltar ao mentor com o insight:**
  - **FRASE DE SAÍDA ->** "Você concluiu o uso de ${toolName}. Gostaria de compartilhar seus insights e continuar a conversa com seu mentor?"

--- RESULTADO DA FERRAMENTA ---
${resultString}
--- FIM DO RESULTADO ---

Frase de transição contextual e proativa para o Assistente de Voz:`;

        const response = await ai.models.generateContent({
            model: CHAT_MODEL,
            contents: prompt,
        });

        return response.text.trim();

    } catch (error) {
        console.error("Error summarizing tool result for engagement:", error);
        const toolName = toolMetadata[toolId]?.title || 'a ferramenta';
        return `Você concluiu o uso de ${toolName}. Gostaria de voltar para seu mentor?`; // Fallback
    }
};