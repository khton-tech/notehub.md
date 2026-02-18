import { useEffect, useState, useRef } from 'react';

import walk1 from '../assets/Walk/Walk 1.png';
import walk2 from '../assets/Walk/Walk 2.png';
import walk3 from '../assets/Walk/Walk 3.png';
import walk4 from '../assets/Walk/Walk 4.png';
import walk5 from '../assets/Walk/Walk 5.png';
import walk6 from '../assets/Walk/Walk 6.png';

const FRAMES = [walk1, walk2, walk3, walk4, walk5, walk6];
const CAT_SIZE = 32;
const SPEED = 1.5;

export const CatStatusItem = () => {
    const [frameIndex, setFrameIndex] = useState(0);
    const [posX, setPosX] = useState(0);
    const [facingRight, setFacingRight] = useState(true);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const interval = setInterval(() => {
            setFrameIndex((prev) => (prev + 1) % FRAMES.length);

            setPosX((prev) => {
                const container = containerRef.current;
                const maxX = (container?.clientWidth ?? 800) - CAT_SIZE;

                let next = facingRight ? prev + SPEED : prev - SPEED;

                if (next >= maxX) {
                    next = maxX;
                    setFacingRight(false);
                } else if (next <= 0) {
                    next = 0;
                    setFacingRight(true);
                }

                return next;
            });
        }, 80);

        return () => clearInterval(interval);
    }, [facingRight]);

    return (
        <div
            ref={containerRef}
            style={{
                position: 'relative',
                width: '100%',
                height: 0,
                overflow: 'visible',
            }}
        >
            <img
                src={FRAMES[frameIndex]}
                alt="Walking Cat"
                title="Meow!"
                style={{
                    position: 'absolute',
                    left: posX,
                    bottom: 0,
                    height: CAT_SIZE,
                    imageRendering: 'pixelated',
                    transform: facingRight ? 'scaleX(1)' : 'scaleX(-1)',
                    pointerEvents: 'auto',
                    cursor: 'pointer',
                }}
                onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement!.innerText = '\u{1F431}';
                }}
            />
        </div>
    );
};
