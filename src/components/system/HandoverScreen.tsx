import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, PenTool, X, CheckCircle, ChevronDown, Camera, Paperclip, AlertCircle, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { jsPDF } from 'jspdf';

// --- TypeScript Interfaces ---
interface SelectOption {
    label: string;
    value: string;
}

type OptionType = SelectOption | string;

interface CustomSelectProps {
    options: OptionType[];
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
}

interface DocumentItem {
    id: string;
    reference_no?: string;
    title?: string;
    subject?: string;
    is_urgent?: boolean;
    current_location?: string;
    final_destination?: string;
}

interface HandoverScreenProps {
    doc: DocumentItem;
    departments: OptionType[];
    onBack: () => void;
    onSuccess: () => void;
}

// --- Custom Dropdown Component ---
function CustomSelect({ options, value, onChange, placeholder }: CustomSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
  
    useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false);
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
  
    return (
      <div className="relative w-full" ref={dropdownRef}>
        <button type="button" onClick={() => setIsOpen(!isOpen)} className={`w-full px-4 py-3.5 bg-white border-2 rounded-xl flex justify-between items-center transition-all text-base outline-none active:scale-[0.99] ${isOpen ? 'border-blue-600 ring-4 ring-blue-600/10' : 'border-slate-300 hover:bg-slate-50 hover:border-slate-400'} ${!value ? 'text-slate-500' : 'text-slate-900 font-bold'}`}>
          <span className="truncate">
            {options.find((opt: OptionType) => (typeof opt === 'string' ? opt : opt.value) === value)
              ? (typeof options.find((opt: OptionType) => (typeof opt === 'string' ? opt : opt.value) === value) === 'string' 
                  ? options.find((opt: OptionType) => (typeof opt === 'string' ? opt : opt.value) === value) as string
                  : (options.find((opt: OptionType) => (typeof opt === 'string' ? opt : opt.value) === value) as SelectOption).label)
              : value || placeholder}
          </span>
          <ChevronDown size={20} className={`text-slate-600 transition-transform duration-300 ease-in-out ${isOpen ? 'rotate-180 text-slate-900' : ''}`} />
        </button>
        {isOpen && (
          <div className="absolute z-20 w-full mt-2 bg-white border-2 border-slate-300 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="max-h-60 overflow-y-auto p-1.5 space-y-1 scrollbar-hide">
              {options.map((option: OptionType, idx: number) => {
                const optValue = typeof option === 'string' ? option : option.value;
                const optLabel = typeof option === 'string' ? option : option.label;
                return (
                  <div key={idx} onClick={() => { onChange(optValue); setIsOpen(false); }} className={`px-4 py-3 text-base rounded-lg cursor-pointer transition-colors flex items-center active:scale-95 ${optValue === value ? 'bg-blue-600 text-white font-bold' : 'text-slate-800 hover:bg-slate-100 font-medium'}`}>
                    {optLabel}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
}

export default function HandoverScreen({ doc, departments, onBack, onSuccess }: HandoverScreenProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isClosing, setIsClosing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeAction, setActiveAction] = useState<'route' | 'reject' | 'complete' | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    
    const [destination, setDestination] = useState('');
    const [receivingClerk, setReceivingClerk] = useState('');
    const [rejectOffice, setRejectOffice] = useState('');
    const [rejectReason, setRejectReason] = useState('');
    
    const [isProcessingFile, setIsProcessingFile] = useState(false);
    const [attachment, setAttachment] = useState<File | Blob | null>(null);
    const [attachmentName, setAttachmentName] = useState<string>('');
    const [releasedBy, setReleasedBy] = useState('');
    const [completionRemarks, setCompletionRemarks] = useState('');
    const [retentionFate, setRetentionFate] = useState<'originator' | 'destination' | null>(null);

    // Pure Tailwind-Animate classes for the background overlay
    const overlayAnimation = isClosing 
        ? "animate-out fade-out duration-200 ease-in fill-mode-forwards" 
        : "animate-in fade-in duration-200 ease-out fill-mode-forwards";
        
    // Pure Tailwind-Animate classes for the modal (Slide on mobile, Zoom on desktop)
    const modalAnimation = isClosing 
        ? "animate-out slide-out-to-bottom-[100%] sm:slide-out-to-bottom-0 sm:zoom-out-95 duration-200 ease-in fill-mode-forwards" 
        : "animate-in slide-in-from-bottom-[100%] sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 ease-out fill-mode-forwards";

    const handleClose = (e?: React.MouseEvent | React.TouchEvent) => {
        if (e && e.preventDefault) e.preventDefault(); 
        if (isClosing) return; 
        setIsClosing(true);
        setTimeout(() => { onBack(); }, 200); // Matches the 200ms Tailwind duration
    };
    
    const handleBackBtn = (e?: React.MouseEvent | React.TouchEvent) => {
        if (e && e.preventDefault) e.preventDefault();
        if (isSubmitting) return;
        setActiveAction(null);
    };

    useEffect(() => {
        if (activeAction !== 'route') return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        
        const getCoordinates = (e: MouseEvent | TouchEvent) => {
            const rect = canvas.getBoundingClientRect();
            if (e.type.includes('touch')) return { x: (e as TouchEvent).touches[0].clientX - rect.left, y: (e as TouchEvent).touches[0].clientY - rect.top };
            return { x: (e as MouseEvent).clientX - rect.left, y: (e as MouseEvent).clientY - rect.top };
        };

        const startDrawing = (e: MouseEvent | TouchEvent) => { e.preventDefault(); setIsDrawing(true); const { x, y } = getCoordinates(e); ctx.beginPath(); ctx.moveTo(x, y); };
        const draw = (e: MouseEvent | TouchEvent) => { if (!isDrawing) return; e.preventDefault(); const { x, y } = getCoordinates(e); ctx.lineTo(x, y); ctx.stroke(); };
        const stopDrawing = () => { setIsDrawing(false); ctx.closePath(); };

        canvas.addEventListener('mousedown', startDrawing); canvas.addEventListener('mousemove', draw); canvas.addEventListener('mouseup', stopDrawing); canvas.addEventListener('mouseout', stopDrawing);
        canvas.addEventListener('touchstart', startDrawing, { passive: false }); canvas.addEventListener('touchmove', draw, { passive: false }); canvas.addEventListener('touchend', stopDrawing);

        return () => {
            canvas.removeEventListener('mousedown', startDrawing); canvas.removeEventListener('mousemove', draw); canvas.removeEventListener('mouseup', stopDrawing); canvas.removeEventListener('mouseout', stopDrawing);
            canvas.removeEventListener('touchstart', startDrawing); canvas.removeEventListener('touchmove', draw); canvas.removeEventListener('touchend', stopDrawing);
        };
    }, [activeAction, isDrawing]); 

    const clearSignature = () => { const canvas = canvasRef.current; if(canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height); };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsProcessingFile(true); setAttachmentName("Processing file...");
        try {
            if (file.type === 'application/pdf') { setAttachment(file); setAttachmentName(file.name); } 
            else if (file.type.startsWith('image/')) {
                const pdfBlob = await processImageToScannedPDF(file);
                setAttachment(pdfBlob); setAttachmentName(`Final_Signed_${doc.reference_no}.pdf`);
            } else { toast.error("Unsupported file type."); setAttachmentName(""); }
        } catch { toast.error("Failed to process the document."); setAttachmentName(""); } 
        finally { setIsProcessingFile(false); }
    };

    const processImageToScannedPDF = (file: File): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
                    if (!ctx) return reject("Canvas error");
                    canvas.width = img.width; canvas.height = img.height;
                    ctx.filter = 'grayscale(100%) contrast(150%) brightness(110%)';
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    const processedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                    const pdf = new jsPDF({ orientation: img.width > img.height ? 'landscape' : 'portrait', unit: 'px', format: [img.width, img.height] });
                    pdf.addImage(processedDataUrl, 'JPEG', 0, 0, img.width, img.height);
                    resolve(pdf.output('blob'));
                };
                img.onerror = reject; img.src = event.target?.result as string;
            };
            reader.onerror = reject; reader.readAsDataURL(file);
        });
    };

    const handleSaveRouting = async () => {
        if (!destination || !receivingClerk.trim()) { toast.error("Validation Error", { description: "Please provide a destination and receiving clerk." }); return; }
        setIsSubmitting(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const { error: logError } = await supabase.from('document_logs').insert([{ document_id: doc.id, action: 'In transit', location: destination, assigned_to: receivingClerk.trim(), created_by: session?.user?.id || null }]);
            if (logError) throw logError;
            const { error } = await supabase.from('documents').update({ current_location: destination, status: 'routing', remarks: null }).eq('id', doc.id);
            if (error) throw error;
            toast.success("Document Routed Successfully!", { description: `Forwarded to ${destination}.`});
            onSuccess(); handleClose();
        } catch (err: unknown) { 
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
            toast.error("Failed to route document", { description: errorMessage }); 
        } 
        finally { setIsSubmitting(false); }
    };

    const confirmComplete = async () => {
        if (!releasedBy.trim()) { toast.error("Validation Error", { description: "Please specify who released the document." }); return; }
        if (!retentionFate) { toast.error("Validation Error", { description: "Please select where the document will be retained." }); return; }
        setIsSubmitting(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            let attachmentUrl = null;
            if (attachment) {
                const fileName = `completed-${doc.reference_no}-${Math.random()}.pdf`;
                const { error: uploadError } = await supabase.storage.from('attachments').upload(fileName, attachment, { contentType: 'application/pdf' });
                if (uploadError) throw uploadError;
                const { data } = supabase.storage.from('attachments').getPublicUrl(fileName);
                attachmentUrl = data.publicUrl;
            }
            const updateData: { status: string; remarks: string | null; completed_attachment_url?: string } = { status: 'sealed', remarks: completionRemarks.trim() || null };
            if (attachmentUrl) { updateData.completed_attachment_url = attachmentUrl; }
            const fateString = retentionFate === 'originator' ? 'Returned to Originator' : 'Retained at Final Destination';
            const detailedRemarks = `Released By: ${releasedBy.trim()}\nDocument Retention: ${fateString}${completionRemarks ? `\nRemarks: ${completionRemarks.trim()}` : ''}`;

            const { error: logError } = await supabase.from('document_logs').insert([{ document_id: doc.id, action: 'Delivered', location: doc.final_destination || doc.current_location, remarks: detailedRemarks, attachment_url: attachmentUrl, created_by: session?.user?.id || null }]);
            if (logError) throw logError;
            const { error } = await supabase.from('documents').update(updateData).eq('id', doc.id);
            if (error) throw error;
            toast.success("Document Completed!", { description: "It has been moved to history." });
            onSuccess(); handleClose();
        } catch { toast.error("Failed to complete document"); } 
        finally { setIsSubmitting(false); }
    };

    const handleReject = async () => {
        if (!rejectOffice || !rejectReason.trim()) { toast.error("Validation Error", { description: "Please provide the returning office and reason." }); return; }
        setIsSubmitting(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const { error: logError } = await supabase.from('document_logs').insert([{ document_id: doc.id, action: 'Returned', location: rejectOffice, remarks: rejectReason.trim(), created_by: session?.user?.id || null }]);
            if (logError) throw logError;
            const { error } = await supabase.from('documents').update({ status: 'pending', current_location: rejectOffice, remarks: rejectReason.trim() }).eq('id', doc.id);
            if (error) throw error;
            toast.success("Document Returned");
            onSuccess(); handleClose();
        } catch { toast.error("Failed to reject document"); } 
        finally { setIsSubmitting(false); }
    };

    return createPortal(
        <div className={`fixed inset-0 z-[999] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/70 backdrop-blur-sm ${overlayAnimation}`}>
            <div className={`bg-white w-full max-w-2xl max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden shadow-[0_-10px_40px_rgba(0,0,0,0.3)] rounded-t-[2rem] sm:rounded-3xl ${modalAnimation}`}>
                <div className={`text-white relative flex flex-col shrink-0 transition-colors duration-300 ${activeAction === 'reject' ? 'bg-red-700' : activeAction === 'complete' ? 'bg-emerald-700' : 'bg-slate-900'}`}>
                    <div className="w-16 h-1.5 bg-white/30 rounded-full mx-auto mt-3 sm:hidden shrink-0"></div>
                    <div className="p-5 pt-3 sm:pt-6 flex items-center justify-between">
                        {activeAction ? <button onClick={handleBackBtn} onTouchEnd={handleBackBtn} disabled={isSubmitting} className="p-2 -ml-2 bg-white/10 md:hover:bg-white/20 active:bg-white/30 rounded-full transition-colors disabled:opacity-50"><ArrowLeft size={24} /></button> : <div className="w-10"></div>}
                        <h3 className="font-black text-xl">{!activeAction ? 'Action Required' : activeAction === 'reject' ? 'Reject & Return' : activeAction === 'complete' ? 'Finalize Document' : 'Route Document'}</h3>
                        <button onClick={handleClose} onTouchEnd={handleClose} disabled={isSubmitting} className="p-2 -mr-2 bg-white/10 md:hover:bg-white/20 active:bg-white/30 rounded-full transition-colors disabled:opacity-50"><X size={24} /></button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6 scrollbar-hide bg-slate-50">
                    <div className="bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-sm relative z-20">
                        <p className="text-sm font-bold text-slate-500 mb-2 font-mono">{doc.reference_no}</p>
                        <p className="font-black text-xl text-slate-900 leading-tight flex items-start gap-2">{doc.is_urgent && <AlertCircle size={24} className="text-red-600 shrink-0 mt-0.5" />} {doc.title || doc.subject}</p>
                    </div>

                    {!activeAction ? (
                        <div className="flex flex-col gap-4 pt-2">
                            <button onClick={() => setActiveAction('route')} className="animate-stagger-1 bg-white border-2 border-blue-200 hover:border-blue-400 p-5 rounded-2xl flex items-center gap-4 text-left transition-all hover:shadow-md active:scale-[0.98] group"><div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform"><MapPin size={28} /></div><div><h4 className="font-black text-xl text-slate-900 mb-0.5">Add Step</h4><p className="text-sm font-medium text-slate-500">Route this document to its next destination.</p></div></button>
                            <button onClick={() => setActiveAction('complete')} className="animate-stagger-2 bg-white border-2 border-emerald-200 hover:border-emerald-400 p-5 rounded-2xl flex items-center gap-4 text-left transition-all hover:shadow-md active:scale-[0.98] group"><div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform"><CheckCircle size={28} /></div><div><h4 className="font-black text-xl text-slate-900 mb-0.5">Complete Document</h4><p className="text-sm font-medium text-slate-500">Finalize, log remarks, and secure the record.</p></div></button>
                            <button onClick={() => setActiveAction('reject')} className="animate-stagger-3 bg-white border-2 border-red-200 hover:border-red-400 p-5 rounded-2xl flex items-center gap-4 text-left transition-all hover:shadow-md active:scale-[0.98] group"><div className="w-14 h-14 bg-red-50 text-red-600 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform"><AlertCircle size={28} /></div><div><h4 className="font-black text-xl text-slate-900 mb-0.5">Return / Reject</h4><p className="text-sm font-medium text-slate-500">Bounce this document back to a previous office.</p></div></button>
                        </div>
                    ) : null}

                    {activeAction === 'route' && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                            <div><label className="block text-base font-bold text-slate-900 mb-2">Next Destination Office *</label><CustomSelect options={departments} value={destination} onChange={setDestination} placeholder="Select receiving office..." /></div>
                            <div><label className="block text-base font-bold text-slate-900 mb-2">Receiving Clerk *</label><input type="text" value={receivingClerk} onChange={(e) => setReceivingClerk(e.target.value)} placeholder="Enter name of receiving clerk..." className="w-full p-3.5 bg-white border-2 border-slate-300 focus:border-blue-600 rounded-xl outline-none font-bold text-slate-900 text-base transition-colors" /></div>
                            <div><div className="flex justify-between items-end mb-2"><label className="block text-base font-bold text-slate-900 flex items-center gap-2"><PenTool size={20}/> Signature *</label><button onClick={clearSignature} type="button" className="text-sm text-slate-600 font-bold hover:text-slate-900 transition-colors bg-white px-3 py-1.5 rounded-lg border-2 border-slate-300 active:scale-95">Clear Pad</button></div><div className="border-4 border-slate-300 rounded-2xl bg-white overflow-hidden touch-none relative"><div className="absolute top-1/2 left-4 right-4 h-0 border-b-2 border-dashed border-slate-300 pointer-events-none"></div><canvas ref={canvasRef} width={600} height={200} className="w-full h-[200px] cursor-crosshair bg-transparent relative z-10" style={{ touchAction: 'none' }} /></div><p className="text-center text-sm text-slate-500 mt-3 font-bold">Sign clearly within the box above</p></div>
                        </div>
                    )}

                    {activeAction === 'complete' && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                            <div><label className="block text-sm font-bold text-slate-900 mb-1.5">Scanned Signed Copy (Optional)</label><div className="flex items-center gap-3"><label className={`hidden sm:flex flex-1 items-center justify-center gap-2 p-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${attachment ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}><input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} disabled={isProcessingFile} />{isProcessingFile ? <span className="animate-pulse font-bold">Processing PDF...</span> : attachment ? <><CheckCircle size={18}/> <span className="font-bold truncate max-w-[200px]">{attachmentName}</span></> : <><Paperclip size={18}/> <span className="font-bold">Attach Final PDF</span></>}</label><label className={`flex sm:hidden flex-1 items-center justify-center gap-2 p-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors active:scale-95 ${attachment ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}><input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} disabled={isProcessingFile} />{isProcessingFile ? <span className="animate-pulse font-bold">Processing PDF...</span> : attachment ? <><CheckCircle size={18}/> <span className="font-bold truncate max-w-[150px]">{attachmentName}</span></> : <><Camera size={18}/> <span className="font-bold">Scan Signed Document</span></>}</label>{attachment && !isProcessingFile && (<button type="button" onClick={() => { setAttachment(null); setAttachmentName(''); }} className="p-4 bg-red-50 text-red-600 rounded-xl border-2 border-red-200 hover:bg-red-100 active:scale-95 transition-all"><X size={18} /></button>)}</div></div>
                            <div><label className="block text-base font-bold text-slate-900 mb-2">Released By *</label><input type="text" value={releasedBy} onChange={(e) => setReleasedBy(e.target.value)} placeholder="Name of official releasing the document..." className="w-full p-3.5 bg-white border-2 border-slate-300 focus:border-emerald-600 rounded-xl outline-none font-bold text-slate-900 text-base transition-colors" /></div>
                            <div><label className="block text-base font-bold text-slate-900 mb-2">Document Retention *</label><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div onClick={() => setRetentionFate('originator')} className={`p-4 border-2 rounded-xl cursor-pointer transition-all active:scale-[0.98] ${retentionFate === 'originator' ? 'bg-emerald-50 border-emerald-500' : 'bg-white border-slate-300 hover:border-slate-400'}`}><div className="flex items-center gap-3"><div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${retentionFate === 'originator' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-400 bg-white'}`}>{retentionFate === 'originator' && <div className="w-2 h-2 bg-white rounded-full"></div>}</div><div><p className={`font-bold text-base ${retentionFate === 'originator' ? 'text-emerald-900' : 'text-slate-700'}`}>Return to Originator</p></div></div></div><div onClick={() => setRetentionFate('destination')} className={`p-4 border-2 rounded-xl cursor-pointer transition-all active:scale-[0.98] ${retentionFate === 'destination' ? 'bg-emerald-50 border-emerald-500' : 'bg-white border-slate-300 hover:border-slate-400'}`}><div className="flex items-center gap-3"><div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${retentionFate === 'destination' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-400 bg-white'}`}>{retentionFate === 'destination' && <div className="w-2 h-2 bg-white rounded-full"></div>}</div><div><p className={`font-bold text-base ${retentionFate === 'destination' ? 'text-emerald-900' : 'text-slate-700'}`}>Retain at Office</p></div></div></div></div></div>
                            <div><label className="block text-base font-bold text-slate-900 mb-2">Completion Remarks (Optional)</label><textarea value={completionRemarks} onChange={(e) => setCompletionRemarks(e.target.value)} placeholder="Add final notes or context for the archive..." className="w-full p-3.5 bg-white border-2 border-slate-300 focus:border-emerald-600 rounded-xl outline-none font-bold text-slate-900 text-base min-h-[100px] resize-y transition-colors" ></textarea></div>
                        </div>
                    )}

                    {activeAction === 'reject' && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                            <div><label className="block text-base font-bold text-slate-900 mb-2">Returning To Office *</label><CustomSelect options={departments} value={rejectOffice} onChange={setRejectOffice} placeholder="Select office..." /></div>
                            <div><label className="block text-base font-bold text-slate-900 mb-2">Reason for Rejection *</label><textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="E.g., Missing signature, incorrect attachments..." className="w-full p-3.5 bg-white border-2 border-slate-300 focus:border-red-600 rounded-xl outline-none font-bold text-slate-900 text-base min-h-[140px] resize-y transition-colors" ></textarea></div>
                        </div>
                    )}
                </div>

                {activeAction && (
                    <div className="bg-white p-4 sm:p-6 pb-8 sm:pb-6 border-t-2 border-slate-200 flex shrink-0">
                        {activeAction === 'route' && <button onClick={handleSaveRouting} disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-95 text-base flex justify-center items-center gap-2 border-2 border-blue-700 disabled:opacity-50">{isSubmitting ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <><MapPin size={24} strokeWidth={2.5} /> Confirm Add Step</>}</button>}
                        {activeAction === 'complete' && <button onClick={confirmComplete} disabled={isSubmitting || isProcessingFile} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-95 text-base flex items-center justify-center gap-2 border-2 border-emerald-700 disabled:opacity-50">{isSubmitting ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <><CheckCircle size={24} strokeWidth={3} /> Finalize Document</>}</button>}
                        {activeAction === 'reject' && <button onClick={handleReject} disabled={isSubmitting} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-95 text-base flex items-center justify-center gap-2 border-2 border-red-700 disabled:opacity-50">{isSubmitting ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <><AlertCircle size={24} strokeWidth={3} /> Confirm Return</>}</button>}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}