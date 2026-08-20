import { useState, useEffect, type SyntheticEvent } from 'react';
import { createPortal } from 'react-dom';
import { X, Archive, Check, ArrowRight, FileText, UserPlus, PenTool, Ban, RefreshCcw, ShieldCheck, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import FilePreviewModal from './FilePreviewModal';
import type { DocumentLog, SignatureData } from '../../types/processing';

interface DocumentTrailProps {
    doc: {
        id: string;
        status: string;
        remarks?: string;
    };
    onBack: () => void;
}

// Extends the global SignatureData specifically for this modal's UI labels
interface SignatureModalState extends SignatureData {
    actionLabel: string;
}

export default function DigitalTrailModal({ doc, onBack }: DocumentTrailProps) {
    const [isClosing, setIsClosing] = useState(false);
    const [events, setEvents] = useState<DocumentLog[]>([]);
    const [creatorName, setCreatorName] = useState<string>('System User');
    const [isLoadingLogs, setIsLoadingLogs] = useState(true);
    
    // Preview States
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [signatureToView, setSignatureToView] = useState<SignatureModalState | null>(null);

    const headerClass = 'bg-slate-900';

    const overlayAnimation = isClosing 
        ? "animate-out fade-out duration-200 ease-in fill-mode-forwards" 
        : "animate-in fade-in duration-200 ease-out fill-mode-forwards";
        
    const modalAnimation = isClosing 
        ? "animate-out slide-out-to-bottom-[100%] sm:slide-out-to-bottom-0 sm:zoom-out-95 duration-300 ease-in fill-mode-forwards" 
        : "animate-in slide-in-from-bottom-[100%] sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300 ease-out fill-mode-forwards";

    const handleClose = (e?: SyntheticEvent) => {
        if (e && e.cancelable && e.preventDefault) {
            e.preventDefault(); 
        }
        if (isClosing) return; 
        
        setIsClosing(true);
        setTimeout(() => { onBack(); }, 300); 
    };

    useEffect(() => {
        const fetchLogsAndCreator = async () => {
            setIsLoadingLogs(true);
            
            // 1. Safely fetch the logs
            const { data: logsData, error: logsError } = await supabase
                .from('document_logs')
                .select('*')
                .eq('document_id', doc.id)
                .order('created_at', { ascending: false }); 
            
            // 2. Fetch the actual creator's name from the document's created_by ID
            try {
                const { data: docData } = await supabase
                    .from('documents')
                    .select('created_by')
                    .eq('id', doc.id)
                    .single();

                if (docData?.created_by) {
                    const { data: profileData } = await supabase
                        .from('profiles')
                        .select('full_name')
                        .eq('id', docData.created_by)
                        .single();

                    if (profileData?.full_name) {
                        setCreatorName(profileData.full_name);
                    }
                }
            } catch (e) {
                console.warn("Could not fetch creator name", e);
            }
            
            if (logsData && !logsError) setEvents(logsData as DocumentLog[]);
            setIsLoadingLogs(false);
        };
        fetchLogsAndCreator();
    }, [doc.id]);

    return createPortal(
        <>
        {/* Background Overlay */}
        <div className={`fixed inset-0 z-[999] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/70 backdrop-blur-sm ${overlayAnimation}`}>
            
            {/* THE MODAL */}
            <div className={`bg-white w-full max-w-md h-[60vh] sm:h-[600px] flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.3)] rounded-t-[2rem] sm:rounded-3xl overflow-hidden ${modalAnimation}`}>
                
                {/* Header */}
                <div className={`text-white relative flex flex-col shrink-0 ${headerClass}`}>
                    <div className="w-12 h-1.5 bg-white/30 rounded-full mx-auto mt-3 sm:hidden shrink-0"></div>
                    <div className="p-4 flex items-center justify-between">
                        <div className="w-10"></div>
                        <h3 className="font-bold text-lg tracking-tight">Track Document</h3>
                        <button 
                            onClick={handleClose} 
                            onTouchEnd={handleClose} 
                            className="p-2 -mr-2 bg-white/10 md:hover:bg-white/20 active:bg-white/30 rounded-full transition-all duration-200 active:scale-90"
                        >
                            <X size={24} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto bg-white p-4 pt-6 custom-scrollbar">
                    <div className="relative">
                        
                        {/* 1. SKELETON LOADER */}
                        {isLoadingLogs && (
                            <div className="space-y-0 animate-pulse pt-2">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="flex gap-4 relative w-full">
                                        <div className="w-20 shrink-0 flex flex-col items-end gap-1.5 pt-1">
                                            <div className="w-16 h-2.5 bg-slate-200 rounded-full"></div>
                                            <div className="w-12 h-2 bg-slate-100 rounded-full"></div>
                                        </div>
                                        <div className="relative flex flex-col items-center">
                                            {i !== 3 && <div className="absolute top-6 bottom-[-1.5rem] w-[2px] bg-slate-100"></div>}
                                            <div className="relative z-10 w-[22px] h-[22px] mt-0.5 rounded-full bg-slate-200"></div>
                                        </div>
                                        <div className="flex-1 pb-10 space-y-2.5 pt-1">
                                            <div className="w-32 h-3.5 bg-slate-200 rounded-full mb-2"></div>
                                            <div className="w-3/4 h-2.5 bg-slate-100 rounded-full"></div>
                                            <div className="w-1/2 h-2.5 bg-slate-100 rounded-full"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {/* 2. ACTUAL DATA */}
                        {!isLoadingLogs && events.length === 0 && (
                            <div className="text-center p-6 text-slate-500 animate-in fade-in duration-300">
                                <Archive size={32} className="mx-auto mb-2 opacity-50" />
                                <p className="font-medium text-sm">Tracking history is not available for this legacy document.</p>
                            </div>
                        )}

                        {!isLoadingLogs && events.map((log, index) => {
                            const dateObj = new Date(log.created_at);
                            const dateStr = dateObj.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' });
                            const timeStr = dateObj.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });

                            let icon = <div className="w-2 h-2 bg-slate-400 rounded-full"></div>;
                            let nodeBg = 'bg-slate-200';
                            let titleColor = 'text-slate-900';

                            // --- ASSIGN COLORS & ICONS BASED ON ACTION ---
                            if (log.action === 'Delivered') { icon = <Check size={14} strokeWidth={4} className="text-white" />; nodeBg = 'bg-emerald-500'; titleColor = 'text-emerald-700'; } 
                            else if (log.action === 'Cancelled') { icon = <Ban size={14} strokeWidth={3} className="text-white" />; nodeBg = 'bg-rose-500'; titleColor = 'text-rose-700'; }
                            else if (log.action === 'Returned') { icon = <X size={14} strokeWidth={4} className="text-white" />; nodeBg = 'bg-red-500'; titleColor = 'text-red-700'; } 
                            else if (log.action === 'Resubmitted') { icon = <RefreshCcw size={14} strokeWidth={3} className="text-white" />; nodeBg = 'bg-indigo-500'; titleColor = 'text-indigo-700'; }
                            else if (log.action === 'In transit') { icon = <ArrowRight size={14} strokeWidth={3} className="text-white" />; nodeBg = 'bg-blue-500'; titleColor = 'text-blue-700'; } 
                            else if (log.action === 'Re-routed') { icon = <Send size={14} strokeWidth={3} className="text-white" />; nodeBg = 'bg-blue-600'; titleColor = 'text-blue-800'; } 
                            else if (log.action === 'Document Logged' || log.action === 'Created') { icon = <Check size={14} strokeWidth={4} className="text-white" />; nodeBg = 'bg-slate-700'; titleColor = 'text-slate-800'; }
                            else if (log.action === 'REASSIGNED') { icon = <UserPlus size={14} strokeWidth={3} className="text-white" />; nodeBg = 'bg-amber-500'; titleColor = 'text-amber-700'; }

                            // Formats lines with colons (e.g. "Reason: Because...") to be bold
                            const formatDescription = (text?: string) => {
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
                            
                            // --- COMPILE DESCRIPTIONS ---
                            if (log.action === 'Document Logged' || log.action === 'Created') desc = `Location: ${log.location}\nCreated By: ${creatorName}`;
                            if (log.action === 'In transit') desc = `Arrived at: ${log.location}\nReceived By: ${log.assigned_to}`;
                            if (log.action === 'Returned') desc = `Returned to: ${log.location}\nReason: ${log.remarks}`;
                            if (log.action === 'Delivered') { desc = `Secured At: ${log.location}`; if (log.remarks) desc += `\n${log.remarks}`; }
                            if (log.action === 'REASSIGNED') desc = `Location: ${log.location}\nDetails: ${log.remarks}`;
                            if (log.action === 'Cancelled') desc = `Location: ${log.location}\n${log.remarks}`;
                            if (log.action === 'Resubmitted') desc = `Location: ${log.location}\n${log.remarks}`;
                            if (log.action === 'Re-routed') desc = `Re-routed to: ${log.location}\nAssigned to: ${log.assigned_to}\nRemarks: ${log.remarks}`;

                            // --- Determine Action Label and Name for Signature ---
                            let sigActionLabel = "Signed By";
                            let sigName = log.assigned_to || creatorName || 'Authorized Personnel';

                            if (log.action === 'In transit') {
                                sigActionLabel = "Received By";
                            } else if (log.action === 'Delivered') {
                                sigActionLabel = "Released By";
                                // Extract the person who actively released it from the remarks
                                if (log.remarks) {
                                    const releasedMatch = log.remarks.match(/Released By:\s*([^\n]+)/i);
                                    if (releasedMatch && releasedMatch[1]) {
                                        sigName = releasedMatch[1].trim();
                                    }
                                }
                            } else if (log.action === 'Returned') {
                                sigActionLabel = "Returned By";
                            }

                            return (
                                <div key={index} className="flex gap-4 relative w-full animate-in fade-in duration-300" style={{ animationFillMode: 'both', animationDelay: `${index * 50}ms` }}>
                                    <div className="w-20 shrink-0 flex flex-col text-right pt-0.5">
                                        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tight leading-tight">{dateStr}</span>
                                        <span className="text-[10px] font-medium text-slate-400 mt-0.5">{timeStr}</span>
                                    </div>
                                    <div className="relative flex flex-col items-center">
                                        {index !== events.length - 1 && <div className="absolute top-5 bottom-[-1.5rem] w-[2px] bg-slate-200"></div>}
                                        <div className={`relative z-10 w-[22px] h-[22px] mt-0.5 rounded-full flex items-center justify-center ${nodeBg}`}>{icon}</div>
                                    </div>
                                    <div className="flex-1 pb-10 min-w-0 pr-1">
                                        <h4 className={`text-sm font-bold leading-none mb-1.5 ${titleColor}`}>{log.action}</h4>
                                        <div className="text-sm text-slate-600 leading-relaxed">{formatDescription(desc)}</div>
                                        
                                        {/* Attachment & Signature Buttons - Forced Side-by-Side Flex Row */}
                                        {(log.attachment_url || log.signature_url) && (
                                            <div className="flex flex-row items-center gap-2 mt-3 w-full">
                                                {log.attachment_url && (
                                                    <button 
                                                        onClick={() => setPreviewUrl(log.attachment_url || null)} 
                                                        className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 sm:px-3 sm:py-2 bg-blue-50 text-blue-600 rounded-lg text-[10px] sm:text-xs font-bold whitespace-nowrap transition-all active:scale-95 border border-blue-200"
                                                    >
                                                        <FileText size={14} className="shrink-0" />
                                                        <span className="truncate">View File</span>
                                                    </button>
                                                )}
                                                {log.signature_url && (
                                                    <button 
                                                        onClick={() => setSignatureToView({
                                                            url: log.signature_url!,
                                                            signedBy: sigName,
                                                            signedAt: `${dateStr}, ${timeStr}`,
                                                            actionLabel: sigActionLabel
                                                        })} 
                                                        className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 sm:px-3 sm:py-2 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] sm:text-xs font-bold whitespace-nowrap transition-all active:scale-95 border border-indigo-200"
                                                    >
                                                        <PenTool size={14} className="shrink-0" />
                                                        <span className="truncate">View Signature</span>
                                                    </button>
                                                )}
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
        
        {/* Sub-Modals */}
        {previewUrl && <FilePreviewModal url={previewUrl} onClose={() => setPreviewUrl(null)} />}
        {signatureToView && <SignatureModal data={signatureToView} onClose={() => setSignatureToView(null)} />}
        </>,
        document.body
    );
}

// --- NEW PROFESSIONAL SIGNATURE MODAL COMPONENT ---
function SignatureModal({ data, onClose }: { data: SignatureModalState, onClose: () => void }) {
    const [isClosing, setIsClosing] = useState(false);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(onClose, 150); // Matches the new closing speed
    };

    // FAST ANIMATIONS (150ms instead of 200ms/300ms)
    const overlayAnimation = isClosing 
        ? "animate-out fade-out duration-150 ease-in fill-mode-forwards" 
        : "animate-in fade-in duration-150 ease-out fill-mode-forwards";
        
    const modalAnimation = isClosing 
        ? "animate-out slide-out-to-bottom-[100%] sm:slide-out-to-bottom-0 sm:zoom-out-95 duration-150 ease-in fill-mode-forwards" 
        : "animate-in slide-in-from-bottom-[100%] sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-150 ease-out fill-mode-forwards";

    return (
        <div className={`fixed inset-0 z-[1000] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/80 backdrop-blur-sm ${overlayAnimation}`}>
            <div className={`bg-white w-full max-w-sm flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.5)] rounded-t-[2rem] sm:rounded-3xl overflow-hidden ${modalAnimation}`}>
                
                {/* Header */}
                <div className="bg-slate-900 p-4 flex items-center justify-between text-white shrink-0 relative">
                    <div className="w-12 h-1.5 bg-white/30 rounded-full mx-auto absolute top-2 left-1/2 -translate-x-1/2 sm:hidden"></div>
                    <div className="flex items-center gap-2 mt-2 sm:mt-0">
                        <PenTool size={20} className="text-indigo-400" />
                        <h3 className="font-bold text-lg tracking-tight">E-Signature</h3>
                    </div>
                    <button 
                        onClick={handleClose} 
                        className="p-2 -mr-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-950 rounded-full transition-all duration-200 active:scale-90 mt-2 sm:mt-0 shadow-sm"
                    >
                        <X size={20} strokeWidth={2.5} />
                    </button>
                </div>

                {/* Content: Professional Signature Certificate */}
                <div className="p-5 sm:p-6 flex flex-col bg-slate-50 min-h-[300px]">
                    <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm overflow-hidden flex flex-col">
                        
                        {/* Certificate Header / Verified Badge */}
                        <div className="bg-emerald-50 border-b-2 border-emerald-100 p-4 flex flex-col items-center justify-center gap-1 text-center">
                            <div className="flex items-center gap-1.5 text-emerald-700">
                                <ShieldCheck size={20} strokeWidth={2.5} />
                                <h4 className="text-xs font-black uppercase tracking-widest">Verified & Logged</h4>
                            </div>
                            <span className="text-[11px] font-bold text-emerald-600/70 uppercase">{data.signedAt}</span>
                        </div>

                        {/* Signature Area */}
                        <div className="p-6 flex flex-col items-center text-center">
                            <p className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">E-Signature</p>
                            
                            <div className="w-full h-32 flex items-center justify-center border-b-2 border-slate-300 border-dashed pb-2 mb-5 px-4 bg-white">
                                <img 
                                    src={data.url} 
                                    alt="Signature" 
                                    className="max-w-full max-h-full object-contain drop-shadow-sm" 
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                        e.currentTarget.parentElement!.innerHTML = '<p class="text-sm text-slate-400 font-bold">Image not available</p>';
                                    }}
                                />
                            </div>

                            <p className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{data.actionLabel}</p>
                            <p className="text-lg sm:text-xl font-black text-slate-900 leading-tight">{data.signedBy}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}