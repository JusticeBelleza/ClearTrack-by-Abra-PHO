import { useState, useRef, useEffect, type SyntheticEvent } from 'react';
import { createPortal } from 'react-dom';
import { FileText, X, Download, ExternalLink, Loader2 } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
// Configure the PDF.js worker (Standard Vite setup to avoid CDN blocks)
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
).toString();

export default function FilePreviewModal({ url, onClose }: { url: string; onClose: () => void }) {
    const [isClosing, setIsClosing] = useState(false);
    const [showContent, setShowContent] = useState(true);
    const [numPages, setNumPages] = useState<number>();
    const [containerWidth, setContainerWidth] = useState<number>();
    
    const containerRef = useRef<HTMLDivElement>(null);

    // Check if the URL points to an image
    const isImage = url.toLowerCase().match(/\.(jpeg|jpg|gif|png|webp)$/i) !== null;

    // Track the container width so the PDF scales perfectly on mobile vs desktop
    useEffect(() => {
        if (containerRef.current) {
            setContainerWidth(containerRef.current.clientWidth);
        }
        const handleResize = () => {
            if (containerRef.current) {
                setContainerWidth(containerRef.current.clientWidth);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [showContent]);

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

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
    }

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
                            className="p-2 bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-full transition-colors flex items-center justify-center text-white"
                            title="Open original file"
                        >
                            <ExternalLink size={18} />
                        </a>
                        <a
                            href={url}
                            download
                            className="p-2 bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-full transition-colors flex items-center justify-center text-white"
                            title="Download file"
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

                {/* Content Container - Scrollable */}
                <div
                    ref={containerRef}
                    className="flex-1 w-full h-full bg-slate-100 overflow-y-auto overflow-x-hidden relative flex flex-col items-center"
                    style={{ WebkitOverflowScrolling: 'touch' }}
                >
                    {showContent && (
                        isImage ? (
                            <div className="w-full min-h-full flex items-center justify-center p-4 sm:p-6">
                                <img
                                    src={url}
                                    alt="Document Preview"
                                    className="max-w-full max-h-[75vh] object-contain sm:rounded-xl shadow-sm bg-white"
                                />
                            </div>
                        ) : (
                            <div className="w-full py-4 sm:py-6 px-2 sm:px-6 flex flex-col items-center gap-4">
                                <Document
                                    file={url}
                                    onLoadSuccess={onDocumentLoadSuccess}
                                    loading={
                                        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                                            <Loader2 size={32} className="animate-spin mb-4" />
                                            <p>Loading document...</p>
                                        </div>
                                    }
                                    error={
                                        <div className="py-20 text-red-500 font-medium">
                                            Failed to load the PDF. Please download it instead.
                                        </div>
                                    }
                                >
                                    {Array.from(new Array(numPages), (_, index) => (
                                        <div key={`page_${index + 1}`} className="mb-4 sm:mb-6 rounded shadow-lg overflow-hidden bg-white">
                                            <Page
                                                pageNumber={index + 1}
                                                width={containerWidth ? Math.min(containerWidth - 32, 1000) : undefined}
                                                renderTextLayer={false}
                                                renderAnnotationLayer={false}
                                            />
                                        </div>
                                    ))}
                                </Document>
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}