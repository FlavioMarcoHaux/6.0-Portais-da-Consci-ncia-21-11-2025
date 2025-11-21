import React, { useState, useRef, useEffect } from 'react';
import { Agent, AgentId, ToolId, Session } from '../types.ts';
import { AGENTS, toolMetadata } from '../constants.tsx';
import { X, Send, Mic, Compass, ChevronDown, Bot } from 'lucide-react';
import { useStore } from '../store.ts';
import { useWebSpeech } from '../hooks/useWebSpeech.ts';
import GuideStartButtonWrapper from './GuideStartButtonWrapper.tsx';
import ArchitectLiveConversation from './ArchitectLiveConversation.tsx';

// Helper to convert simple markdown (bold, lists) and custom actions to HTML
const markdownToHtml = (text: string) => {
    if (!text) return { __html: '' };

    // Regex to find [AÇÃO:tool_id:payload]
    const actionRegex = /\[AÇÃO:(.*?):(.*?)\]/g;
    text = text.replace(actionRegex, (match, toolId, payload) => {
        return `<button class="chat-action-button" data-tool-id="${toolId.trim()}" data-payload="${payload.trim()}">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-zap"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
            Iniciar: ${payload.trim()}
        </button>`;
    });
  
    const lines = text.split('\n');
    const newLines = [];
    let inList = false;

    for (const line of lines) {
        let processedLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        if (processedLine.trim().startsWith('* ')) {
            if (!inList) {
                newLines.push('<ul class="chat-ul">');
                inList = true;
            }
            newLines.push(`<li>${processedLine.trim().substring(2)}</li>`);
        } else {
            if (inList) {
                newLines.push('</ul>');
                inList = false;
            }
            newLines.push(processedLine);
        }
    }

    if (inList) {
        newLines.push('</ul>');
    }

    return { __html: newLines.join('<br />') }; // Use <br /> for newlines
};


interface AgentRoomProps {
    agent: Agent;
    onExit: () => void;
}

