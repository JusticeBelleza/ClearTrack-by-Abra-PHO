import { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

// --- Interfaces ---
interface DocumentItem {
    id: string;
    reference_no?: string;
    title?: string;
    subject?: string;
    current_location?: string;
    assigned_clerk?: string;
}

interface CancelModalProps {
    doc: DocumentItem;
    currentUserId: string;
    onClose: () => void;
    onSuccess: () => void;
}

export default function CancelModal({ doc, currentUserId, onClose, onSuccess }: CancelModalProps) {
    const [reason, setReason] = useState('');
    const [isCancelling, setIsCancelling] = useState(false);

    const handleConfirm = async () => {
        if (!reason.trim()) {
            toast.error("Validation Error", { description: "Please provide a reason for cancellation." });
            return;
        }
        
        setIsCancelling(true);
        try {
            // ATOMIC RPC CALL: Explicitly mapping parameters
            const { error: rpcError } = await supabase.rpc('process_document_action', {
                p_doc_id: doc.id,
                p_log_action: 'Cancelled',
                p_log_location: doc.current_location || 'Processing',
                p_log_created_by: currentUserId,
                p_log_assigned_to: null,
                p_log_remarks: `Reason: ${reason.trim()}`,
                p_log_signature_url: null,
                p_log_attachment_url: null,
                p_new_status: 'cancelled',
                p_new_location: null,
                p_new_clerk: null,
                p_new_remarks: reason.trim(), // Updates main document card
                p_clear_remarks: false,
                p_completed_attachment_url: null
            });

            if (rpcError) throw rpcError;

            toast.success("Document Cancelled", { description: "The document has been marked as cancelled." });
            onSuccess();
            onClose();
        } catch (err: any) {
            toast.error("Cancellation Failed", { description: err.message });
        } finally {
            setIsCancelling(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                            <AlertCircle size={20} />
                        </div>
                        <h3 className="font-bold text-slate-800">Cancel Document</h3>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors" disabled={isCancelling}>
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-5 space-y-4">
                    <div className="bg-red-50 p-3 rounded-xl border border-red-100">
                        <p className="text-sm text-red-800">
                            You are about to cancel <strong>{doc.reference_no || 'this document'}</strong>. This action will halt all processing.
                        </p>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Reason for Cancellation *</label>
                        <textarea 
                            value={reason} 
                            onChange={(e) => setReason(e.target.value)} 
                            placeholder="State why this document is being cancelled..." 
                            className="w-full p-3 bg-white border border-slate-200 focus:border-red-500 focus:ring-4 focus:ring-red-500/10 rounded-xl outline-none text-sm transition-all min-h-[100px] resize-y"
                            disabled={isCancelling}
                        ></textarea>
                    </div>
                </div>
                
                <div className="p-5 border-t border-slate-100 bg-slate-50 flex gap-3">
                    <button onClick={onClose} disabled={isCancelling} className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50">Back</button>
                    <button onClick={handleConfirm} disabled={isCancelling} className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center">
                        {isCancelling ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : 'Confirm Cancel'}
                    </button>
                </div>
            </div>
        </div>
    );
}