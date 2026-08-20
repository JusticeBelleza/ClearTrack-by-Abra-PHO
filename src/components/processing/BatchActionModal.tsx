import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MapPin, CheckCircle, Ban, UserPlus, ArrowLeft, X, PenTool, Camera, ChevronRight, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { convertImageToScannedPDF } from '../../lib/utils';
import type { DocumentItem, OptionType } from '../../types/processing';
import CustomSelect from '../ui/CustomSelect';
import SignaturePad, { type SignaturePadRef } from '../ui/SignaturePad';

interface BatchModalProps {
    selectedDocs: DocumentItem[]; currentUserId: string; currentUserName: string; departments: OptionType[]; colleagues: string[]; onClose: () => void; onSuccess: () => void;
}

export default function BatchActionModal({ selectedDocs, currentUserId, currentUserName, departments, colleagues, onClose, onSuccess }: BatchModalProps) {
    const signaturePadRef = useRef<SignaturePadRef>(null);

    const [isClosing, setIsClosing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeAction, setActiveAction] = useState<'add_step' | 'complete' | 'reject' | 'reassign' | null>(null);
    
    const [hasSignature, setHasSignature] = useState(false);
    const [destination, setDestination] = useState('');
    const [receivingClerk, setReceivingClerk] = useState('');
    const [remarks, setRemarks] = useState('');
    const [selectedColleague, setSelectedColleague] = useState('');
    const [releasedBy, setReleasedBy] = useState('');
    const [retentionFate, setRetentionFate] = useState<'originator' | 'destination' | null>(null);
    const [isProcessingFile, setIsProcessingFile] = useState(false);
    const [attachment, setAttachment] = useState<File | Blob | null>(null);
    const [attachmentName, setAttachmentName] = useState<string>('');

    const [originData, setOriginData] = useState<Record<string, { office: string, creator: string }>>({});
    const [isLoadingOrigins, setIsLoadingOrigins] = useState(false);

    const canProcessBatch = useMemo(() => selectedDocs.every((doc) => doc.assigned_clerk === currentUserName), [selectedDocs, currentUserName]);

    const handleClose = () => { setIsClosing(true); setTimeout(onClose, 300); };

    const handleBackBtn = () => {
        if (isSubmitting) return;
        setActiveAction(null); setHasSignature(false); setRemarks(''); setDestination(''); setReceivingClerk('');
        setSelectedColleague(''); setReleasedBy(''); setRetentionFate(null); setAttachment(null);
    };

    useEffect(() => {
        if (activeAction === 'reject' && selectedDocs.length > 0) {
            setIsLoadingOrigins(true);
            const fetchOrigins = async () => {
                const newOriginData: Record<string, { office: string, creator: string }> = {};
                await Promise.all(selectedDocs.map(async (doc) => {
                    let originOffice = 'Originating Office'; let creatorName = 'Creator';
                    if (doc.created_by) {
                        try {
                            const { data: creatorData } = await supabase.from('profiles').select('full_name').eq('id', doc.created_by).single();
                            if (creatorData?.full_name) {
                                creatorName = creatorData.full_name;
                                const { data: empData } = await supabase.from('employees').select('department').eq('name', creatorName).single();
                                if (empData?.department) originOffice = empData.department;
                            }
                        } catch (err) { console.error("Failed to fetch origin"); }
                    }
                    newOriginData[doc.id] = { office: originOffice, creator: creatorName };
                }));
                setOriginData(newOriginData); setIsLoadingOrigins(false);
            };
            fetchOrigins();
        }
    }, [activeAction, selectedDocs]);

    const clearSignature = () => { 
        signaturePadRef.current?.clear(); 
        setHasSignature(false); 
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; 
        if (!file) return;

        // Ensure file does not exceed 25MB
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
                setAttachmentName('Batch_Completed.pdf');
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

    const handleBatchSubmit = async () => {
        if (activeAction === 'reject') {
            if (isLoadingOrigins) { toast.error("Please wait", { description: "Still locating the origin offices for your batch." }); return; }
            if (!remarks.trim()) { toast.error("Validation Error", { description: "Please provide a reason for returning the documents." }); return; }
        }
        if (activeAction === 'add_step') {
            if (!destination) { toast.error("Validation Error", { description: "Please provide a destination office." }); return; }
            if (!receivingClerk.trim()) { toast.error("Validation Error", { description: "Please provide a receiving clerk." }); return; }
            if (!hasSignature) { toast.error("Signature Required", { description: "You must sign the pad to confirm this batch action." }); return; }
        }
        if (activeAction === 'complete') {
            if (!releasedBy.trim()) { toast.error("Validation Error", { description: "Please specify who released the documents." }); return; }
            if (!retentionFate) { toast.error("Validation Error", { description: "Please select where the documents will be retained." }); return; }
            if (!hasSignature) { toast.error("Signature Required", { description: "You must sign the pad to complete this batch." }); return; }
        }
        if (activeAction === 'reassign') {
            if (!selectedColleague) { toast.error("Validation Error", { description: "Please select a colleague to re-assign to." }); return; }
        }

        setIsSubmitting(true);
        try {
            let sharedSignatureUrl = null; let sharedAttachmentUrl = null;

            const blob = await signaturePadRef.current?.getBlob();
            if (blob && (activeAction === 'add_step' || activeAction === 'complete')) {
                // CHANGED: Date.now() to crypto.randomUUID()
                const fileName = `batch-signature-${crypto.randomUUID()}.png`;
                const { error: uploadError } = await supabase.storage.from('attachments').upload(fileName, blob, { contentType: 'image/png' });
                if (!uploadError) sharedSignatureUrl = supabase.storage.from('attachments').getPublicUrl(fileName).data.publicUrl;
            }

            if (attachment && activeAction === 'complete') {
                // CHANGED: Date.now() to crypto.randomUUID()
                const fileName = `batch-completed-${crypto.randomUUID()}.pdf`;
                const { error: uploadError } = await supabase.storage.from('attachments').upload(fileName, attachment, { contentType: 'application/pdf' });
                if (!uploadError) sharedAttachmentUrl = supabase.storage.from('attachments').getPublicUrl(fileName).data.publicUrl;
            }

            const promises = selectedDocs.map(async (doc: DocumentItem) => {
                if (activeAction === 'complete') {
                    const fateString = retentionFate === 'originator' ? 'Returned to Originator' : 'Retained at Final Destination';
                    const detailedRemarks = `Released By: ${releasedBy.trim()}\nDocument Retention: ${fateString}${remarks ? `\nRemarks: ${remarks.trim()}` : ''}`;
                    
                    const { error: rpcError } = await supabase.rpc('process_document_action', {
                        p_doc_id: doc.id,
                        p_log_action: 'Delivered',
                        p_log_location: doc.final_destination || doc.current_location,
                        p_log_created_by: currentUserId,
                        p_log_assigned_to: currentUserName,
                        p_log_remarks: detailedRemarks,
                        p_log_signature_url: sharedSignatureUrl,
                        p_log_attachment_url: sharedAttachmentUrl,
                        p_new_status: 'sealed',
                        p_completed_attachment_url: sharedAttachmentUrl
                    });
                    if (rpcError) throw rpcError;

                } else if (activeAction === 'reject') {
                    const originInfo = originData[doc.id] || { office: 'Originating Office', creator: 'Creator' };
                    const finalRemarks = remarks.trim() || 'Returned without remarks';
                    
                    const { error: rpcError } = await supabase.rpc('process_document_action', {
                        p_doc_id: doc.id,
                        p_log_action: 'Returned',
                        p_log_location: originInfo.office,
                        p_log_created_by: currentUserId,
                        p_log_assigned_to: originInfo.creator,
                        p_log_remarks: finalRemarks,
                        p_new_status: 'pending',
                        p_new_location: originInfo.office,
                        p_new_clerk: originInfo.creator,
                        p_new_remarks: finalRemarks
                    });
                    if (rpcError) throw rpcError;

                } else if (activeAction === 'add_step') {
                    const { error: rpcError } = await supabase.rpc('process_document_action', {
                        p_doc_id: doc.id,
                        p_log_action: 'In transit',
                        p_log_location: destination,
                        p_log_created_by: currentUserId,
                        p_log_assigned_to: receivingClerk.trim(),
                        p_log_signature_url: sharedSignatureUrl,
                        p_new_status: 'routing',
                        p_new_location: destination,
                        p_clear_remarks: true
                    });
                    if (rpcError) throw rpcError;

                } else if (activeAction === 'reassign') {
                    const prevClerk = doc.assigned_clerk || 'Unassigned';
                    
                    const { error: rpcError } = await supabase.rpc('process_document_action', {
                        p_doc_id: doc.id,
                        p_log_action: 'REASSIGNED',
                        p_log_location: doc.current_location || 'Processing',
                        p_log_created_by: currentUserId,
                        p_log_remarks: `Batch re-assigned from ${prevClerk} to ${selectedColleague} by ${currentUserName}`,
                        p_new_clerk: selectedColleague
                    });
                    if (rpcError) throw rpcError;
                }
            });

            // Process all promises safely
            const results = await Promise.allSettled(promises);
            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;

            if (successful > 0) {
                if (failed > 0) {
                    toast.warning("Partial Success", { description: `Processed ${successful} documents, but ${failed} failed.` });
                } else {
                    toast.success(`Successfully processed all ${successful} documents!`);
                }
                onSuccess(); // Close modal and refetch
            } else {
                toast.error("Batch Failed", { description: "Failed to process the selected documents. Please check your permissions." });
            }

        } catch (error) { 
            toast.error("An error occurred during batch setup."); 
        } finally { 
            setIsSubmitting(false); 
        }
    };

    const headerColorClass = !activeAction || activeAction === 'add_step' ? 'bg-slate-900' : activeAction === 'reject' ? 'bg-red-700' : activeAction === 'complete' ? 'bg-emerald-700' : activeAction === 'reassign' ? 'bg-teal-700' : 'bg-slate-900';

    return (
        <div className={`fixed inset-0 z-[999] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/70 backdrop-blur-sm ${isClosing ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
            <div className={`bg-white w-full max-w-xl max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden shadow-2xl rounded-t-[1.5rem] sm:rounded-3xl ${isClosing ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
                <div className={`text-white relative flex flex-col shrink-0 transition-colors duration-300 ${headerColorClass}`}>
                    <div className="w-16 h-1.5 bg-white/30 rounded-full mx-auto mt-3 sm:hidden shrink-0"></div>
                    <div className="p-5 pt-3 sm:pt-6 flex items-center justify-between">
                        {activeAction ? <button onClick={handleBackBtn} disabled={isSubmitting} className="p-2 -ml-2 bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-full transition-all active:scale-90 disabled:opacity-50"><ArrowLeft size={24} /></button> : <div className="w-10"></div>}
                        <h3 className="font-black text-xl tracking-tight absolute left-1/2 -translate-x-1/2 whitespace-nowrap">{!activeAction ? 'Batch Action' : activeAction === 'reject' ? 'Reject & Return' : activeAction === 'complete' ? 'Finalize Batch' : activeAction === 'reassign' ? 'Batch Re-assign' : 'Route Document'}</h3>
                        <button onClick={handleClose} disabled={isSubmitting} className="p-2 -mr-2 bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-full transition-all active:scale-90 disabled:opacity-50"><X size={24} /></button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6 custom-scrollbar bg-white">
                    {!activeAction && (
                        <div className="bg-slate-50 border border-slate-200 p-4 sm:p-5 rounded-2xl flex flex-col items-start mb-2">
                            <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 font-mono">Selected Documents ({selectedDocs.length})</p>
                            <div className="flex flex-wrap gap-2">{selectedDocs.map((doc: DocumentItem) => <span key={doc.id} className="text-xs font-bold font-mono bg-white text-slate-700 border border-slate-300 px-2 py-1 rounded-lg shadow-sm">{doc.reference_no || doc.id.substring(0,8)}</span>)}</div>
                        </div>
                    )}
                    {!activeAction ? (
                        <div className="flex flex-col gap-3">
                            {!canProcessBatch && <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl flex items-start gap-3 shadow-sm mb-1"><AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" /><p className="text-xs sm:text-sm text-amber-800 font-medium leading-relaxed"><strong>Processing Restricted:</strong> Some documents in this batch are managed by other employees. You may only <strong className="text-amber-900">Re-assign</strong> them.</p></div>}
                            {canProcessBatch && <ActionCard title="Add Step" description="Route this batch to a new destination and clerk." icon={<MapPin size={20} strokeWidth={2.5} />} colorTheme="blue" onClick={() => setActiveAction('add_step')} />}
                            {canProcessBatch && <ActionCard title="Complete Documents" description="Instantly finalize and seal all selected records." icon={<CheckCircle size={20} strokeWidth={2.5} />} colorTheme="emerald" onClick={() => setActiveAction('complete')} />}
                            <ActionCard title="Re-assign Documents" description="Transfer ownership of these documents to a colleague." icon={<UserPlus size={20} strokeWidth={2.5} />} colorTheme="teal" onClick={() => setActiveAction('reassign')} />
                            {canProcessBatch && <ActionCard title="Return / Reject" description="Send these documents back with a unified reason." icon={<Ban size={20} strokeWidth={2.5} />} colorTheme="rose" onClick={() => setActiveAction('reject')} />}
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                            {activeAction === 'add_step' && (
                                <>
                                    <div className="relative z-20"><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Next Destination Office *</label><CustomSelect options={departments} value={destination} onChange={setDestination} placeholder="Select receiving office..." isRelative={true} /></div>
                                    <div className="relative z-10"><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Receiving Clerk *</label><input type="text" value={receivingClerk} onChange={(e) => setReceivingClerk(e.target.value)} placeholder="Enter name of receiving clerk..." className="w-full px-4 py-3.5 bg-slate-50/50 border border-slate-200 focus:bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 rounded-xl outline-none font-bold text-slate-700 text-sm transition-all" /></div>
                                    <div>
                                        <div className="flex justify-between items-center mb-1.5">
                                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><PenTool size={13}/> Signature *</label>
                                            <button onClick={clearSignature} type="button" className="text-[11px] text-slate-600 font-bold hover:text-slate-900 transition-colors bg-white px-3 py-1.5 rounded-lg border border-slate-200 active:scale-95 shadow-sm">Clear Pad</button>
                                        </div>
                                        <SignaturePad ref={signaturePadRef} onBegin={() => setHasSignature(true)} containerClassName="border border-slate-200 rounded-xl bg-slate-50/50 overflow-hidden touch-none relative shadow-sm" />
                                        <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Sign clearly within the box above</p>
                                    </div>
                                </>
                            )}
                            {activeAction === 'complete' && (
                                <>
                                    <div><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Scanned Signed Copy (Optional)</label><label className={`w-full flex items-center justify-center gap-2 p-3.5 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${attachment ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}><input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} disabled={isProcessingFile} />{isProcessingFile ? <span className="animate-pulse font-bold text-sm">Processing...</span> : attachment ? <><CheckCircle size={18}/> <span className="font-bold text-sm truncate max-w-[200px]">{attachmentName}</span></> : <><Camera size={18}/> <span className="font-bold text-sm">Scan Signed Document</span></>}</label>{attachment && !isProcessingFile && (<div className="mt-2 text-right"><button type="button" onClick={() => { setAttachment(null); setAttachmentName(''); }} className="text-xs text-red-500 font-bold hover:underline">Remove Attachment</button></div>)}</div>
                                    <div><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Released By *</label><input type="text" value={releasedBy} onChange={(e) => setReleasedBy(e.target.value)} placeholder="Name of official releasing the documents..." className="w-full p-3.5 bg-slate-50/50 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-xl outline-none font-bold text-slate-700 text-sm transition-all" /></div>
                                    <div>
                                        <div className="flex justify-between items-center mb-1.5"><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><PenTool size={13}/> Signature *</label><button onClick={clearSignature} type="button" className="text-[11px] text-slate-600 font-bold hover:text-slate-900 transition-colors bg-white px-3 py-1.5 rounded-lg border border-slate-200 active:scale-95 shadow-sm">Clear Pad</button></div>
                                        <SignaturePad ref={signaturePadRef} onBegin={() => setHasSignature(true)} containerClassName="border border-slate-200 rounded-xl bg-slate-50/50 overflow-hidden touch-none relative shadow-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Document Retention *</label>
                                        <div className="flex flex-col gap-2"><div onClick={() => setRetentionFate('originator')} className={`p-4 border rounded-xl cursor-pointer transition-all active:scale-[0.98] flex items-center gap-3 ${retentionFate === 'originator' ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-200 bg-white hover:border-slate-300'}`}><div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${retentionFate === 'originator' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'}`}>{retentionFate === 'originator' && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}</div><p className="font-bold text-sm text-slate-700">Return to Originator</p></div><div onClick={() => setRetentionFate('destination')} className={`p-4 border rounded-xl cursor-pointer transition-all active:scale-[0.98] flex items-center gap-3 ${retentionFate === 'destination' ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-200 bg-white hover:border-slate-300'}`}><div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${retentionFate === 'destination' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'}`}>{retentionFate === 'destination' && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}</div><p className="font-bold text-sm text-slate-700">Retain at Office</p></div></div>
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Unified Remarks (Optional)</label>
                                        <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Add final notes or context for the archive..." className="w-full p-3.5 bg-slate-50/50 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-xl outline-none font-bold text-slate-700 text-sm transition-all min-h-[100px] resize-y" ></textarea>
                                    </div>
                                </>
                            )}
                            {activeAction === 'reject' && (
                                <>
                                    <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-rose-700 text-sm font-bold flex flex-col gap-3 shadow-sm"><div className="flex items-start gap-3"><Ban size={20} className="shrink-0 mt-0.5" /><div className="flex-1"><p className="mb-3 text-rose-800">These documents will be automatically returned to:</p>{isLoadingOrigins ? <div className="flex items-center gap-2 text-rose-600"><span className="w-3 h-3 border-2 border-rose-300 border-t-rose-600 rounded-full animate-spin"></span><span className="text-xs uppercase tracking-wider font-bold">Locating offices...</span></div> : <div className="max-h-32 overflow-y-auto custom-scrollbar pr-2 space-y-2">{selectedDocs.map(doc => { const info = originData[doc.id]; return <div key={doc.id} className="bg-white/60 p-2 rounded-lg border border-rose-100/50 text-xs flex items-center justify-between shadow-sm"><span className="font-mono text-[10px] text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded mr-2 shrink-0">{doc.reference_no || doc.id.substring(0,8)}</span><div className="text-right min-w-0 flex-1 truncate"><span className="text-rose-900 font-bold block truncate">{info?.office || 'Originating Office'}</span><span className="text-rose-600/80 font-bold text-[10px] uppercase tracking-wider block truncate">For: {info?.creator || 'Creator'}</span></div></div>;})}</div>}</div></div></div>
                                    <div className="relative z-10"><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Reason for Rejection (Optional)</label><textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="E.g., Missing signature, incorrect attachments..." className="w-full p-3.5 bg-slate-50/50 border border-slate-200 focus:bg-white focus:border-red-500 focus:ring-4 focus:ring-red-500/10 rounded-xl outline-none font-bold text-slate-700 text-sm min-h-[140px] resize-y transition-all" ></textarea></div>
                                </>
                            )}
                            {activeAction === 'reassign' && (
                                <div className="relative z-20"><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Select Colleague *</label><CustomSelect options={colleagues} value={selectedColleague} onChange={(val: string) => setSelectedColleague(val)} placeholder="Choose an employee..." emptyText="No employee found" isRelative={true} /></div>
                            )}
                        </div>
                    )}
                </div>

                {activeAction && (
                    <div className="bg-white p-4 sm:p-5 flex shrink-0 border-t border-slate-100">
                        {activeAction === 'add_step' && <button onClick={handleBatchSubmit} disabled={isSubmitting || !destination || !receivingClerk.trim() || !hasSignature} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-sm transition-all active:scale-[0.98] text-sm flex justify-center items-center gap-2 border border-blue-600 disabled:opacity-50">{isSubmitting ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <><MapPin size={18} strokeWidth={2.5} /> Confirm Add Step</>}</button>}
                        {activeAction === 'complete' && <button onClick={handleBatchSubmit} disabled={isSubmitting || !releasedBy.trim() || !retentionFate || !hasSignature || isProcessingFile} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl shadow-sm transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2 border border-emerald-600 disabled:opacity-50">{isSubmitting ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <><CheckCircle size={18} strokeWidth={2.5} /> Finalize Batch</>}</button>}
                        {activeAction === 'reject' && <button onClick={handleBatchSubmit} disabled={isSubmitting || isLoadingOrigins} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl shadow-sm transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2 border border-red-600 disabled:opacity-50">{isSubmitting ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <><Ban size={18} strokeWidth={2.5} /> Confirm Return</>}</button>}
                        {activeAction === 'reassign' && <button onClick={handleBatchSubmit} disabled={isSubmitting || !selectedColleague} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 rounded-xl shadow-sm transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2 border border-teal-600 disabled:opacity-50">{isSubmitting ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <><UserPlus size={18} strokeWidth={2.5} /> Confirm Re-assign</>}</button>}
                    </div>
                )}
            </div>
        </div>
    );
}

function ActionCard({ title, description, icon, colorTheme, onClick }: { title: string; description: string; icon: React.ReactNode; colorTheme: 'blue' | 'emerald' | 'rose' | 'teal'; onClick: () => void; }) {
    const themeStyles = { blue: "hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-sm", emerald: "hover:border-emerald-300 hover:bg-emerald-50/50 hover:shadow-sm", rose: "hover:border-rose-300 hover:bg-rose-50/50 hover:shadow-sm", teal: "hover:border-teal-300 hover:bg-teal-50/50 hover:shadow-sm" };
    const iconStyles = { blue: "bg-blue-50 text-blue-600 border-blue-100", emerald: "bg-emerald-50 text-emerald-600 border-emerald-100", rose: "bg-rose-50 text-rose-600 border-rose-100", teal: "bg-teal-50 text-teal-600 border-teal-100" };
    const chevronStyles = { blue: "group-hover:text-blue-500 group-hover:translate-x-1", emerald: "group-hover:text-emerald-500 group-hover:translate-x-1", rose: "group-hover:text-rose-500 group-hover:translate-x-1", teal: "group-hover:text-teal-500 group-hover:translate-x-1" };
    return (
        <button onClick={onClick} className={`w-full text-left group bg-white border border-slate-200 p-4 sm:p-5 rounded-[1.25rem] transition-all duration-200 flex items-center gap-4 active:scale-[0.99] ${themeStyles[colorTheme]}`}>
            <div className={`p-3 rounded-xl border ${iconStyles[colorTheme]} transition-transform duration-300 group-hover:scale-110 shrink-0 shadow-sm`}>{icon}</div>
            <div className="flex-1 min-w-0 pr-2"><h5 className="font-black text-slate-900 text-base sm:text-lg leading-tight mb-0.5 truncate">{title}</h5><p className="text-xs sm:text-sm font-medium text-slate-500 leading-snug">{description}</p></div>
            <ChevronRight className={`text-slate-300 transition-all duration-300 shrink-0 ${chevronStyles[colorTheme]}`} size={20} />
        </button>
    );
}