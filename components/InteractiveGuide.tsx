import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useStore } from '../store.ts';
import { guides, GuideStep } from '../guides.ts';
import GuideTooltip from './GuideTooltip.tsx';

const InteractiveGuide: React.FC = () => {
    const { guideState, prevGuideStep, nextGuideStep, endGuide } = useStore();
    const { isActive, step, tourId, context } = guideState;

    const [spotlightStyle, setSpotlightStyle] = useState<React.CSSProperties>({ display: 'none' });
    const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });
    const [currentStep, setCurrentStep] = useState<GuideStep | null>(null);
    const [viewportVersion, setViewportVersion] = useState(0); // Dummy state to trigger repositioning
    const tooltipRef = useRef<HTMLDivElement>(null);

    const tour = tourId ? guides[tourId] : null;
    
    // Effect to handle window resize
    useEffect(() => {
        const handleResize = () => {
            setViewportVersion(v => v + 1); // Trigger re-calculation
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (!isActive || !tour) {
            setCurrentStep(null);
            return;
        }

        const stepToShow = tour[step];

        if (stepToShow) {
            // Action is now handled by the 'next' button, not on step load.
            setCurrentStep(stepToShow);
        } else {
            endGuide();
        }
    }, [isActive, tourId, step, tour, endGuide]);

    const positionElements = useCallback(() => {
        if (!isActive || !currentStep || !currentStep.element) {
            setSpotlightStyle({ display: 'none' });
            setTooltipStyle({ visibility: 'hidden' });
            return;
        }
        
        const targetElement = document.querySelector(currentStep.element) as HTMLElement;
        if (!targetElement || targetElement.offsetWidth === 0) {
            return;
        }

        const targetRect = targetElement.getBoundingClientRect();

        // 1. Set Spotlight Position
        setSpotlightStyle({
            width: `${targetRect.width + 12}px`,
            height: `${targetRect.height + 12}px`,
            top: `${targetRect.top - 6}px`,
            left: `${targetRect.left - 6}px`,
            display: 'block',
        });

        // 2. Calculate and Set Tooltip Position (viewport-aware)
        const tooltipNode = tooltipRef.current;
        const tooltipWidth = 320;
        const tooltipHeight = tooltipNode ? tooltipNode.offsetHeight : 150;
        const margin = 12;

        let top = targetRect.bottom + margin;
        let left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;

        if (top + tooltipHeight > window.innerHeight) {
            top = targetRect.top - tooltipHeight - margin;
        }
        if (top < 0) {
            top = margin;
        }
        if (left + tooltipWidth > window.innerWidth) {
            left = window.innerWidth - tooltipWidth - margin;
        }
        if (left < 0) {
            left = margin;
        }

        setTooltipStyle({
            top: `${top}px`,
            left: `${left}px`,
            visibility: 'visible',
        });
    }, [isActive, currentStep]);

    useLayoutEffect(() => {
        if (!isActive || !currentStep?.element) {
            setSpotlightStyle({ display: 'none' });
            setTooltipStyle({ visibility: 'hidden' });
            return;
        }
    
        let intervalId: number;
        let scrollTimeoutId: number;
    
        const findAndPosition = () => {
            let attempts = 0;
            const maxAttempts = 30; // 3 seconds timeout
    
            intervalId = window.setInterval(() => {
                const targetElement = document.querySelector(currentStep.element) as HTMLElement;
    
                if (targetElement && targetElement.offsetWidth > 0) {
                    clearInterval(intervalId);
                    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                    // Delay positioning to allow for scroll animation to finish
                    scrollTimeoutId = window.setTimeout(positionElements, 400);
                    return; // Stop the interval checks
                }
    
                attempts++;
                if (attempts > maxAttempts) {
                    clearInterval(intervalId);
                    console.warn(`Guide element not found:`, currentStep.element);
                    endGuide();
                }
            }, 100);
        };
    
        findAndPosition();
    
        // Cleanup function for the effect
        return () => {
            if (intervalId) clearInterval(intervalId);
            if (scrollTimeoutId) clearTimeout(scrollTimeoutId);
        };
    }, [currentStep, isActive, endGuide, positionElements, viewportVersion]);

    if (!isActive || !currentStep || !tour) {
        return null;
    }

    const handleNext = () => {
        // Run the action for the CURRENT step before moving to the next one.
        const currentAction = tour?.[step]?.action;
        if (currentAction) {
            currentAction();
        }

        if (step >= tour.length - 1) {
            endGuide();
        } else {
            nextGuideStep();
        }
    };

    const handlePrev = () => {
        prevGuideStep();
    }

    const handleSkip = () => {
        endGuide();
    };

    const content = {
        title: currentStep.title.replace(/\$\{agent\.name\}/g, context?.agent?.name || 'seu mentor'),
        text: currentStep.text.replace(/\$\{agent\.name\}/g, context?.agent?.name || 'seu mentor'),
    };
    
    return (
        <>
            <div 
                className="guide-overlay" 
                style={{ 
                    opacity: isActive ? 1 : 0, 
                    pointerEvents: isActive ? 'auto' : 'none' 
                }} 
                onClick={handleSkip} 
            />
            <div 
                className="guide-spotlight guide-spotlight-pulse" 
                style={spotlightStyle} 
            />
            <GuideTooltip
                ref={tooltipRef}
                step={step}
                totalSteps={tour.length}
                content={content}
                style={tooltipStyle}
                onPrev={handlePrev}
                onNext={handleNext}
                onSkip={handleSkip}
            />
        </>
    );
};

export default InteractiveGuide;