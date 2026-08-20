// src/components/processing/ReassignModal.tsx
import { useState } from 'react';
import { UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import type { DocumentItem, OptionType } from '../../types/processing';
import CustomSelect from '../ui/CustomSelect';

interface ReassignModalProps {
    doc: DocumentItem;
    currentUserName: string;
    currentUserId: string;
    colleagues: string[];
    onClose: () => void;
    onSuccess: () => void;
}

export default function ReassignModal({ doc, currentUserName, currentUserId, colleagues, onClose, onSuccess }: ReassignModalProps) {
    const [selectedColleague, setSelectedColleague] = useState('');
    const [isReassigning, setIsReassigning] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

    const handleClose = () => { setIsClosing(true); setTimeout(onClose, 250); };
    
    const handleConfirm = async () => {
        if (!selectedColleague) return;
        setIsReassigning(true);
        try {
            const previousClerk = doc.assigned_clerk || 'Unassigned';
            const nowIso = new Date().toISOString();
            await supabase.from('document_logs').insert([{ document_id: doc.id, action: 'REASSIGNED', remarks: `Re-assigned from ${previousClerk} to ${selectedColleague} by ${currentUserName || 'System User'}`, location: doc.current_location || 'Processing', created_by: currentUserId }]);
            await supabase.from('documents').update({ assigned_clerk: selectedColleague, updated_at: nowIso }).eq('id', doc.id);
            toast.success(`Document re-assigned to ${selectedColleague}`);
            onSuccess(); handleClose();
        } catch { toast.error("Failed to re-assign document."); } finally { setIsReassigning(false); }
    };

    const colleagueOptions: OptionType[] = colleagues.map(c => ({ label: c, value: c }));

    return (
        <div className={`fixed inset-0 z-[999] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50 backdrop-blur-sm ${isClosing ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
            <div className={`bg-white w-full max-w-md flex flex-col shadow-2xl rounded-t-[1.5rem] sm:rounded-3xl ${isClosing ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
                <div className="bg-slate-900 p-5 sm:p-6 flex justify-between items-center text-white relative shrink-0 rounded-t-[1.5rem] sm:rounded-t-3xl z-20">
                    <div className="w-12 h-1.5 bg-white/30 rounded-full mx-auto absolute top-2 left-1/2 -translate-x-1/2 sm:hidden"></div>
                    <h3 className="font-black text-xl flex items-center gap-2 mt-2 sm:mt-0"><UserPlus size={22} className="text-teal-400" /> Re-assign</h3>
                    <button onClick={handleClose} className="p-1.5 hover:bg-white/20 rounded-full transition-colors active:scale-95 mt-2 sm:mt-0"><X size={20} /></button>
                </div>
                <div className="p-5 sm:p-6 space-y-5 bg-slate-50 flex-1 relative z-10 overflow-y-auto custom-scrollbar">
                    <div className="bg-white border-2 border-slate-200 p-4 rounded-xl shadow-sm">
                        <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Document ID</p>
                        <p className="font-mono text-base sm:text-lg font-black text-slate-900">{doc.reference_no || doc.id}</p>
                    </div>
                    <div className="relative z-20">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Select Colleague</label>
                        <CustomSelect options={colleagueOptions} value={selectedColleague} onChange={(val: string) => setSelectedColleague(val)} placeholder={colleagues.length === 0 ? "No other colleagues available" : "Choose an employee..."} emptyText="No employee found" isRelative={true} />
                    </div>
                </div>
                <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex gap-3 shrink-0 relative z-0 sm:rounded-b-3xl">
                    <button onClick={handleClose} className="flex-1 py-3.5 bg-white border-2 border-slate-300 hover:bg-slate-50 rounded-xl font-bold text-slate-700 transition-all active:scale-95 text-sm sm:text-base">Cancel</button>
                    <button onClick={handleConfirm} disabled={!selectedColleague || isReassigning} className="flex-[1.5] py-3.5 bg-teal-600 border-2 border-teal-700 text-white rounded-xl font-bold shadow-sm hover:bg-teal-700 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex justify-center items-center gap-2 text-sm sm:text-base">{isReassigning ? 'Updating...' : 'Confirm Re-assign'}</button>
                </div>
            </div>
        </div>
    );
}