// src/components/processing/ReRouteModal.tsx
import React, { useState } from 'react';
import { Send, X, CheckCircle, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { convertImageToScannedPDF } from '../../lib/utils';
import type { DocumentItem, OptionType } from '../../types/processing';
import CustomSelect from '../ui/CustomSelect';

interface ReRouteModalProps {
    doc: DocumentItem; currentUserName: string; currentUserId: string; departments: OptionType[]; colleagues: string[]; onClose: () => void; onSuccess: () => void;
}

export default function ReRouteModal({ doc, currentUserName, currentUserId, departments, colleagues, onClose, onSuccess }: ReRouteModalProps) {
    const [destination, setDestination] = useState('');
    const [selectedColleague, setSelectedColleague] = useState('');
    const [remarks, setRemarks] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    
    const [isProcessingFile, setIsProcessingFile] = useState(false);
    const [attachment, setAttachment] = useState<File | Blob | null>(null);
    const [attachmentName, setAttachmentName] = useState<string>('');

    const handleClose = () => { setIsClosing(true); setTimeout(onClose, 250); };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; 
        if (!file) return;

        // Ensure file does not exceed 25MB (25 * 1024 * 1024 bytes)
        if (file.size > 25 * 1024 * 1024) {
            toast.error("File too large", { description: "Please select a document or image smaller than 25MB." });
            return;
        }

        setIsProcessingFile(true); 
        setAttachmentName("Processing file...");
        
        try {
            if (file.type === 'application/pdf') { 
                setAttachment(file); 
                setAttachmentName(file.name); 
            } 
            else if (file.type.startsWith('image/')) {
                const pdfBlob = await convertImageToScannedPDF(file);
                setAttachment(pdfBlob); 
                setAttachmentName('Edited_Document.pdf');
            } else { 
                toast.error("Unsupported file type."); 
                setAttachmentName(""); 
            }
        } catch { 
            toast.error("Failed to process the document."); 
            setAttachmentName(""); 
        } finally { 
            setIsProcessingFile(false); 
        }
    };

    const handleConfirm = async () => {
        if (!destination || !selectedColleague || !remarks.trim()) { toast.error("Validation Error", { description: "Please provide the destination, the assigned clerk, and your remarks." }); return; }
        setIsSubmitting(true);
        try {
            const nowIso = new Date().toISOString();
            let newAttachmentUrl = doc.attachment_url;

            if (attachment) {
                const fileName = `edited-${doc.reference_no}-${crypto.randomUUID()}.pdf`;
                const { error: uploadError } = await supabase.storage.from('attachments').upload(fileName, attachment, { contentType: 'application/pdf' });
                if (uploadError) throw uploadError;
                const { data } = supabase.storage.from('attachments').getPublicUrl(fileName);
                newAttachmentUrl = data.publicUrl;
            }

            await supabase.from('documents').update({ status: 'routing', current_location: destination, assigned_clerk: selectedColleague, attachment_url: newAttachmentUrl, remarks: null, updated_at: nowIso }).eq('id', doc.id);
            await supabase.from('document_logs').insert([{ document_id: doc.id, action: 'Re-routed', remarks: `${remarks.trim()}\n(Re-routed by ${currentUserName})`, location: destination, assigned_to: selectedColleague, attachment_url: newAttachmentUrl, created_by: currentUserId }]);

            toast.success(`Document re-routed to ${selectedColleague}`);
            onSuccess(); handleClose();
        } catch { toast.error("Failed to re-route document."); } finally { setIsSubmitting(false); }
    };

    const colleagueOptions: OptionType[] = colleagues.map(c => ({ label: c, value: c }));

    return (
        <div className={`fixed inset-0 z-[999] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50 backdrop-blur-sm ${isClosing ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
            <div className={`bg-white w-full max-w-lg flex flex-col shadow-2xl rounded-t-[1.5rem] sm:rounded-3xl max-h-[90vh] ${isClosing ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
                <div className="bg-blue-600 p-5 sm:p-6 flex justify-between items-center text-white relative shrink-0 rounded-t-[1.5rem] sm:rounded-t-3xl z-20">
                    <div className="w-12 h-1.5 bg-white/30 rounded-full mx-auto absolute top-2 left-1/2 -translate-x-1/2 sm:hidden"></div>
                    <h3 className="font-black text-xl flex items-center gap-2 mt-2 sm:mt-0"><Send size={22} className="text-blue-200" /> Re-route Document</h3>
                    <button onClick={handleClose} className="p-1.5 hover:bg-white/20 rounded-full transition-colors active:scale-95 mt-2 sm:mt-0"><X size={20} /></button>
                </div>
                <div className="p-5 sm:p-6 space-y-6 bg-white flex-1 relative z-10 overflow-y-auto custom-scrollbar">
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl shadow-sm"><p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Document ID</p><p className="font-mono text-base sm:text-lg font-black text-slate-900">{doc.reference_no || doc.id}</p></div>
                    <div><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Edited Document (Optional)</label><label className={`w-full flex items-center justify-center gap-2 p-3.5 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${attachment ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-slate-50 border-slate-300 text-slate-600 hover:bg-slate-100'}`}><input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} disabled={isProcessingFile} />{isProcessingFile ? <span className="animate-pulse font-bold text-sm">Processing...</span> : attachment ? <><CheckCircle size={18}/> <span className="font-bold text-sm truncate max-w-[200px]">{attachmentName}</span></> : <><Paperclip size={18}/> <span className="font-bold text-sm">Upload Corrected File</span></>}</label>{attachment && !isProcessingFile && (<div className="mt-2 text-right"><button type="button" onClick={() => { setAttachment(null); setAttachmentName(''); }} className="text-xs text-red-500 font-bold hover:underline">Remove Attachment</button></div>)}</div>
                    <div className="relative z-30"><label className="block text-[11px] font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Destination Office *</label><CustomSelect options={departments} value={destination} onChange={setDestination} placeholder="Select new destination..." isRelative={true} /></div>
                    <div className="relative z-20"><label className="block text-[11px] font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Re-Assign to Clerk *</label><CustomSelect options={colleagueOptions} value={selectedColleague} onChange={(val: string) => setSelectedColleague(val)} placeholder="Choose a colleague..." emptyText="No employee found" isRelative={true} /></div>
                    <div className="relative z-10"><label className="block text-[11px] font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Remarks / Fixes Made *</label><textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="E.g., Missing signatures have been completed. Please process." className="w-full p-3.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl outline-none font-bold text-slate-900 text-sm min-h-[100px] resize-y transition-all" /></div>
                </div>
                <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex gap-3 shrink-0 relative z-0 sm:rounded-b-3xl">
                    <button onClick={handleClose} className="flex-1 py-3.5 bg-white border-2 border-slate-300 hover:bg-slate-50 rounded-xl font-bold text-slate-700 transition-all active:scale-95 text-sm sm:text-base">Cancel</button>
                    <button onClick={handleConfirm} disabled={!selectedColleague || !destination || !remarks.trim() || isSubmitting || isProcessingFile} className="flex-[1.5] py-3.5 bg-blue-600 border-2 border-blue-700 text-white rounded-xl font-bold shadow-sm hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex justify-center items-center gap-2 text-sm sm:text-base">{isSubmitting ? 'Processing...' : 'Confirm Re-route'}</button>
                </div>
            </div>
        </div>
    );
}