import { useEffect, useRef } from 'react';

import walk1 from '../assets/Walk/Walk 1.png';
import walk2 from '../assets/Walk/Walk 2.png';
import walk3 from '../assets/Walk/Walk 3.png';
import walk4 from '../assets/Walk/Walk 4.png';
import walk5 from '../assets/Walk/Walk 5.png';
import walk6 from '../assets/Walk/Walk 6.png';

const FRAMES = [walk1, walk2, walk3, walk4, walk5, walk6];
const CAT_SIZE = 32;
const SPEED = 1.0;
const FRAME_INTERVAL = 80; // ms per frame

export const CatStatusItem = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const catRef = useRef<HTMLImageElement>(null);

    // Mutable state to track animation without re-renders
    const stateRef = useRef({
        posX: 0,
        facingRight: true,
        frameIndex: 0,
        lastFrameTime: 0,
        containerWidth: 0,
        animationId: 0
    });

    useEffect(() => {
        if (!containerRef.current || !catRef.current) return;

        // 1. Efficiently track container width
        const observer = new ResizeObserver(entries => {
            for (const entry of entries) {
                stateRef.current.containerWidth = entry.contentRect.width;
            }
        });
        observer.observe(containerRef.current);

        // Initial width
        stateRef.current.containerWidth = containerRef.current.clientWidth;

        // 2. Animation Loop
        const animate = (time: number) => {
            const state = stateRef.current;
            const cat = catRef.current;

            if (!cat) return;

            // Update Frame Animation (throttled)
            if (time - state.lastFrameTime > FRAME_INTERVAL) {
                state.frameIndex = (state.frameIndex + 1) % FRAMES.length;
                cat.src = FRAMES[state.frameIndex] || '';
                state.lastFrameTime = time;
            }

            // Update Position (every allowable frame)
            const maxX = Math.max(0, state.containerWidth - CAT_SIZE);
            let nextX = state.facingRight ? state.posX + SPEED : state.posX - SPEED;

            // Boundary checks
            if (nextX >= maxX) {
                nextX = maxX;
                if (state.facingRight) {
                    state.facingRight = false;
                    cat.style.transform = 'scaleX(-1)';
                }
            } else if (nextX <= 0) {
                nextX = 0;
                if (!state.facingRight) {
                    state.facingRight = true;
                    cat.style.transform = 'scaleX(1)';
                }
            }

            state.posX = nextX;
            cat.style.left = `${nextX}px`;

            state.animationId = requestAnimationFrame(animate);
        };

        stateRef.current.animationId = requestAnimationFrame(animate);

        return () => {
            observer.disconnect();
            cancelAnimationFrame(stateRef.current.animationId);
        };
    }, []);

    return (
        <div
            ref={containerRef}
            style={{
                position: 'relative',
                width: '100%',
                height: 0, // Doesn't take up vertical space
                overflow: 'visible',
            }}
        >
            <img
                ref={catRef}
                src={FRAMES[0]}
                alt="Walking Cat"
                title="Meow!"
                style={{
                    position: 'absolute',
                    left: 0,
                    bottom: 0,
                    height: CAT_SIZE,
                    imageRendering: 'pixelated',
                    transform: 'scaleX(1)',
                    pointerEvents: 'auto',
                    cursor: 'pointer',
                    willChange: 'left, transform' // Hint to browser
                }}
                onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.parentElement) {
                        e.currentTarget.parentElement.innerText = '\u{1F431}';
                    }
                }}
            />
        </div>
    );
};
