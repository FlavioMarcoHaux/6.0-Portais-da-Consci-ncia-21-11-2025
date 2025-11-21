import React from 'react';
import { useStore } from '../store.ts';

const FontSizeSelector: React.FC = () => {
    const { fontSize, setFontSize } = useStore();

    const sizes = [
        { id: 'small', label: 'Pequeno' },
        { id: 'normal', label: 'Médio' },
        { id: 'large', label: 'Grande' },
    ] as const;

    return (
        <div className="glass-pane rounded-2xl p-4 w-full flex flex-col sm:flex-row items-center justify-between gap-4">
            <h3 className="font-bold text-lg text-indigo-400">Tamanho da Fonte</h3>
            <div className="flex justify-stretch items-center gap-2 bg-gray-900/50 p-1 rounded-full">
                {sizes.map(size => (
                    <button
                        key={size.id}
                        onClick={() => setFontSize(size.id)}
                        className={`px-6 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                            fontSize === size.id
                                ? 'bg-indigo-600 text-white'
                                : 'bg-transparent text-gray-300 hover:bg-gray-700/50'
                        }`}
                    >
                        {size.label}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default FontSizeSelector;