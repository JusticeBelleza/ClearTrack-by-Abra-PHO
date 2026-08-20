// src/components/ui/SignaturePad.tsx
import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';

export interface SignaturePadRef {
    clear: () => void;
    getBlob: () => Promise<Blob | null>;
    isEmpty: () => boolean;
}

interface SignaturePadProps {
    onBegin?: () => void;
    containerClassName?: string;
}

const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(({ onBegin, containerClassName }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawingRef = useRef(false);
    const hasDrawnRef = useRef(false);

    // Expose methods to the parent component
    useImperativeHandle(ref, () => ({
        clear: () => {
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx?.clearRect(0, 0, canvas.width, canvas.height);
                hasDrawnRef.current = false;
            }
        },
        getBlob: (): Promise<Blob | null> => {
            return new Promise((resolve) => {
                if (!hasDrawnRef.current || !canvasRef.current) {
                    resolve(null);
                    return;
                }
                canvasRef.current.toBlob(resolve, 'image/png');
            });
        },
        isEmpty: () => !hasDrawnRef.current
    }));

    // Setup Canvas and Event Listeners
    useEffect(() => {
        // Small timeout ensures the canvas is fully rendered in the DOM before calculating bounds
        const timer = setTimeout(() => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            const getCoordinates = (e: MouseEvent | TouchEvent) => {
                const rect = canvas.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;

                let clientX, clientY;
                if (e.type.includes('touch')) {
                    clientX = (e as TouchEvent).touches[0].clientX;
                    clientY = (e as TouchEvent).touches[0].clientY;
                } else {
                    clientX = (e as MouseEvent).clientX;
                    clientY = (e as MouseEvent).clientY;
                }

                return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
            };

            const startDrawing = (e: MouseEvent | TouchEvent) => {
                e.preventDefault();
                isDrawingRef.current = true;
                hasDrawnRef.current = true;
                if (onBegin) onBegin(); // Notify parent that drawing has started
                const { x, y } = getCoordinates(e);
                ctx.beginPath();
                ctx.moveTo(x, y);
            };

            const draw = (e: MouseEvent | TouchEvent) => {
                if (!isDrawingRef.current) return;
                e.preventDefault();
                const { x, y } = getCoordinates(e);
                ctx.lineTo(x, y);
                ctx.stroke();
            };

            const stopDrawing = () => {
                isDrawingRef.current = false;
                ctx.closePath();
            };

            // Mouse Events
            canvas.addEventListener('mousedown', startDrawing);
            canvas.addEventListener('mousemove', draw);
            canvas.addEventListener('mouseup', stopDrawing);
            canvas.addEventListener('mouseout', stopDrawing);
            
            // Touch Events
            canvas.addEventListener('touchstart', startDrawing, { passive: false });
            canvas.addEventListener('touchmove', draw, { passive: false });
            canvas.addEventListener('touchend', stopDrawing);

            return () => {
                canvas.removeEventListener('mousedown', startDrawing);
                canvas.removeEventListener('mousemove', draw);
                canvas.removeEventListener('mouseup', stopDrawing);
                canvas.removeEventListener('mouseout', stopDrawing);
                canvas.removeEventListener('touchstart', startDrawing);
                canvas.removeEventListener('touchmove', draw);
                canvas.removeEventListener('touchend', stopDrawing);
            };
        }, 50);

        return () => clearTimeout(timer);
    }, [onBegin]);

    // Default structural classes mixed with customizable styling classes
    const defaultClasses = "border border-slate-200 rounded-2xl bg-slate-50 overflow-hidden touch-none relative shadow-inner";
    
    return (
        <div className={containerClassName || defaultClasses}>
            <div className="absolute top-1/2 left-4 right-4 h-0 border-b-2 border-dashed border-slate-300 pointer-events-none"></div>
            <canvas 
                ref={canvasRef} 
                width={600} 
                height={200} 
                className="w-full h-[180px] sm:h-[200px] cursor-crosshair bg-transparent relative z-10" 
                style={{ touchAction: 'none' }} 
            />
        </div>
    );
});

SignaturePad.displayName = 'SignaturePad';
export default SignaturePad;