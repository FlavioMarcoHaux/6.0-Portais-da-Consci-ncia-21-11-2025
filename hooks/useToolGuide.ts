import { useEffect } from 'react';
import { useStore } from '../store.ts';
import { ToolId } from '../types.ts';

export const useToolGuide = (toolId: ToolId) => {
    const { completedTours, startGuide } = useStore(state => ({
        completedTours: state.completedTours,
        startGuide: state.startGuide,
    }));
    
    const tourIdForTool = `tool_${toolId}`;

    useEffect(() => {
        const isCompleted = completedTours.includes(tourIdForTool);
        if (!isCompleted) {
            // Use a short timeout to allow the tool component to fully render
            setTimeout(() => {
                startGuide(tourIdForTool, { toolId });
            }, 300);
        }
    }, [toolId, completedTours, startGuide, tourIdForTool]);
};
