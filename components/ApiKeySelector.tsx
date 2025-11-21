
import React, { useState, useEffect, useCallback } from 'react';
import { KeyRound, Sparkles, Loader2, Lock, Zap } from 'lucide-react';

interface ApiKeySelectorProps {
    onValid: () => void;
}

const ApiKeySelector: React.FC<ApiKeySelectorProps> = ({ onValid }) => {
    const [status, setStatus] = useState<'checking' | 'waiting' | 'error'>('checking');
    const [retryCount, setRetryCount] = useState(0);

    const triggerAuth = useCallback(async () => {
        setStatus('checking');
        
        // Check if we are in the AI Studio environment
        if (typeof window !== 'undefined' && (window as any).aistudio) {
            try {
                const hasKey = await (window as any).aistudio.hasSelectedApiKey();
                if (hasKey) {
                    onValid();
                } else {
                    setStatus('waiting');
                    await (window as any).aistudio.openSelectKey();
                    // We optimistically check again after a short delay as the user interaction happens in the modal
                    setTimeout(() => {
                       // If the user selected a key, the next check or reload will catch it. 
                       // For UX flow, we let them click "Entrar no Portal" if auto-detect doesn't trigger immediately.
                    }, 1000);
                }
            } catch (error) {
                console.error("AI Studio Key Error:", error);
                setStatus('error');
            }
        } else {
            // Fallback for dev environments without the extension
            console.warn("AI Studio object not found");
            // If we have a hardcoded env var (dev mode), we might pass, otherwise error.
            if (process.env.API_KEY) {
                onValid();
            } else {
                setStatus('error');
            }
        }
    }, [onValid]);

    useEffect(() => {
        triggerAuth();
    }, [triggerAuth, retryCount]);

    return (
        <div className="fixed inset-0 z-[9999] bg-[#0D1117] flex items-center justify-center overflow-hidden">
            {/* Ambient Background Effects */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-[#0D1117] to-[#0D1117] animate-pulse" style={{ animationDuration: '4s' }}></div>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50"></div>
            
            <div className="relative glass-pane p-8 sm:p-12 rounded-3xl max-w-md w-full text-center border border-indigo-500/30 shadow-[0_0_60px_rgba(79,70,229,0.15)] animate-fade-in mx-4">
                
                {/* Iconography */}
                <div className="relative mb-8">
                    <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 rounded-full transform scale-150"></div>
                    <div className="relative bg-[#0D1117] p-4 rounded-full inline-flex items-center justify-center border border-indigo-500/50 shadow-xl">
                        {status === 'checking' ? (
                            <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
                        ) : (
                            <Lock className="w-10 h-10 text-indigo-400" />
                        )}
                    </div>
                </div>

                <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 via-white to-purple-200 mb-3 tracking-tight">
                    Portais da Consciência
                </h1>
                
                <p className="text-gray-400 mb-8 leading-relaxed">
                    Para acessar a sabedoria infinita do cosmos, uma chave de acesso é necessária. Conecte-se para iniciar sua jornada.
                </p>
                
                <div className="space-y-4">
                    <button
                        onClick={() => setRetryCount(c => c + 1)}
                        className="w-full group relative px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl transition-all duration-300 transform hover:scale-[1.02] shadow-lg hover:shadow-indigo-500/25 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3 overflow-hidden"
                        disabled={status === 'checking'}
                    >
                        <div className="absolute inset-0 bg-white/10 group-hover:translate-x-full transition-transform duration-500 skew-x-12 -ml-4"></div>
                        
                        {status === 'checking' ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>Sincronizando...</span>
                            </>
                        ) : (
                            <>
                                <KeyRound className="w-5 h-5" />
                                <span>Entrar no Portal</span>
                            </>
                        )}
                    </button>

                    {status === 'error' && (
                         <p className="text-xs text-red-400 mt-4 animate-fade-in">
                            Não foi possível detectar o ambiente do Google AI Studio.
                         </p>
                    )}
                    
                     {status === 'waiting' && (
                         <button 
                            onClick={() => triggerAuth()}
                            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex items-center justify-center gap-1 mx-auto mt-4"
                         >
                            <Zap size={12} />
                            Tentar conectar novamente
                         </button>
                    )}
                </div>

                <div className="mt-8 pt-6 border-t border-gray-800">
                     <p className="text-[10px] text-gray-600 uppercase tracking-widest">Sistema de Navegação Quântica v5.0</p>
                </div>
            </div>
        </div>
    );
};

export default ApiKeySelector;
