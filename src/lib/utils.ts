// src/lib/utils.ts
import { jsPDF } from 'jspdf';

export const formatPHDateTime = (isoString: string | null | undefined) => {
    if (!isoString) return 'Unknown Time';
    
    try {
        return new Date(isoString).toLocaleString('en-US', {
            timeZone: 'Asia/Manila',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    } catch { // <-- Removed (_error) completely
        console.error("Invalid date string provided to formatPHDateTime:", isoString);
        return 'Invalid Date';
    }
};

export const convertImageToScannedPDF = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas'); 
                const ctx = canvas.getContext('2d'); 
                if (!ctx) return reject("Canvas error");
                
                canvas.width = img.width; 
                canvas.height = img.height; 
                ctx.filter = 'grayscale(100%) contrast(150%) brightness(110%)'; 
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                const processedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                const pdf = new jsPDF({ 
                    orientation: img.width > img.height ? 'landscape' : 'portrait', 
                    unit: 'px', 
                    format: [img.width, img.height] 
                });
                pdf.addImage(processedDataUrl, 'JPEG', 0, 0, img.width, img.height); 
                resolve(pdf.output('blob'));
            }; 
            img.onerror = reject; 
            img.src = event.target?.result as string;
        }; 
        reader.onerror = reject; 
        reader.readAsDataURL(file);
    });
};