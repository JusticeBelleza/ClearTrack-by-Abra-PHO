// src/components/processing/DocumentCard.tsx
import React from 'react';
import { AlertCircle, MapPin, Eye, Clock, ChevronRight, User, MessageSquareWarning, CheckSquare, Square, ChevronDown, UserPlus, Ban } from 'lucide-react';
import { formatPHDateTime } from '../../lib/utils';
import type { DocumentItem } from '../../types/processing';

interface DocumentCardProps {
    doc: DocumentItem;
    activeTab: 'processing' | 'returned';
    isSelected: boolean;
    isExpanded: boolean;
    showCheckbox: boolean;
    currentUserName: string;
    currentUserId: string;
    onToggleSelection: (doc: DocumentItem) => void;
    onToggleCollapse: (id: string) => void;
    onPreview: (url: string) => void;
    onTrack: (doc: DocumentItem) => void;
    onReassign: (doc: DocumentItem) => void;
    onCancel: (doc: DocumentItem) => void;
    onRevise: (doc: DocumentItem) => void;
    onAction: (doc: DocumentItem) => void;
}

export default function DocumentCard({
    doc, activeTab, isSelected, isExpanded, showCheckbox, currentUserName, currentUserId,
    onToggleSelection, onToggleCollapse, onPreview, onTrack, onReassign, onCancel, onRevise, onAction
}: DocumentCardProps) {
    
    const isManager = doc.assigned_clerk === currentUserName;
    const isCreator = doc.created_by === currentUserId;
    const canReassign = isManager || isCreator;
    const canRevise = isManager || isCreator;
    const isActionableTab = activeTab === 'processing';

    if (activeTab === 'returned') {
        return (
            <div className="bg-white rounded-[1.5rem] border-2 border-amber-300 shadow-sm shadow-amber-100 hover:border-amber-400 transition-all relative overflow-hidden flex flex-col group">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500"></div>
                
                <div className="p-5 flex-1 flex flex-col pl-6">
                    <div className="flex justify-between items-start mb-3">
                        <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-mono border border-slate-200">{doc.reference_no || doc.id}</span>
                        <span className="flex items-center gap-1 text-[10px] font-black text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 uppercase tracking-wider">
                            <AlertCircle size={12} strokeWidth={3}/> Needs Revision
                        </span>
                    </div>
                    
                    <h4 className="font-black text-lg text-slate-900 mb-1.5 leading-tight group-hover:text-blue-600 transition-colors">{doc.title || doc.subject}</h4>
                    
                    <div className="flex items-center gap-1.5 mb-4">
                        <User size={14} className="text-slate-400" />
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Managed by: <span className="text-slate-800">{doc.assigned_clerk || 'Unassigned'}</span></p>
                    </div>
                    
                    <div className="bg-amber-50/60 rounded-xl p-4 border-2 border-amber-200 mb-5 relative">
                        <div className="flex items-center gap-1.5 mb-1.5 text-amber-800">
                            <MessageSquareWarning size={14} />
                            <p className="text-[10px] font-black uppercase tracking-wider">Reason for Return</p>
                        </div>
                        <p className="text-sm text-amber-950 font-medium leading-relaxed">{doc.remarks}</p>
                    </div>

                    <div className="flex items-center gap-1.5 mb-5 mt-auto">
                        <Clock size={14} className="text-slate-400" />
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Returned {formatPHDateTime(doc.updated_at || doc.created_at)}</p>
                    </div>
                    
                    <div className="flex flex-col gap-2 mt-auto">
                        <div className="flex gap-2">
                            {doc.attachment_url && (
                                <button onClick={() => onPreview(doc.attachment_url as string)} className="shrink-0 py-2.5 px-3 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl flex items-center justify-center transition-all active:scale-95 border-2 border-slate-300 shadow-sm" title="View Attached File">
                                    <Eye size={18} />
                                </button>
                            )}
                            <button onClick={() => onTrack(doc)} className="flex-1 py-2.5 px-2 bg-white hover:bg-slate-50 text-slate-800 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 text-sm border-2 border-slate-300 shadow-sm">
                                History
                            </button>
                            {canReassign && (
                                <button onClick={() => onReassign(doc)} className="flex-1 py-2.5 px-2 bg-white hover:bg-slate-50 text-slate-800 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 text-sm border-2 border-slate-300 shadow-sm">
                                    <UserPlus size={16} /> Re-assign
                                </button>
                            )}
                        </div>
                        
                        {canRevise ? (
                            <div className="flex gap-2 w-full mt-1">
                                <button onClick={() => onCancel(doc)} className="flex-[1] py-2.5 px-2 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 text-sm border-2 border-red-200 shadow-sm">
                                    <Ban size={16}/> Cancel
                                </button>
                                <button onClick={() => onRevise(doc)} className="flex-[2.5] py-2.5 px-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 text-sm border-2 border-amber-700 shadow-sm">
                                    Revise & Resubmit
                                </button>
                            </div>
                        ) : (
                            <div className="w-full py-2.5 px-3 bg-amber-50/50 border-2 border-amber-100 rounded-xl text-center mt-1">
                                <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Pending revision by {doc.assigned_clerk}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`bg-white rounded-2xl border-2 transition-all relative overflow-hidden ${doc.is_urgent ? 'border-red-300 shadow-sm hover:border-red-400' : (isSelected ? 'border-blue-500 ring-4 ring-blue-500/10' : 'border-slate-200 hover:border-slate-300')}`}>
            <div className={`absolute top-0 left-0 w-full h-1 ${doc.is_urgent ? 'bg-red-600' : (isSelected ? 'bg-blue-500' : 'bg-transparent')}`}></div>
            
            <div onClick={() => onToggleCollapse(doc.id)} className="p-4 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-50/70 transition-colors">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    {showCheckbox && (
                        <button type="button" onClick={(e) => { e.stopPropagation(); onToggleSelection(doc); }} className={`p-1 rounded-lg transition-all border-2 shrink-0 ${isSelected ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-300 border-slate-200 hover:text-slate-500 hover:border-slate-300'}`}>
                            {isSelected ? <CheckSquare size={16} strokeWidth={2.5} /> : <Square size={16} strokeWidth={2.5} />}
                        </button>
                    )}
                    
                    <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 shrink-0">
                                {doc.reference_no || doc.id.substring(0, 8)}
                            </span>
                            {doc.is_urgent && (
                                <span className="flex items-center gap-0.5 text-[9px] font-black text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-200 uppercase tracking-wider animate-pulse shrink-0">
                                    <AlertCircle size={10} strokeWidth={3}/> Rush
                                </span>
                            )}
                        </div>
                        <h4 className="font-bold text-slate-900 text-sm sm:text-base leading-snug truncate">{doc.title || doc.subject}</h4>
                    </div>
                </div>

                <ChevronDown size={18} className={`text-slate-400 shrink-0 transition-transform duration-200 ease-in-out ${isExpanded ? 'rotate-180 text-blue-600' : ''}`} />
            </div>
            
            <div className={`grid transition-[grid-template-rows,opacity] duration-[400ms] ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                    <div className="p-4 pt-1 border-t border-slate-100 bg-white space-y-4">
                        <div className="flex items-center gap-1.5 pt-1">
                            <User size={13} className="text-slate-400 shrink-0" />
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                Managed by: <span className="text-slate-800">{doc.assigned_clerk || 'Unassigned'}</span>
                            </p>
                        </div>
                        
                        <div className="p-3.5 rounded-xl border border-slate-200 space-y-2.5 bg-slate-50">
                            <div className="flex items-start gap-2">
                                <MapPin size={15} className="text-slate-400 mt-0.5 shrink-0" />
                                <p className="text-xs sm:text-sm text-slate-900 font-bold leading-snug">
                                    <span className="text-slate-500 text-[10px] block font-bold uppercase tracking-wider mb-0.5">Current Location</span>
                                    {doc.current_location || 'Processing'}
                                </p>
                            </div>
                            <div className="flex items-start gap-2">
                                <Clock size={15} className="text-slate-400 mt-0.5 shrink-0" />
                                <p className="text-xs sm:text-sm text-slate-900 font-bold leading-snug">
                                    <span className="text-slate-500 text-[10px] block font-bold uppercase tracking-wider mb-0.5">Last Update</span>
                                    {formatPHDateTime(doc.updated_at || doc.created_at)}
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex flex-col gap-2 pt-1">
                            <div className="flex gap-2">
                                {doc.attachment_url && (
                                    <button onClick={() => onPreview(doc.attachment_url as string)} className="shrink-0 py-2 px-3 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl flex items-center justify-center transition-all active:scale-95 border-2 border-slate-300 shadow-sm" title="View Attached File">
                                        <Eye size={16} />
                                    </button>
                                )}
                                <button onClick={() => onTrack(doc)} className="flex-1 py-2 px-2 bg-white hover:bg-slate-50 text-slate-800 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 text-xs sm:text-sm border-2 border-slate-300 shadow-sm">
                                    <Clock size={14} /> Track
                                </button>
                                {canReassign && (
                                    <button onClick={() => onReassign(doc)} className="flex-1 py-2 px-2 bg-white hover:bg-slate-50 text-slate-800 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 text-xs sm:text-sm border-2 border-slate-300 shadow-sm">
                                        <UserPlus size={14} /> Re-assign
                                    </button>
                                )}
                            </div>
                            
                            {isManager ? (
                                <button onClick={() => onAction(doc)} className="w-full py-2.5 px-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 text-xs sm:text-sm border-2 border-blue-700 shadow-sm">
                                    Action <ChevronRight size={15} />
                                </button>
                            ) : (
                                <div className="w-full py-2 px-3 bg-slate-100 border border-slate-200 rounded-xl text-center">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pending action by {doc.assigned_clerk}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}