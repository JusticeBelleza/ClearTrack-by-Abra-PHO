import React, { useState } from 'react';
import { FileText, X } from 'lucide-react';

export default function FilePreviewModal({ url, onClose }: { url: string, onClose: () => void }) {
    const [isClosing, setIsClosing] = useState(false);
    const [showContent, setShowContent] = useState(true);
    const isImage = url.toLowerCase().match(/\.(jpeg|jpg|gif|png|webp)$/i) !== null;

    const handleClose = (e?: any) => {
        if (e && e.preventDefault) e.preventDefault(); 
        if (isClosing) return; 
        
        setShowContent(false); 
        setIsClosing(true);
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        
        setTimeout(() => { onClose(); }, 300); 
    };

    return (
        <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/80 backdrop-blur-sm ${isClosing ? 'animate-overlay-fade-out pointer-events-none' : 'animate-overlay-fade'}`}>
            <div className={`bg-white w-full max-w-4xl h-[85vh] sm:h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden ${isClosing ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
                <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0">
                    <h3 className="font-bold flex items-center gap-2"><FileText size={20} /> Document Preview</h3>
                    <button 
                        onClick={handleClose} 
                        onTouchEnd={handleClose}
                        className="p-1.5 bg-white/10 md:hover:bg-white/20 active:bg-white/30 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="flex-1 bg-slate-100 w-full h-full overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                    {showContent && (
                        isImage ? (
                            <div className="w-full h-full p-4 flex items-center justify-center">
                                <img src={url} alt="Document Preview" className="max-w-full h-auto object-contain rounded-lg shadow-sm" />
                            </div>
                        ) : (
                            <iframe src={url} className="w-full h-full min-h-[120vh] sm:min-h-full border-none bg-slate-100" title="Document Preview" />
                        )
                    )}
                </div>
            </div>
        </div>
    );
}