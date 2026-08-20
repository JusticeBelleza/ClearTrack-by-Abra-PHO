// src/components/processing/CancelModal.tsx
import { useState } from 'react';
import { Ban, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import type { DocumentItem } from '../../types/processing';

interface CancelModalProps {
    doc: DocumentItem;
    currentUserName: string;
    currentUserId: string;
    onClose: () => void;
    onSuccess: () => void;
}

export default function CancelModal({ doc, currentUserName, currentUserId, onClose, onSuccess }: CancelModalProps) {
    const [reason, setReason] = useState('');
    const [isCancelling, setIsCancelling] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

    const handleClose = () => { setIsClosing(true); setTimeout(onClose, 250); };
    
    const handleConfirm = async () => {
        if (!reason.trim()) { toast.error("Validation Error", { description: "Please provide a reason for cancellation." }); return; }
        setIsCancelling(true);
        try {
            const nowIso = new Date().toISOString();
            const { data: creatorProfile } = await supabase.from('profiles').select('full_name').eq('id', doc.created_by).single();
            const creatorName = creatorProfile?.full_name || 'Originator';

            await supabase.from('document_logs').insert([{ 
                document_id: doc.id, 
                action: 'Cancelled', 
                remarks: `Cancelled by ${currentUserName || 'System User'}. Reason: ${reason.trim()}`, 
                location: doc.current_location || 'Returned', 
                assigned_to: creatorName,
                created_by: currentUserId 
            }]);

            await supabase.from('documents').update({ 
                status: 'cancelled', 
                assigned_clerk: creatorName,
                updated_at: nowIso 
            }).eq('id', doc.id);

            toast.success(`Document Cancelled successfully`);
            onSuccess(); handleClose();
        } catch { toast.error("Failed to cancel document."); } finally { setIsCancelling(false); }
    };

    return (
        <div className={`fixed inset-0 z-[999] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50 backdrop-blur-sm ${isClosing ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
            <div className={`bg-white w-full max-w-md flex flex-col shadow-2xl rounded-t-[1.5rem] sm:rounded-3xl ${isClosing ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
                <div className="bg-rose-700 p-5 sm:p-6 flex justify-between items-center text-white relative shrink-0 rounded-t-[1.5rem] sm:rounded-t-3xl z-20">
                    <div className="w-12 h-1.5 bg-white/30 rounded-full mx-auto absolute top-2 left-1/2 -translate-x-1/2 sm:hidden"></div>
                    <h3 className="font-black text-xl flex items-center gap-2 mt-2 sm:mt-0"><Ban size={22} className="text-rose-200" /> Cancel Document</h3>
                    <button onClick={handleClose} className="p-1.5 hover:bg-white/20 rounded-full transition-colors active:scale-95 mt-2 sm:mt-0"><X size={20} /></button>
                </div>
                <div className="p-5 sm:p-6 space-y-5 bg-slate-50 flex-1 relative z-10 overflow-y-auto custom-scrollbar">
                    <div className="bg-white border-2 border-slate-200 p-4 rounded-xl shadow-sm">
                        <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Document ID</p>
                        <p className="font-mono text-base sm:text-lg font-black text-slate-900">{doc.reference_no || doc.id}</p>
                    </div>
                    <div className="relative z-20">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Reason for Cancellation *</label>
                        <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this document being cancelled? Provide brief details..." className="w-full p-3.5 bg-white border border-slate-200 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 rounded-xl outline-none font-bold text-slate-900 text-sm min-h-[120px] resize-y transition-all" />
                    </div>
                </div>
                <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex gap-3 shrink-0 relative z-0 sm:rounded-b-3xl">
                    <button onClick={handleClose} className="flex-1 py-3.5 bg-white border-2 border-slate-300 hover:bg-slate-50 rounded-xl font-bold text-slate-700 transition-all active:scale-95 text-sm sm:text-base">Go Back</button>
                    <button onClick={handleConfirm} disabled={!reason.trim() || isCancelling} className="flex-[1.5] py-3.5 bg-rose-600 border-2 border-rose-700 text-white rounded-xl font-bold shadow-sm hover:bg-rose-700 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex justify-center items-center gap-2 text-sm sm:text-base">{isCancelling ? 'Cancelling...' : 'Confirm Cancel'}</button>
                </div>
            </div>
        </div>
    );
}