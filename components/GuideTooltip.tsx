import React from 'react';
import { X, ArrowRight, ArrowLeft } from 'lucide-react';

interface GuideTooltipProps {
  step: number;
  totalSteps: number;
  content: { title: string; text: string; };
  style: React.CSSProperties;
  onPrev: () => void;
  onNext: () => void;
  onSkip: () => void;
}

const GuideTooltip = React.forwardRef<HTMLDivElement, GuideTooltipProps>(
  ({ step, totalSteps, content, style, onPrev, onNext, onSkip }, ref) => {
    return (
      <div
        ref={ref}
        className="fixed z-[10000] glass-pane p-4 rounded-lg w-80 max-w-[90vw] animate-fade-in border border-indigo-500/30"
        style={style}
      >
        <div className="flex justify-between items-start mb-2">
          <div>
              <span className="text-xs font-bold text-indigo-400">PASSO {step + 1} DE {totalSteps}</span>
              <h3 className="font-bold text-gray-100">{content.title}</h3>
          </div>
          <button onClick={onSkip} className="text-gray-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        
        <p className="text-sm text-gray-300 mb-4">{content.text}</p>
        
        <div className="flex justify-between items-center">
            <div>
                {step > 0 && (
                    <button onClick={onPrev} className="text-xs text-gray-400 hover:text-white flex items-center gap-1">
                        <ArrowLeft size={14} /> Voltar
                    </button>
                )}
            </div>
          <button
            onClick={onNext}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-full text-sm flex items-center gap-1"
          >
            {step === totalSteps - 1 ? 'Concluir' : 'Próximo'} <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }
);

export default GuideTooltip;
