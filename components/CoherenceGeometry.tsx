import React from 'react';
import { CoherenceVector, CoherenceLevel } from '../types.ts';

interface CoherenceGeometryProps {
    vector: CoherenceVector;
    theme: CoherenceLevel['theme'];
}

const CoherenceGeometry: React.FC<CoherenceGeometryProps> = ({ vector, theme }) => {
    const size = 350;
    const padding = 70;
    const radius = (size / 2) - padding;
    const center = size / 2;

    const dimensions: { key: keyof Omit<CoherenceVector, 'alinhamentoPAC'>; name: string; }[] = [
        { key: 'proposito', name: 'Propósito' },
        { key: 'mental', name: 'Mental' },
        { key: 'relacional', name: 'Relacional' },
        { key: 'emocional', name: 'Emocional' },
        { key: 'somatico', name: 'Somático' },
        { key: 'eticoAcao', name: 'Ação' },
        { key: 'recursos', name: 'Recursos' },
    ];

    const angleStep = (2 * Math.PI) / dimensions.length;
    const startAngle = -Math.PI / 2; // Start at the top

    const coherencePoints = dimensions.map((dim, i) => {
        const value = vector[dim.key].coerencia;
        const angle = startAngle + i * angleStep;
        const pointRadius = (value / 100) * radius;
        const x = center + pointRadius * Math.cos(angle);
        const y = center + pointRadius * Math.sin(angle);
        return `${x},${y}`;
    }).join(' ');

    const dissonancePoints = dimensions.map((dim, i) => {
        const value = vector[dim.key].dissonancia;
        const angle = startAngle + i * angleStep;
        const pointRadius = (value / 100) * radius;
        const x = center + pointRadius * Math.cos(angle);
        const y = center + pointRadius * Math.sin(angle);
        return `${x},${y}`;
    }).join(' ');
    
    const labelPoints = dimensions.map((dim, i) => {
        const angle = startAngle + i * angleStep;
        const labelRadius = radius + 18;
        const x = center + labelRadius * Math.cos(angle);
        const y = center + labelRadius * Math.sin(angle);
        
        let textAnchor: 'start' | 'middle' | 'end' = 'middle';
        let dominantBaseline: 'auto' | 'hanging' | 'middle' | 'alphabetic' = 'middle';
        let dy = 0;

        switch(i) {
            case 0: textAnchor = 'middle'; dominantBaseline = 'alphabetic'; dy = -4; break;
            case 1: textAnchor = 'start'; dominantBaseline = 'middle'; break;
            case 2: textAnchor = 'start'; dominantBaseline = 'middle'; break;
            case 3: textAnchor = 'start'; dominantBaseline = 'hanging'; dy = 4; break;
            case 4: textAnchor = 'end'; dominantBaseline = 'hanging'; dy = 4; break;
            case 5: textAnchor = 'end'; dominantBaseline = 'middle'; break;
            case 6: textAnchor = 'end'; dominantBaseline = 'middle'; break;
        }

        return { x, y, dy, label: dim.name, textAnchor, dominantBaseline };
    });

    // Calculate radius for the central PAC glow
    const pacRadius = (vector.alinhamentoPAC / 100) * radius * 0.7;

    return (
        <svg 
            width="100%" 
            height="100%" 
            viewBox={`0 0 ${size} ${size}`}
            role="img"
            aria-label="Gráfico de radar mostrando os níveis de coerência e dissonância em sete dimensões da vida."
        >
            <defs>
                <radialGradient id="glow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                    <stop offset="0%" style={{ stopColor: theme.glowColor, stopOpacity: 1 }} />
                    <stop offset="100%" style={{ stopColor: 'rgba(79, 70, 229, 0)', stopOpacity: 0 }} />
                </radialGradient>
            </defs>
            
            {/* Central PAC Glow */}
            <circle cx={center} cy={center} r={pacRadius} fill="url(#glow)" />

            {/* Concentric Circles */}
            {[0.25, 0.5, 0.75, 1].map(r => (
                 <circle
                    key={r}
                    cx={center}
                    cy={center}
                    r={radius * r}
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.1)"
                    strokeWidth="1"
                />
            ))}
             {/* Radial Lines */}
            {dimensions.map((_, i) => (
                <line
                    key={i}
                    x1={center}
                    y1={center}
                    x2={center + radius * Math.cos(startAngle + i * angleStep)}
                    y2={center + radius * Math.sin(startAngle + i * angleStep)}
                    stroke="rgba(255, 255, 255, 0.1)"
                    strokeWidth="1"
                />
            ))}
           
            {/* Dissonance Layer (Outer Line) */}
            <polygon
                points={dissonancePoints}
                fill="rgba(219, 39, 119, 0.2)"
                stroke={theme.dissonanceStroke}
                strokeWidth="1.5"
                strokeDasharray="3 3"
            />
            
            {/* Coherence Layer (Inner Fill) */}
            <polygon
                points={coherencePoints}
                fill={theme.coherenceFill}
                stroke="#818CF8"
                strokeWidth="2"
            />

            {/* Labels */}
            {labelPoints.map(({ x, y, dy, label, textAnchor, dominantBaseline }) => (
                <text
                    key={label}
                    x={x}
                    y={y}
                    dy={dy}
                    fill="rgba(255, 255, 255, 0.9)"
                    fontSize="12"
                    textAnchor={textAnchor}
                    dominantBaseline={dominantBaseline as any}
                    className="font-medium chart-label"
                >
                    {label}
                </text>
            ))}
        </svg>
    );
};

export default CoherenceGeometry;