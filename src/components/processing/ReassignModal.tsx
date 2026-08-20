import { useState, useEffect } from 'react';
import { X, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

// --- Interfaces ---
interface DocumentItem {
    id: string;
    reference_no?: string;
    title?: string;
    current_location?: string;
    assigned_clerk?: string;
}

interface ReassignModalProps {
    doc: DocumentItem;
    currentUserId: string;
    currentUserName: string;
    onClose: () => void;
    onSuccess: () => void;
}

export default function ReassignModal({ doc, currentUserId, currentUserName, onClose, onSuccess }: ReassignModalProps) {
    const [selectedColleague, setSelectedColleague] = useState('');
    const [isReassigning, setIsReassigning] = useState(false);
    const [colleagues, setColleagues] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchColleagues = async () => {
            setIsLoading(true);
            try {
                const { data: userData } = await supabase.from('employees').select('department').eq('name', currentUserName).single();
                if (userData && userData.department) {
                    const { data: deptUsers } = await supabase.from('employees').select('name').eq('department', userData.department).neq('name', currentUserName);
                    if (deptUsers) {
                        setColleagues(deptUsers.map(u => u.name));
                    }
                }
            } catch (error) {
                console.error("Failed to fetch colleagues", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchColleagues();
    }, [currentUserName]);

    const handleConfirm = async () => {
        if (!selectedColleague) {
            toast.error("Validation Error", { description: "Please select a colleague to assign this to." });
            return;
        }
        
        setIsReassigning(true);
        try {
            const prevClerk = doc.assigned_clerk || 'Unassigned';

            // ATOMIC RPC CALL
            const { error: rpcError } = await supabase.rpc('process_document_action', {
                p_doc_id: doc.id,
                p_log_action: 'REASSIGNED',
                p_log_location: doc.current_location || 'Processing',
                p_log_created_by: currentUserId,
                p_log_assigned_to: null,
                p_log_remarks: `Details: Reassigned from ${prevClerk} to ${selectedColleague} by ${currentUserName}`,
                p_log_signature_url: null,
                p_log_attachment_url: null,
                p_new_status: null,
                p_new_location: null,
                p_new_clerk: selectedColleague,
                p_new_remarks: null,
                p_clear_remarks: false,
                p_completed_attachment_url: null
            });

            if (rpcError) throw rpcError;

            toast.success("Reassigned", { description: `Document assigned to ${selectedColleague}.` });
            onSuccess();
            onClose();
        } catch (err: any) {
            toast.error("Reassignment Failed", { description: err.message });
        } finally {
            setIsReassigning(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                            <UserPlus size={20} />
                        </div>
                        <h3 className="font-bold text-slate-800">Reassign Document</h3>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors" disabled={isReassigning}>
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-5 space-y-4">
                    <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                        <p className="text-sm text-blue-800">
                            Assigning <strong>{doc.reference_no || 'document'}</strong> to a colleague within your department.
                        </p>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Select Colleague *</label>
                        <select 
                            value={selectedColleague} 
                            onChange={(e) => setSelectedColleague(e.target.value)}
                            disabled={isReassigning || isLoading}
                            className="w-full p-3 bg-white border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl outline-none text-sm transition-all"
                        >
                            <option value="" disabled>{isLoading ? 'Loading colleagues...' : 'Choose a colleague...'}</option>
                            {colleagues.map((colleague, idx) => (
                                <option key={idx} value={colleague}>{colleague}</option>
                            ))}
                        </select>
                    </div>
                </div>
                
                <div className="p-5 border-t border-slate-100 bg-slate-50 flex gap-3">
                    <button onClick={onClose} disabled={isReassigning} className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50">Back</button>
                    <button onClick={handleConfirm} disabled={isReassigning} className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center">
                        {isReassigning ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : 'Confirm Reassign'}
                    </button>
                </div>
            </div>
        </div>
    );
}