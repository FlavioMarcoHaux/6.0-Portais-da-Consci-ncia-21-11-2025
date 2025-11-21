import React, { useEffect, useRef } from 'react';
import { useStore } from '../store.ts';
import { Mic } from 'lucide-react';

const ActivationListener: React.FC = () => {
    const { isListeningModeActive, openVoiceNav } = useStore(state => ({
        isListeningModeActive: state.isListeningModeActive,
        openVoiceNav: state.openVoiceNav,
    }));

    const lastTapRef = useRef(0);

    useEffect(() => {
        if (!isListeningModeActive) {
            return;
        }

        // Keyboard listener
        const handleKeyDown = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'm') {
                event.preventDefault();
                openVoiceNav();
            }
        };

        // Custom double-tap listener for touch devices
        const handleTouchStart = (event: TouchEvent) => {
            if (event.touches.length > 1) return; // Ignore multi-touch gestures
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTapRef.current;
            if (tapLength < 300 && tapLength > 0) {
                const target = event.target as HTMLElement;
                if (!target.closest('button, a, input, textarea, select')) {
                    event.preventDefault();
                    openVoiceNav();
                }
            }
            lastTapRef.current = currentTime;
        };

        // Fallback for non-touch devices (mouse)
        const handleDoubleClick = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest('button, a, input, textarea, select')) {
                openVoiceNav();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        document.documentElement.addEventListener('touchstart', handleTouchStart, { passive: false });
        document.documentElement.addEventListener('dblclick', handleDoubleClick);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.documentElement.removeEventListener('touchstart', handleTouchStart);
            document.documentElement.removeEventListener('dblclick', handleDoubleClick);
        };
    }, [isListeningModeActive, openVoiceNav]);

    if (!isListeningModeActive) {
        return null;
    }

    return (
        <div 
            className="fixed bottom-6 left-6 z-[8999] flex items-center gap-2 p-2 bg-gray-800/80 rounded-full text-cyan-400 text-xs font-semibold animate-fade-in pointer-events-none"
            aria-live="polite"
            aria-label="Modo de audição ativo"
        >
            <Mic size={16} className="animate-pulse" />
        </div>
    );
};

export default ActivationListener;