const AgentRoom: React.FC<AgentRoomProps> = ({ agent, onExit }) => {
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLElement>(null);
    const [isVoiceMode, setIsVoiceMode] = useState(false);
    const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
    const [isMentorListOpen, setIsMentorListOpen] = useState(false);

    const {
        chatHistories,
        isLoadingMessage,
        handleSendMessage,
        switchAgent,
        startSession,
        startGuide,
        visited,
        markAsVisited,
        setPendingGuide,
        coherenceVector,
        toolStates,
    } = useStore();
    
    // Intercept for the Architect of Consciousness to show the live conversation UI
    if (agent.id === AgentId.SELF_KNOWLEDGE) {
        return <ArchitectLiveConversation agent={agent} onExit={onExit} />;
    }


    // Trigger mentor guide on first visit
    useEffect(() => {
        const isFirstVisit = !visited.mentors.includes(agent.id);
        if (isFirstVisit) {
            markAsVisited('mentor', agent.id);
            setTimeout(() => startGuide('mentor', { agent }), 300);
        }
    }, [agent.id, visited.mentors, markAsVisited, startGuide, agent]);
    
    // Attach event listeners for action buttons
    useEffect(() => {
        const container = chatContainerRef.current;
        if (!container) return;

        const handleActionClick = (e: Event) => {
            const target = e.target as HTMLElement;
            const button = target.closest('.chat-action-button');
            if (button) {
                const toolId = button.getAttribute('data-tool-id') as ToolId;
                const payload = button.getAttribute('data-payload');
                if (toolId) {
                    let sessionConfig: Session = { type: toolId as any };
                    if (toolId === 'meditation' && payload) {
                        sessionConfig = { type: 'meditation', initialPrompt: payload };
                    }
                    startSession(sessionConfig);
                }
            }
        };

        container.addEventListener('click', handleActionClick);
        return () => container.removeEventListener('click', handleActionClick);
    }, [chatHistories, agent.id, startSession]);


    const messages = chatHistories[agent.id] || [];
    const lastMessage = messages[messages.length - 1];

    const {
        transcript,
        isListening,
        startListening,
        stopListening,
        speak,
        error: speechError,
    } = useWebSpeech();
    
    useEffect(() => {
        if(isListening) setInput(transcript);
    }, [transcript, isListening]);

    useEffect(() => {
        if (isVoiceMode && lastMessage?.sender === 'agent' && !isLoadingMessage) {
            // Strip out the action syntax before speaking
            const textToSpeak = lastMessage.text.replace(/\[AÇÃO:.*?\]/g, '');
            speak(textToSpeak);
        }
    }, [lastMessage, isVoiceMode, isLoadingMessage, speak]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() && !isLoadingMessage) {
            handleSendMessage(agent.id, input.trim(), coherenceVector, toolStates);
            setInput('');
            if (isListening) stopListening();
        }
    };
    
    const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend(e);
        }
    };
    
    const toggleVoiceMode = () => {
        if(isListening) {
            stopListening();
        } else {
            setIsVoiceMode(true);
            startListening();
        }
    }

    const handleToolClick = (toolId: ToolId) => {
        if (!visited.tools.includes(toolId)) {
            setPendingGuide({ type: 'tool', id: toolId });
        }
        startSession({ type: toolId as any });
        setIsSidePanelOpen(false);
    };


    return (
        <div className="h-full w-full flex animate-fade-in">
            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="flex items-center justify-between p-4 border-b border-gray-700/50" data-guide-id="agent-room-header">
                    <div className="flex items-center gap-4">
                        <agent.icon className={`w-12 h-12 ${agent.themeColor}`} />
                        <div>
                            <h1 className="text-2xl font-bold">{agent.name}</h1>
                            <p className="text-sm text-gray-400">{agent.description}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button onClick={onExit} className="text-gray-400 hover:text-white transition-colors">
                            <X size={24} />
                        </button>
                         <button 
                            onClick={() => setIsSidePanelOpen(true)} 
                            className="lg:hidden text-sm font-semibold text-yellow-300 border border-yellow-500/40 rounded-lg px-4 py-1.5 transition-all hover:bg-yellow-500/10 hover:border-yellow-500/80 animate-subtle-pulse"
                            aria-label="Abrir ferramentas e mentores"
                            data-guide-id="guide-step-5"
                        >
                            Ferramentas
                        </button>
                    </div>
                </header>
                
                <main ref={chatContainerRef} className="flex-1 overflow-y-scroll p-6 space-y-6">
                    {messages.map((message) => (
                        <div key={message.id} className={`flex items-start gap-3 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {message.sender === 'agent' && <agent.icon className={`w-8 h-8 ${agent.themeColor} flex-shrink-0 mt-1`} />}
                            <div className={`max-w-xl px-4 py-3 rounded-2xl ${message.sender === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-gray-700 text-gray-200 rounded-bl-none'}`}>
                                <style>{`
                                    .chat-action-button {
                                        display: inline-flex;
                                        align-items: center;
                                        gap: 0.5rem;
                                        background-color: #4f46e5;
                                        color: white;
                                        padding: 0.5rem 1rem;
                                        border-radius: 9999px;
                                        font-weight: 600;
                                        font-size: 0.875rem;
                                        margin-top: 0.5rem;
                                        cursor: pointer;
                                        transition: background-color 0.2s;
                                    }
                                    .chat-action-button:hover {
                                        background-color: #4338ca;
                                    }
                                `}</style>
                                <div className="text-sm whitespace-pre-wrap">
                                    <div style={{ display: 'inline' }} dangerouslySetInnerHTML={markdownToHtml(message.text)} />
                                    {isLoadingMessage && message.id === messages[messages.length - 1].id && message.sender === 'agent' && (
                                        <span className="inline-block w-2 h-4 ml-1 bg-white animate-pulse" style={{ animationDuration: '1.2s' }}></span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </main>

                <footer className="p-4 border-t border-gray-700/50">
                    {speechError && <p className="text-center text-red-400 text-xs mb-2">{speechError}</p>}
                    <form onSubmit={handleSend} className="relative" data-guide-id="guide-step-4">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyPress}
                            placeholder={isListening ? 'Ouvindo...' : `Converse com ${agent.name}...`}
                            disabled={isLoadingMessage}
                            className="w-full bg-gray-800/80 border border-gray-600 rounded-xl p-4 pr-28 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/80"
                            rows={1}
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                            <button type="button" onClick={toggleVoiceMode} className={`p-2 rounded-full transition-colors ${isListening ? 'bg-red-500/20 text-red-500 animate-pulse' : 'text-gray-400 hover:text-white'}`}>
                                <Mic size={20} />
                            </button>
                            <button type="submit" disabled={!input.trim() || isLoadingMessage} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800/50 text-white p-2 rounded-full transition-colors">
                                <Send size={20} />
                            </button>
                        </div>
                    </form>
                </footer>
            </div>
            
            {isSidePanelOpen && (
                <div 
                    onClick={() => setIsSidePanelOpen(false)}
                    className="lg:hidden fixed inset-0 bg-black/60 z-30 animate-fade-in"
                    aria-hidden="true"
                ></div>
            )}

            <aside className={`
                flex flex-col
                transition-transform duration-300 ease-in-out
                fixed inset-y-0 right-0 h-full w-80 max-w-[85vw] bg-gray-900 shadow-2xl z-40 p-4
                ${isSidePanelOpen ? 'translate-x-0' : 'translate-x-full'}
                lg:static lg:h-auto lg:w-80 lg:shadow-none lg:bg-black/10 lg:translate-x-0
                lg:border-l lg:border-gray-700/50 lg:z-auto
            `}>
                <div className="flex items-center justify-between pb-4 border-b border-gray-700/50 lg:hidden">
                    <h3 className="text-lg font-semibold text-gray-200">Opções do Mentor</h3>
                    <button onClick={() => setIsSidePanelOpen(false)} className="text-gray-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto no-scrollbar min-h-0 pt-4 lg:pt-0">
                     {agent.id === AgentId.GUIDE && (
                        <div className="mb-4">
                            <GuideStartButtonWrapper tourId="main">
                                <button
                                    className="w-full flex items-center justify-center gap-2 p-3 bg-cyan-600/80 rounded-lg cursor-pointer hover:bg-cyan-600 transition-colors"
                                >
                                    <Compass size={20} />
                                    <span className="font-semibold text-sm">Iniciar Guia Interativo</span>
                                </button>
                            </GuideStartButtonWrapper>
                        </div>
                    )}
                    <h3 className="text-md font-semibold text-gray-300 mb-2 animate-fade-in" style={{ animationDelay: '50ms' }}>Ferramentas de {agent.name}</h3>
                    <div className="space-y-2">
                         {agent.tools && agent.tools.length > 0 ? (
                            agent.tools.map((toolId, index) => {
                                const tool = toolMetadata[toolId];
                                if (!tool) return null;
                                return (
                                    <div 
                                        key={toolId} 
                                        onClick={() => handleToolClick(toolId)}
                                        className="p-3 bg-gray-800/70 rounded-lg flex items-center gap-3 cursor-pointer hover:bg-gray-700/90 transition-colors animate-fade-in"
                                        style={{ animationDelay: `${100 + index * 50}ms` }}
                                        data-guide-id={index === 0 ? 'guide-step-6' : undefined}
                                    >
                                        <tool.icon className={`w-7 h-7 ${agent.themeColor} flex-shrink-0`} />
                                        <p className="font-semibold text-sm">{tool.title}</p>
                                    </div>
                                );
                            })
                        ) : (
                            <p className="text-sm text-gray-500 text-center p-4 animate-fade-in" style={{ animationDelay: '100ms' }}>Nenhuma ferramenta disponível para este mentor.</p>
                        )}
                    </div>
                </div>

                <div className="mt-auto pt-4 border-t border-gray-700/50">
                     <button
                        onClick={() => setIsMentorListOpen(prev => !prev)}
                        className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-gray-800/50 transition-colors"
                        aria-expanded={isMentorListOpen}
                    >
                        <h3 className="text-md font-semibold text-gray-300">Trocar Mentor</h3>
                        <ChevronDown 
                            size={20} 
                            className={`text-gray-400 transition-transform duration-300 ${isMentorListOpen ? 'rotate-180' : ''}`} 
                        />
                    </button>
                    {isMentorListOpen && (
                        <div className="mt-2 space-y-2 animate-fade-in">
                            {Object.values(AGENTS).filter(a => a.id !== agent.id).map((otherAgent, index) => (
                                <div 
                                    key={otherAgent.id} 
                                    onClick={() => {
                                        switchAgent(otherAgent.id);
                                        setIsSidePanelOpen(false);
                                    }} 
                                    className="p-2 bg-gray-800/70 rounded-lg flex items-center gap-3 cursor-pointer hover:bg-gray-700/90 transition-colors animate-fade-in"
                                    style={{ animationDelay: `${index * 50}ms` }}
                                >
                                    <otherAgent.icon className={`w-6 h-6 ${otherAgent.themeColor} flex-shrink-0`} />
                                    <p className="font-semibold text-sm">{otherAgent.name}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </aside>
        </div>
    );
};

export default AgentRoom;
