import { useState, type SyntheticEvent } from 'react';
import { createPortal } from 'react-dom';
import { FileText, X, Download } from 'lucide-react';

export default function FilePreviewModal({ url, onClose }: { url: string, onClose: () => void }) {
    const [isClosing, setIsClosing] = useState(false);
    const [showContent, setShowContent] = useState(true);
    
    // Check if the URL points to an image or a PDF
    const isImage = url.toLowerCase().match(/\.(jpeg|jpg|gif|png|webp)$/i) !== null;

    const overlayAnimation = isClosing 
        ? "animate-out fade-out duration-200 ease-in fill-mode-forwards" 
        : "animate-in fade-in duration-200 ease-out fill-mode-forwards";
        
    const modalAnimation = isClosing 
        ? "animate-out slide-out-to-bottom-[100%] sm:slide-out-to-bottom-0 sm:zoom-out-95 duration-200 ease-in fill-mode-forwards" 
        : "animate-in slide-in-from-bottom-[100%] sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 ease-out fill-mode-forwards";

    const handleClose = (e?: SyntheticEvent) => {
        if (e && e.cancelable && e.preventDefault) {
            e.preventDefault(); 
        }
        if (isClosing) return; 
        
        setShowContent(false); 
        setIsClosing(true);
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        
        setTimeout(() => { onClose(); }, 200); 
    };

    // Append parameters to force PDFs to fit width on supported browsers
    const pdfUrl = isImage ? url : `${url}#toolbar=0&view=FitH`;

    return createPortal(
        <div className={`fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:p-6 bg-slate-900/80 backdrop-blur-sm ${overlayAnimation}`}>
            <div className={`bg-white w-full max-w-5xl h-[92vh] sm:h-[90vh] rounded-t-[1.5rem] sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden ${modalAnimation}`}>
                
                {/* Header */}
                <div className="bg-slate-900 text-white p-5 flex justify-between items-center shrink-0 z-10 rounded-t-[1.5rem] sm:rounded-t-2xl">
                    <h3 className="font-black text-lg flex items-center gap-2">
                        <FileText size={20} className="text-blue-400" /> Document Preview
                    </h3>
                    <div className="flex items-center gap-2">
                        <a 
                            href={url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-2 bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-full transition-colors"
                            title="Open in native viewer / Download"
                        >
                            <Download size={18} />
                        </a>
                        <button 
                            onClick={handleClose} 
                            onTouchEnd={handleClose}
                            className="p-2 bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-full transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>
                
                {/* Content Container - SCROLLABLE FOR MOBILE */}
                <div 
                    className="flex-1 w-full h-full bg-slate-100 overflow-y-auto overflow-x-hidden relative" 
                    style={{ WebkitOverflowScrolling: 'touch' }}
                >
                    {showContent && (
                        isImage ? (
                            <div className="w-full min-h-full flex items-start justify-center p-0 sm:p-6">
                                <img 
                                    src={url} 
                                    alt="Document Preview" 
                                    // w-full and h-auto forces it to fit screen width, making it scrollable vertically
                                    className="w-full h-auto max-w-4xl object-contain sm:rounded-xl shadow-sm bg-white" 
                                />
                            </div>
                        ) : (
                            <div className="w-full h-full min-h-[100vh] sm:min-h-0 flex flex-col overflow-auto touch-pan-y">
                                <iframe 
                                    src={pdfUrl} 
                                    className="w-full h-[120vh] sm:h-full border-none bg-slate-100 block" 
                                    title="Document Preview" 
                                />
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}