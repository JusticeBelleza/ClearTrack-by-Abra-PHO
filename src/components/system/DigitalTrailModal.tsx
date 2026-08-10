import { useState, useEffect } from 'react';
import { X, Archive, Check, ArrowRight, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import FilePreviewModal from './FilePreviewModal';

export default function DigitalTrailModal({ doc, onBack }: any) {
    const [isClosing, setIsClosing] = useState(false);
    const [events, setEvents] = useState<any[]>([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(true);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const isCompleted = doc.status === 'sealed';
    const isReturned = doc.status === 'pending' && doc.remarks;
    const headerClass = isCompleted ? 'bg-emerald-700' : isReturned ? 'bg-red-700' : 'bg-slate-900';

    const handleClose = (e?: any) => {
        // FIX: Check if the event can actually be canceled before trying to prevent default
        if (e && e.cancelable && e.preventDefault) {
            e.preventDefault(); 
        }
        if (isClosing) return; 
        
        setIsClosing(true);
        setTimeout(() => { onBack(); }, 400); 
    };

    useEffect(() => {
        const fetchLogs = async () => {
            setIsLoadingLogs(true);
            const { data, error } = await supabase
                .from('document_logs')
                .select('*')
                .eq('document_id', doc.id)
                .order('created_at', { ascending: false }); 
            
            if (data && !error) setEvents(data);
            setIsLoadingLogs(false);
        };
        fetchLogs();
    }, [doc.id]);

    return (
        <>
        <div className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm ${isClosing ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
            <div className={`bg-white w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl rounded-t-3xl sm:rounded-3xl overflow-hidden ${isClosing ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
                
                <div className={`text-white relative flex flex-col shrink-0 ${headerClass}`}>
                    <div className="w-12 h-1.5 bg-white/30 rounded-full mx-auto mt-3 sm:hidden shrink-0"></div>
                    <div className="p-4 flex items-center justify-between">
                        <div className="w-10"></div>
                        <h3 className="font-bold text-lg tracking-tight">Track Document</h3>
                        <button onClick={handleClose} onTouchEnd={handleClose} className="p-2 -mr-2 bg-white/10 md:hover:bg-white/20 active:bg-white/30 rounded-full transition-colors">
                            <X size={24} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-white p-4 pt-6">
                    <div className="relative">
                        {isLoadingLogs && <div className="text-center p-4 text-slate-500 font-bold">Loading route history...</div>}
                        
                        {!isLoadingLogs && events.length === 0 && (
                            <div className="text-center p-6 text-slate-500">
                                <Archive size={32} className="mx-auto mb-2 opacity-50" />
                                <p className="font-medium text-sm">Tracking history is not available for this legacy document.</p>
                            </div>
                        )}

                        {events.map((log, index) => {
                            const dateObj = new Date(log.created_at);
                            const dateStr = dateObj.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' });
                            const timeStr = dateObj.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });

                            let icon = <div className="w-2 h-2 bg-slate-400 rounded-full"></div>;
                            let nodeBg = 'bg-slate-200';
                            let titleColor = 'text-slate-900';

                            if (log.action === 'Delivered') { icon = <Check size={14} strokeWidth={4} className="text-white" />; nodeBg = 'bg-emerald-500'; titleColor = 'text-emerald-700'; } 
                            else if (log.action === 'Returned') { icon = <X size={14} strokeWidth={4} className="text-white" />; nodeBg = 'bg-red-500'; titleColor = 'text-red-700'; } 
                            else if (log.action === 'In transit') { icon = <ArrowRight size={14} strokeWidth={3} className="text-white" />; nodeBg = 'bg-blue-500'; titleColor = 'text-blue-700'; } 
                            else if (log.action === 'Document Logged') { icon = <Check size={14} strokeWidth={4} className="text-white" />; nodeBg = 'bg-slate-700'; titleColor = 'text-slate-800'; }

                            const formatDescription = (text: string) => {
                                if(!text) return null;
                                return text.split('\n').map((line, i) => {
                                    if(line.includes(':')) {
                                        const [label, ...rest] = line.split(':');
                                        return <p key={i} className="mb-0.5"><span className="font-bold text-slate-700">{label}:</span> {rest.join(':')}</p>
                                    }
                                    return <p key={i} className="mb-0.5">{line}</p>
                                });
                            };

                            let desc = '';
                            if (log.action === 'Document Logged') desc = `Location: ${log.location}`;
                            if (log.action === 'In transit') desc = `Arrived at: ${log.location}\nReceived By: ${log.assigned_to}`;
                            if (log.action === 'Returned') desc = `Returned to: ${log.location}\nReason: ${log.remarks}`;
                            if (log.action === 'Delivered') { desc = `Secured At: ${log.location}`; if (log.remarks) desc += `\n${log.remarks}`; }

                            return (
                                <div key={index} className="flex gap-4 relative w-full">
                                    <div className="w-14 shrink-0 flex flex-col text-right pt-0.5">
                                        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">{dateStr}</span>
                                        <span className="text-[10px] font-medium text-slate-400 mt-0.5">{timeStr}</span>
                                    </div>
                                    <div className="relative flex flex-col items-center">
                                        {index !== events.length - 1 && <div className="absolute top-5 bottom-[-1.5rem] w-[2px] bg-slate-200"></div>}
                                        <div className={`relative z-10 w-[22px] h-[22px] mt-0.5 rounded-full flex items-center justify-center ${nodeBg}`}>{icon}</div>
                                    </div>
                                    <div className="flex-1 pb-10">
                                        <h4 className={`text-sm font-bold leading-none mb-1.5 ${titleColor}`}>{log.action}</h4>
                                        <div className="text-sm text-slate-600 leading-relaxed pr-2">{formatDescription(desc)}</div>
                                        {log.attachment_url && (
                                            <div className="mt-3">
                                                <button onClick={() => setPreviewUrl(log.attachment_url)} className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-lg border border-blue-200 transition-colors active:scale-95 shadow-sm">
                                                    <FileText size={16} strokeWidth={2.5} /> Click to view file
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
        {previewUrl && <FilePreviewModal url={previewUrl} onClose={() => setPreviewUrl(null)} />}
        </>
    );
}