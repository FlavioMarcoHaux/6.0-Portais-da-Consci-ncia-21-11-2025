import { useState, useEffect } from 'react';

const useMediaQuery = (query: string): boolean => {
    const [matches, setMatches] = useState(() => {
        if (typeof window !== 'undefined') {
            return window.matchMedia(query).matches;
        }
        return false;
    });

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }
        
        const media = window.matchMedia(query);
        if (media.matches !== matches) {
            setMatches(media.matches);
        }
        
        const listener = (event: MediaQueryListEvent) => setMatches(event.matches);
        media.addEventListener('change', listener);
        
        return () => media.removeEventListener('change', listener);
    }, [matches, query]);

    return matches;
};

export default useMediaQuery;