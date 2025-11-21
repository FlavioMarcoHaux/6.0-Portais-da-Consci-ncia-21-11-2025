import React from 'react';
import { useStore } from '../store.ts';

interface GuideStartButtonWrapperProps {
    children: React.ReactNode;
    tourId: string;
    context?: any;
}

const GuideStartButtonWrapper: React.FC<GuideStartButtonWrapperProps> = ({ children, tourId, context }) => {
    const startGuide = useStore(state => state.startGuide);

    const handleClick = () => {
        startGuide(tourId, context);
    };

    const child = React.Children.only(children);
    // Clone the child element (the button) and inject the new onClick handler
    const childWithHandler = React.cloneElement(child as React.ReactElement<any>, {
        onClick: handleClick,
    });

    return childWithHandler;
};

export default GuideStartButtonWrapper;
