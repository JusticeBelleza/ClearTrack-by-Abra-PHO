import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Search, AlertCircle, MapPin, Eye, Clock, ChevronRight, ArrowLeft, 
  PenTool, X, CheckCircle, ChevronDown, Save, FileText, Camera, 
  Paperclip, ArrowRight, Archive, Activity, CornerUpLeft, Check, User
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { jsPDF } from 'jspdf';

// --- Shared Animation Styles for Modals ---
const modalAnimationStyles = `
    @keyframes customFadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes iosSlideUp { from { transform: translateY(100vh); } to { transform: translateY(0); } }
    @keyframes desktopZoomIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    @keyframes customFadeOut { from { opacity: 1; } to { opacity: 0; } }
    @keyframes iosSlideDown { from { transform: translateY(0); } to { transform: translateY(100vh); } }
    @keyframes desktopZoomOut { from { transform: scale(1); opacity: 1; } to { transform: scale(0.95); opacity: 0; } }
    
    @keyframes staggeredSlideUp {
        0% { opacity: 0; transform: translateY(30px); }
        100% { opacity: 1; transform: translateY(0); }
    }

    .animate-overlay-fade { animation: customFadeIn 0.3s ease-out forwards; }
    .animate-overlay-fade-out { animation: customFadeOut 0.2s ease-in forwards; }
    
    .animate-responsive-modal { animation: iosSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; will-change: transform; }
    .animate-responsive-modal-close { animation: iosSlideDown 0.3s cubic-bezier(0.3, 0, 0.8, 0.15) forwards; will-change: transform; }

    .animate-stagger-1 { animation: staggeredSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; animation-delay: 0.05s; opacity: 0; will-change: transform, opacity; }
    .animate-stagger-2 { animation: staggeredSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; animation-delay: 0.15s; opacity: 0; will-change: transform, opacity; }
    .animate-stagger-3 { animation: staggeredSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; animation-delay: 0.25s; opacity: 0; will-change: transform, opacity; }

    .scrollbar-hide::-webkit-scrollbar { display: none; }
    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
    
    @media (min-width: 640px) {
        .animate-responsive-modal { animation: desktopZoomIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-responsive-modal-close { animation: desktopZoomOut 0.25s cubic-bezier(0.3, 0, 0.8, 0.15) forwards; }
    }
`;

// --- PH Time Formatter ---
const formatPHDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString('en-US', {
        timeZone: 'Asia/Manila',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
};

// --- Custom Dropdown Component ---
function CustomSelect({ options, value, onChange, placeholder }: any) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
  
    useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
  
    return (
      <div className="relative w-full" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full px-4 py-3.5 bg-white border-2 rounded-xl flex justify-between items-center transition-all text-base outline-none active:scale-[0.99] ${
            isOpen
              ? 'border-blue-600 ring-4 ring-blue-600/10'
              : 'border-slate-300 hover:bg-slate-50 hover:border-slate-400'
          } ${!value ? 'text-slate-500' : 'text-slate-900 font-bold'}`}
        >
          <span className="truncate">
            {options.find((opt: any) => (opt.value || opt) === value)?.label || value || placeholder}
          </span>
          <ChevronDown 
            size={20} 
            className={`text-slate-600 transition-transform duration-300 ease-in-out ${isOpen ? 'rotate-180 text-slate-900' : ''}`} 
          />
        </button>
  
        {isOpen && (
          <div className="absolute z-20 w-full mt-2 bg-white border-2 border-slate-300 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="max-h-60 overflow-y-auto p-1.5 space-y-1 scrollbar-hide">
              {options.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-slate-500 text-center italic">Loading...</div>
              ) : (
                  options.map((option: any, idx: number) => {
                    const optValue = option.value || option;
                    const optLabel = option.label || option;
                    const isSelected = optValue === value;
      
                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          onChange(optValue);
                          setIsOpen(false);
                        }}
                        className={`px-4 py-3 text-base rounded-lg cursor-pointer transition-colors flex items-center active:scale-95 ${
                          isSelected
                            ? 'bg-blue-600 text-white font-bold'
                            : 'text-slate-800 hover:bg-slate-100 font-medium'
                        }`}
                      >
                        {optLabel}
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        )}
      </div>
    );
}

// --- Main Processing View ---
export default function Processing() {
  const [documents, setDocuments] = useState<{processing: any[], returned: any[]}>({ processing: [], returned: [] });
  const [departments, setDepartments] = useState<{label: string, value: string}[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'processing' | 'returned'>('processing');
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [trailDoc, setTrailDoc] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // State for handling the main card's file preview
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);

  useEffect(() => {
      fetchData();
  }, []);

  const fetchData = async () => {
      setIsLoading(true);
      try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return;
          const currentUserId = session.user.id;

          const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', currentUserId).single();
          const currentUserName = profile?.full_name || '';

          const [docsRes, deptRes] = await Promise.all([
              supabase.from('documents').select('*'),
              supabase.from('departments').select('name').order('name')
          ]);

          if (docsRes.data) {
              const myActiveDocs = docsRes.data.filter((d: any) => {
                  const isActive = d.status !== 'sealed';
                  const isMine = d.created_by === currentUserId || d.assigned_clerk === currentUserName;
                  return isActive && isMine;
              });

              // SORT LATEST TO OLDEST based on the last time the document was updated/created
              const sortedDocs = myActiveDocs.sort((a: any, b: any) => 
                  new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
              );
              
              const returned = sortedDocs.filter((d: any) => d.status === 'pending' && d.remarks);
              const processing = sortedDocs.filter((d: any) => d.status === 'routing' || (d.status === 'pending' && !d.remarks));
              
              setDocuments({ processing, returned });
          }
          
          if (deptRes.data) setDepartments(deptRes.data.map(d => ({ label: d.name, value: d.name })));
      } catch (err) {
          console.error("Fetch Error:", err);
          toast.error("Failed to load active documents.");
      } finally {
          setIsLoading(false);
      }
  };

  const filteredDocs = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const sourceList = documents[activeTab];

    if (!query) return sourceList;
    
    return sourceList.filter((doc: any) => 
        (doc.title || '').toLowerCase().includes(query) ||
        (doc.reference_no || '').toLowerCase().includes(query) ||
        (doc.current_location || '').toLowerCase().includes(query) ||
        (doc.assigned_clerk || '').toLowerCase().includes(query)
    );
  }, [searchQuery, documents, activeTab]);

  if (isLoading) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[50vh]">
              <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
              <p className="mt-4 text-slate-500 font-bold">Loading Your Documents...</p>
          </div>
      );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500 pb-12">
      <style>{modalAnimationStyles}</style>

      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Active Processing</h2>
          <p className="text-base text-slate-600 mt-1">Manage documents currently assigned to you or created by you.</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 mb-8">
          <div className="relative w-full">
              <Search className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5 sm:w-6 sm:h-6" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Title, ID, Location, or Assigned Name..." 
                className="w-full pl-11 sm:pl-14 pr-11 sm:pr-14 py-3 sm:py-4 rounded-xl border-2 border-slate-300 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 outline-none font-bold text-slate-900 placeholder:text-slate-500 transition-all text-base sm:text-lg shadow-sm" 
              />
              {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 p-1 sm:p-1.5 text-slate-400 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-full transition-all active:scale-90"
                  >
                      <X className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={3} />
                  </button>
              )}
          </div>

          <div className="flex flex-nowrap overflow-x-auto scrollbar-hide gap-2 sm:gap-3 bg-white p-2 rounded-2xl border-2 border-slate-300 shadow-sm w-full mt-2">
              <TabButton 
                label="Active Routing" 
                icon={<Activity size={20} strokeWidth={activeTab === 'processing' ? 3 : 2} />}
                count={documents.processing.length} 
                isActive={activeTab === 'processing'} 
                onClick={() => { setActiveTab('processing'); setSearchQuery(''); }} 
                colorClass="bg-blue-600 text-white"
                badgeClass="bg-blue-500 text-white border-blue-400"
              />
              <TabButton 
                label="Action Needed" 
                icon={<CornerUpLeft size={20} strokeWidth={activeTab === 'returned' ? 3 : 2} />}
                count={documents.returned.length} 
                isActive={activeTab === 'returned'} 
                onClick={() => { setActiveTab('returned'); setSearchQuery(''); }} 
                colorClass="bg-red-600 text-white"
                badgeClass="bg-red-500 text-white border-red-400"
              />
          </div>
      </div>

      <div key={activeTab} className="animate-in fade-in zoom-in-[0.97] duration-300 ease-out fill-mode-both">
          {filteredDocs.length === 0 && (
              <div className="bg-white border-2 border-dashed border-slate-300 rounded-3xl p-10 flex flex-col items-center justify-center text-center">
                  <div className="bg-slate-50 p-4 rounded-full mb-4">
                    {activeTab === 'processing' ? <Search size={36} className="text-slate-400" /> : <AlertCircle size={36} className="text-slate-400" />}
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mb-2">No documents found</h3>
                  <p className="text-base font-medium text-slate-600 max-w-md">
                     You currently have no {activeTab === 'returned' ? 'returned' : 'active'} documents assigned to you.
                  </p>
              </div>
          )}

          {filteredDocs.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredDocs.map((doc: any) => (
                    <div key={doc.id} className={`bg-white rounded-3xl border-2 ${activeTab === 'returned' ? 'border-red-300 shadow-md shadow-red-100 hover:border-red-500' : (doc.is_urgent ? 'border-red-400 shadow-md shadow-red-100 hover:border-red-500' : 'border-slate-300 hover:border-slate-500')} shadow-sm p-5 flex flex-col transition-colors relative overflow-hidden`}>
                        
                        {(doc.is_urgent || activeTab === 'returned') && <div className="absolute top-0 left-0 w-full h-1.5 bg-red-600"></div>}
                        
                        <div className="flex justify-between items-start mb-4 mt-1">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md font-mono border border-slate-200">{doc.reference_no || doc.id}</span>
                                {activeTab === 'returned' ? (
                                     <span className="flex items-center gap-1 text-xs font-black text-red-700 bg-red-50 px-2.5 py-1 rounded-full border-2 border-red-200 uppercase tracking-wider"><AlertCircle size={14} strokeWidth={3}/> Returned</span>
                                ) : (
                                    doc.is_urgent && <span className="flex items-center gap-1 text-xs font-black text-red-700 bg-red-50 px-2.5 py-1 rounded-full border-2 border-red-200 uppercase tracking-wider animate-pulse"><AlertCircle size={14} strokeWidth={3}/> Rush</span>
                                )}
                            </div>
                        </div>
                        
                        <h4 className="font-black text-xl text-slate-900 mb-2 leading-tight">{doc.title || doc.subject}</h4>
                        
                        {/* ASSIGNED EMPLOYEE TAG */}
                        <div className="flex items-center gap-1.5 mb-4 px-0.5">
                            <User size={14} className="text-slate-400" />
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Managed by: <span className="text-blue-600">{doc.assigned_clerk || 'Unassigned'}</span></p>
                        </div>
                        
                        <div className={`p-4 rounded-xl border-2 mb-5 flex-1 space-y-3 ${activeTab === 'returned' ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                            {activeTab === 'returned' ? (
                                <>
                                    <div className="flex items-start gap-3">
                                        <MapPin size={18} className="text-red-600 mt-0.5 shrink-0" />
                                        <p className="text-sm text-slate-900 font-bold leading-snug"><span className="text-red-700/70 text-xs block font-bold uppercase tracking-wider mb-0.5">Returned By</span>{doc.current_location}</p>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <Clock size={18} className="text-red-600 mt-0.5 shrink-0" />
                                        <p className="text-sm text-slate-900 font-bold leading-snug"><span className="text-red-700/70 text-xs block font-bold uppercase tracking-wider mb-0.5">Returned On</span>{formatPHDateTime(doc.updated_at || doc.created_at)}</p>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <AlertCircle size={18} className="text-red-600 mt-0.5 shrink-0" />
                                        <p className="text-sm text-slate-900 font-bold leading-snug"><span className="text-red-700/70 text-xs block font-bold uppercase tracking-wider mb-0.5">Reason</span>{doc.remarks}</p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="flex items-start gap-3">
                                        <MapPin size={18} className="text-slate-500 mt-0.5 shrink-0" />
                                        <p className="text-sm text-slate-900 font-bold leading-snug"><span className="text-slate-500 text-xs block font-bold uppercase tracking-wider mb-0.5">Current Location</span>{doc.current_location || 'Processing'}</p>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <Clock size={18} className="text-slate-500 mt-0.5 shrink-0" />
                                        <p className="text-sm text-slate-900 font-bold leading-snug"><span className="text-slate-500 text-xs block font-bold uppercase tracking-wider mb-0.5">Last Update</span>{formatPHDateTime(doc.updated_at || doc.created_at)}</p>
                                    </div>
                                </>
                            )}
                        </div>
                        
                        <div className="flex gap-2 mt-auto">
                            {doc.attachment_url && (
                                <button 
                                    onClick={() => setPreviewDocUrl(doc.attachment_url)} 
                                    className="shrink-0 py-2.5 px-3 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl flex items-center justify-center transition-all active:scale-95 border-2 border-slate-300"
                                    title="View Attached File"
                                >
                                    <Eye size={18} />
                                </button>
                            )}
                            <button 
                                onClick={() => setTrailDoc(doc)}
                                className="flex-1 py-2.5 px-2 bg-white hover:bg-slate-50 text-slate-800 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 border-2 border-slate-300 text-sm"
                            >
                                <Clock size={16} /> Track
                            </button>
                            <button 
                                onClick={() => setSelectedDoc(doc)}
                                className="flex-[1.5] py-2.5 px-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 text-sm border-2 border-blue-700"
                            >
                                Action <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                ))}
              </div>
          )}
      </div>

      {/* Global Modals for this view */}
      {selectedDoc && <HandoverScreen doc={selectedDoc} departments={departments} onBack={() => setSelectedDoc(null)} onSuccess={fetchData} />}
      {trailDoc && <DigitalTrailModal doc={trailDoc} onBack={() => setTrailDoc(null)} />}
      
      {/* Shared Global File Preview Modal (For the main cards) */}
      {previewDocUrl && <FilePreviewModal url={previewDocUrl} onClose={() => setPreviewDocUrl(null)} />}
    </div>
  );
}

function TabButton({ label, icon, count, isActive, onClick, colorClass, badgeClass }: any) {
    return (
        <button 
            onClick={onClick}
            title={label}
            className={`flex-none shrink-0 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold transition-all active:scale-95 text-sm whitespace-nowrap overflow-hidden border-2 ${
                isActive ? `${colorClass} border-transparent` : 'bg-transparent text-slate-500 border-transparent hover:border-slate-200 hover:bg-slate-50'
            }`}
        >
            {icon}
            {isActive && <span className="animate-in fade-in slide-in-from-left-2 duration-200">{label}</span>}
            <span className={`px-2 py-0.5 rounded-full text-xs border ${isActive ? badgeClass : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
                {count}
            </span>
        </button>
    )
}

// --- TRACKING MODAL ---
export function DigitalTrailModal({ doc, onBack }: any) {
    const [isClosing, setIsClosing] = useState(false);
    const [events, setEvents] = useState<any[]>([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(true);
    
    // State to handle in-app file preview specifically for the tracking modal
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const isCompleted = doc.status === 'sealed';
    const isReturned = doc.status === 'pending' && doc.remarks;
    const headerClass = isCompleted ? 'bg-emerald-700' : isReturned ? 'bg-red-700' : 'bg-slate-900';

    // BULLETPROOF MOBILE CLOSE FUNCTION
    const handleClose = (e?: any) => {
        if (e && e.preventDefault) e.preventDefault(); // Stop iOS double-trigger
        if (isClosing) return; // Prevent spam clicks
        
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
            
            if (data && !error) {
                setEvents(data);
            }
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
                        {/* FIXED DOUBLE TAP: Uses onTouchEnd bypass */}
                        <button 
                            onClick={handleClose} 
                            onTouchEnd={handleClose}
                            className="p-2 -mr-2 bg-white/10 md:hover:bg-white/20 active:bg-white/30 rounded-full transition-colors"
                        >
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
                            // Enforce PH Time formatting
                            const dateStr = dateObj.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' });
                            const timeStr = dateObj.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });

                            let icon = <div className="w-2 h-2 bg-slate-400 rounded-full"></div>;
                            let nodeBg = 'bg-slate-200';
                            let titleColor = 'text-slate-900';

                            if (log.action === 'Delivered') {
                                icon = <Check size={14} strokeWidth={4} className="text-white" />;
                                nodeBg = 'bg-emerald-500';
                                titleColor = 'text-emerald-700';
                            } else if (log.action === 'Returned') {
                                icon = <X size={14} strokeWidth={4} className="text-white" />;
                                nodeBg = 'bg-red-500';
                                titleColor = 'text-red-700';
                            } else if (log.action === 'In transit') {
                                icon = <ArrowRight size={14} strokeWidth={3} className="text-white" />;
                                nodeBg = 'bg-blue-500';
                                titleColor = 'text-blue-700';
                            } else if (log.action === 'Document Logged') {
                                icon = <Check size={14} strokeWidth={4} className="text-white" />;
                                nodeBg = 'bg-slate-700';
                                titleColor = 'text-slate-800';
                            }

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
                            if (log.action === 'Delivered') {
                                desc = `Secured At: ${log.location}`;
                                if (log.remarks) desc += `\n${log.remarks}`; 
                            }

                            return (
                                <div key={index} className="flex gap-4 relative w-full">
                                    <div className="w-14 shrink-0 flex flex-col text-right pt-0.5">
                                        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">{dateStr}</span>
                                        <span className="text-[10px] font-medium text-slate-400 mt-0.5">{timeStr}</span>
                                    </div>

                                    <div className="relative flex flex-col items-center">
                                        {index !== events.length - 1 && (
                                            <div className="absolute top-5 bottom-[-1.5rem] w-[2px] bg-slate-200"></div>
                                        )}
                                        <div className={`relative z-10 w-[22px] h-[22px] mt-0.5 rounded-full flex items-center justify-center ${nodeBg}`}>
                                            {icon}
                                        </div>
                                    </div>

                                    <div className="flex-1 pb-10">
                                        <h4 className={`text-sm font-bold leading-none mb-1.5 ${titleColor}`}>{log.action}</h4>
                                        <div className="text-sm text-slate-600 leading-relaxed pr-2">
                                            {formatDescription(desc)}
                                        </div>
                                        
                                        {/* IN-APP PREVIEW BUTTON */}
                                        {log.attachment_url && (
                                            <div className="mt-3">
                                                <button 
                                                    onClick={() => setPreviewUrl(log.attachment_url)}
                                                    className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-lg border border-blue-200 transition-colors active:scale-95 shadow-sm"
                                                >
                                                    <FileText size={16} strokeWidth={2.5} />
                                                    Click to view file
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
        
        {/* Render the preview modal ON TOP of the tracking modal if a file is clicked */}
        {previewUrl && <FilePreviewModal url={previewUrl} onClose={() => setPreviewUrl(null)} />}
        </>
    );
}

// --- SHARED FILE PREVIEW OVERLAY ---
export function FilePreviewModal({ url, onClose }: { url: string, onClose: () => void }) {
    const [isClosing, setIsClosing] = useState(false);
    const [showContent, setShowContent] = useState(true);
    const isImage = url.toLowerCase().match(/\.(jpeg|jpg|gif|png|webp)$/i) !== null;

    // BULLETPROOF MOBILE CLOSE FUNCTION
    const handleClose = (e?: any) => {
        if (e && e.preventDefault) e.preventDefault(); // Stop iOS double-trigger
        if (isClosing) return; // Prevent spam clicks
        
        setShowContent(false); // Kill iframe instantly to drop focus
        setIsClosing(true);
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        
        setTimeout(() => { onClose(); }, 300); 
    };

    return (
        <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/80 backdrop-blur-sm ${isClosing ? 'animate-overlay-fade-out pointer-events-none' : 'animate-overlay-fade'}`}>
            <div className={`bg-white w-full max-w-4xl h-[85vh] sm:h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden ${isClosing ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
                
                {/* Header */}
                <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0">
                    <h3 className="font-bold flex items-center gap-2"><FileText size={20} /> Document Preview</h3>
                    {/* FIXED DOUBLE TAP: Uses onTouchEnd bypass */}
                    <button 
                        onClick={handleClose} 
                        onTouchEnd={handleClose}
                        className="p-1.5 bg-white/10 md:hover:bg-white/20 active:bg-white/30 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
                
                {/* Scrollable Body - Fixed for Mobile Devices */}
                <div 
                    className="flex-1 bg-slate-100 w-full h-full overflow-y-auto" 
                    style={{ WebkitOverflowScrolling: 'touch' }} 
                >
                    {showContent && (
                        isImage ? (
                            <div className="w-full h-full p-4 flex items-center justify-center">
                                <img src={url} alt="Document Preview" className="max-w-full h-auto object-contain rounded-lg shadow-sm" />
                            </div>
                        ) : (
                            <iframe 
                                src={url} 
                                className="w-full h-full min-h-[120vh] sm:min-h-full border-none bg-slate-100" 
                                title="Document Preview" 
                            />
                        )
                    )}
                </div>
                
            </div>
        </div>
    );
}

// --- ACTION MENU MODAL ---
function HandoverScreen({ doc, departments, onBack, onSuccess }: any) {
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

    // BULLETPROOF MOBILE CLOSE FUNCTION
    const handleClose = (e?: any) => {
        if (e && e.preventDefault) e.preventDefault(); 
        if (isClosing) return; 
        
        setIsClosing(true);
        setTimeout(() => { onBack(); }, 400); 
    };
    
    const handleBackBtn = (e?: any) => {
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
        
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        const getCoordinates = (e: MouseEvent | TouchEvent) => {
            const rect = canvas.getBoundingClientRect();
            if (e.type.includes('touch')) {
                const touch = (e as TouchEvent).touches[0];
                return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
            }
            const mouse = e as MouseEvent;
            return { x: mouse.clientX - rect.left, y: mouse.clientY - rect.top };
        };

        const startDrawing = (e: MouseEvent | TouchEvent) => {
            e.preventDefault(); 
            setIsDrawing(true);
            const { x, y } = getCoordinates(e);
            ctx.beginPath();
            ctx.moveTo(x, y);
        };

        const draw = (e: MouseEvent | TouchEvent) => {
            if (!isDrawing) return;
            e.preventDefault();
            const { x, y } = getCoordinates(e);
            ctx.lineTo(x, y);
            ctx.stroke();
        };

        const stopDrawing = () => {
            setIsDrawing(false);
            ctx.closePath();
        };

        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseout', stopDrawing);
        canvas.addEventListener('touchstart', startDrawing, { passive: false });
        canvas.addEventListener('touchmove', draw, { passive: false });
        canvas.addEventListener('touchend', stopDrawing);

        return () => {
            canvas.removeEventListener('mousedown', startDrawing);
            canvas.removeEventListener('mousemove', draw);
            canvas.removeEventListener('mouseup', stopDrawing);
            canvas.removeEventListener('mouseout', stopDrawing);
            canvas.removeEventListener('touchstart', startDrawing);
            canvas.removeEventListener('touchmove', draw);
            canvas.removeEventListener('touchend', stopDrawing);
        };
    }, [activeAction, isDrawing]); 

    const clearSignature = () => {
        const canvas = canvasRef.current;
        if(canvas) {
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsProcessingFile(true);
        setAttachmentName("Processing file...");

        try {
            if (file.type === 'application/pdf') {
                setAttachment(file);
                setAttachmentName(file.name);
            } else if (file.type.startsWith('image/')) {
                const pdfBlob = await processImageToScannedPDF(file);
                setAttachment(pdfBlob);
                setAttachmentName(`Final_Signed_${doc.reference_no}.pdf`);
            } else {
                toast.error("Unsupported file type.");
                setAttachmentName("");
            }
        } catch (err) {
            toast.error("Failed to process the document.");
            setAttachmentName("");
        } finally {
            setIsProcessingFile(false);
        }
    };

    const processImageToScannedPDF = (file: File): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return reject("Canvas error");
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.filter = 'grayscale(100%) contrast(150%) brightness(110%)';
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    const processedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                    const pdf = new jsPDF({ orientation: img.width > img.height ? 'landscape' : 'portrait', unit: 'px', format: [img.width, img.height] });
                    pdf.addImage(processedDataUrl, 'JPEG', 0, 0, img.width, img.height);
                    resolve(pdf.output('blob'));
                };
                img.onerror = reject;
                img.src = event.target?.result as string;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const handleSaveRouting = async () => {
        if (!destination || !receivingClerk.trim()) {
            toast.error("Validation Error", { description: "Please provide a destination and receiving clerk." });
            return;
        }
        setIsSubmitting(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();

            // 1. Leave the footprint in the logs FIRST
            const { error: logError } = await supabase.from('document_logs').insert([{
                document_id: doc.id,
                action: 'In transit',
                location: destination,
                assigned_to: receivingClerk.trim(),
                created_by: session?.user?.id || null
            }]);
            if (logError) throw logError;

            // 2. NOW update the document safely
            const { error } = await supabase.from('documents').update({
                current_location: destination,
                status: 'routing', 
                remarks: null 
            }).eq('id', doc.id);
            if (error) throw error;

            toast.success("Document Routed Successfully!", { description: `Forwarded to ${destination}.`});
            onSuccess();
            handleClose();
        } catch (e: any) {
            toast.error("Failed to route document", { description: e.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const confirmComplete = async () => {
        if (!releasedBy.trim()) { toast.error("Validation Error", { description: "Please specify who released the document." }); return; }
        if (!retentionFate) { toast.error("Validation Error", { description: "Please select where the document will be retained." }); return; }

        setIsSubmitting(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            let attachmentUrl = null;

            if (attachment) {
                const fileExt = 'pdf';
                const fileName = `completed-${doc.reference_no}-${Math.random()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage.from('attachments').upload(fileName, attachment, { contentType: 'application/pdf' });
                if (uploadError) throw uploadError;
                const { data } = supabase.storage.from('attachments').getPublicUrl(fileName);
                attachmentUrl = data.publicUrl;
            }

            const updateData: any = { 
                status: 'sealed',
                remarks: completionRemarks.trim() || null 
            };
            if (attachmentUrl) { updateData.completed_attachment_url = attachmentUrl; }

            const fateString = retentionFate === 'originator' ? 'Returned to Originator' : 'Retained at Final Destination';
            const detailedRemarks = `Released By: ${releasedBy.trim()}\nDocument Retention: ${fateString}${completionRemarks ? `\nRemarks: ${completionRemarks.trim()}` : ''}`;

            // 1. Leave the footprint in the logs FIRST
            const { error: logError } = await supabase.from('document_logs').insert([{
                document_id: doc.id,
                action: 'Delivered',
                location: doc.final_destination || doc.current_location,
                remarks: detailedRemarks,
                attachment_url: attachmentUrl,
                created_by: session?.user?.id || null
            }]);
            if (logError) throw logError;

            // 2. NOW update the document safely
            const { error } = await supabase.from('documents').update(updateData).eq('id', doc.id);
            if (error) throw error;

            toast.success("Document Completed!", { description: "It has been moved to history." });
            onSuccess();
            handleClose();
        } catch (e: any) {
            toast.error("Failed to complete document");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReject = async () => {
        if (!rejectOffice || !rejectReason.trim()) {
            toast.error("Validation Error", { description: "Please provide the returning office and reason." });
            return;
        }
        setIsSubmitting(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();

            // 1. Leave the footprint in the logs FIRST
            const { error: logError } = await supabase.from('document_logs').insert([{
                document_id: doc.id,
                action: 'Returned',
                location: rejectOffice,
                remarks: rejectReason.trim(),
                created_by: session?.user?.id || null
            }]);
            if (logError) throw logError;

            // 2. NOW update the document safely
            const { error } = await supabase.from('documents').update({
                status: 'pending', 
                current_location: rejectOffice,
                remarks: rejectReason.trim()
            }).eq('id', doc.id);
            if (error) throw error;

            toast.success("Document Returned");
            onSuccess();
            handleClose();
        } catch (e: any) {
            toast.error("Failed to reject document");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm ${isClosing ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
            
            <div className={`bg-white w-full max-w-2xl max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden shadow-2xl rounded-t-2xl sm:rounded-3xl ${isClosing ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
                
                <div className={`text-white relative flex flex-col shrink-0 transition-colors duration-300 ${activeAction === 'reject' ? 'bg-red-700' : activeAction === 'complete' ? 'bg-emerald-700' : 'bg-slate-900'}`}>
                    <div className="w-16 h-1.5 bg-white/30 rounded-full mx-auto mt-3 sm:hidden shrink-0"></div>
                    <div className="p-5 pt-3 sm:pt-6 flex items-center justify-between">
                        {activeAction ? (
                             <button onClick={handleBackBtn} onTouchEnd={handleBackBtn} disabled={isSubmitting} className="p-2 -ml-2 bg-white/10 md:hover:bg-white/20 active:bg-white/30 rounded-full transition-colors disabled:opacity-50">
                                 <ArrowLeft size={24} />
                             </button>
                        ) : (
                            <div className="w-10"></div>
                        )}
                        <h3 className="font-black text-xl">
                            {!activeAction ? 'Action Required' : activeAction === 'reject' ? 'Reject & Return' : activeAction === 'complete' ? 'Finalize Document' : 'Route Document'}
                        </h3>
                        {/* FIXED DOUBLE TAP: Uses onTouchEnd bypass */}
                        <button onClick={handleClose} onTouchEnd={handleClose} disabled={isSubmitting} className="p-2 -mr-2 bg-white/10 md:hover:bg-white/20 active:bg-white/30 rounded-full transition-colors disabled:opacity-50">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6 scrollbar-hide bg-slate-50">
                    
                    <div className="bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-sm relative z-20">
                        <p className="text-sm font-bold text-slate-500 mb-2 font-mono">{doc.reference_no}</p>
                        <p className="font-black text-xl text-slate-900 leading-tight flex items-start gap-2">
                            {doc.is_urgent && <AlertCircle size={24} className="text-red-600 shrink-0 mt-0.5" />}
                            {doc.title}
                        </p>
                    </div>

                    {!activeAction ? (
                        <div className="flex flex-col gap-4 pt-2">
                            <button 
                                onClick={() => setActiveAction('route')}
                                className="animate-stagger-1 bg-white border-2 border-blue-200 hover:border-blue-400 p-5 rounded-2xl flex items-center gap-4 text-left transition-all hover:shadow-md active:scale-[0.98] group"
                            >
                                <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                    <MapPin size={28} />
                                </div>
                                <div>
                                    <h4 className="font-black text-xl text-slate-900 mb-0.5">Add Step</h4>
                                    <p className="text-sm font-medium text-slate-500">Route this document to its next destination.</p>
                                </div>
                            </button>

                            <button 
                                onClick={() => setActiveAction('complete')}
                                className="animate-stagger-2 bg-white border-2 border-emerald-200 hover:border-emerald-400 p-5 rounded-2xl flex items-center gap-4 text-left transition-all hover:shadow-md active:scale-[0.98] group"
                            >
                                <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                    <CheckCircle size={28} />
                                </div>
                                <div>
                                    <h4 className="font-black text-xl text-slate-900 mb-0.5">Complete Document</h4>
                                    <p className="text-sm font-medium text-slate-500">Finalize, log remarks, and secure the record.</p>
                                </div>
                            </button>

                            <button 
                                onClick={() => setActiveAction('reject')}
                                className="animate-stagger-3 bg-white border-2 border-red-200 hover:border-red-400 p-5 rounded-2xl flex items-center gap-4 text-left transition-all hover:shadow-md active:scale-[0.98] group"
                            >
                                <div className="w-14 h-14 bg-red-50 text-red-600 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                    <AlertCircle size={28} />
                                </div>
                                <div>
                                    <h4 className="font-black text-xl text-slate-900 mb-0.5">Return / Reject</h4>
                                    <p className="text-sm font-medium text-slate-500">Bounce this document back to a previous office.</p>
                                </div>
                            </button>
                        </div>
                    ) : null}

                    {activeAction === 'route' && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                            <div>
                                <label className="block text-base font-bold text-slate-900 mb-2">Next Destination Office *</label>
                                <CustomSelect options={departments} value={destination} onChange={setDestination} placeholder="Select receiving office..." />
                            </div>

                            <div>
                                <label className="block text-base font-bold text-slate-900 mb-2">Receiving Clerk *</label>
                                <input 
                                    type="text" 
                                    value={receivingClerk}
                                    onChange={(e) => setReceivingClerk(e.target.value)}
                                    placeholder="Enter name of receiving clerk..." 
                                    className="w-full p-3.5 bg-white border-2 border-slate-300 focus:border-blue-600 rounded-xl outline-none font-bold text-slate-900 text-base transition-colors" 
                                />
                            </div>

                            <div>
                                <div className="flex justify-between items-end mb-2">
                                    <label className="block text-base font-bold text-slate-900 flex items-center gap-2"><PenTool size={20}/> Signature *</label>
                                    <button onClick={clearSignature} type="button" className="text-sm text-slate-600 font-bold hover:text-slate-900 transition-colors bg-white px-3 py-1.5 rounded-lg border-2 border-slate-300 active:scale-95">Clear Pad</button>
                                </div>
                                <div className="border-4 border-slate-300 rounded-2xl bg-white overflow-hidden touch-none relative">
                                    <div className="absolute top-1/2 left-4 right-4 h-0 border-b-2 border-dashed border-slate-300 pointer-events-none"></div>
                                    <canvas ref={canvasRef} width={600} height={200} className="w-full h-[200px] cursor-crosshair bg-transparent relative z-10" style={{ touchAction: 'none' }} />
                                </div>
                                <p className="text-center text-sm text-slate-500 mt-3 font-bold">Sign clearly within the box above</p>
                            </div>
                        </div>
                    )}

                    {activeAction === 'complete' && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                            
                            <div>
                                <label className="block text-sm font-bold text-slate-900 mb-1.5">Scanned Signed Copy (Optional)</label>
                                <div className="flex items-center gap-3">
                                    <label className={`hidden sm:flex flex-1 items-center justify-center gap-2 p-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${attachment ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                                        <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} disabled={isProcessingFile} />
                                        {isProcessingFile ? <span className="animate-pulse font-bold">Processing PDF...</span> : attachment ? <><CheckCircle size={18}/> <span className="font-bold truncate max-w-[200px]">{attachmentName}</span></> : <><Paperclip size={18}/> <span className="font-bold">Attach Final PDF</span></>}
                                    </label>

                                    <label className={`flex sm:hidden flex-1 items-center justify-center gap-2 p-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors active:scale-95 ${attachment ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} disabled={isProcessingFile} />
                                        {isProcessingFile ? <span className="animate-pulse font-bold">Processing PDF...</span> : attachment ? <><CheckCircle size={18}/> <span className="font-bold truncate max-w-[150px]">{attachmentName}</span></> : <><Camera size={18}/> <span className="font-bold">Scan Signed Document</span></>}
                                    </label>

                                    {attachment && !isProcessingFile && (
                                        <button type="button" onClick={() => { setAttachment(null); setAttachmentName(''); }} className="p-4 bg-red-50 text-red-600 rounded-xl border-2 border-red-200 hover:bg-red-100 active:scale-95 transition-all">
                                            <X size={18} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-base font-bold text-slate-900 mb-2">Released By *</label>
                                <input 
                                    type="text" 
                                    value={releasedBy}
                                    onChange={(e) => setReleasedBy(e.target.value)}
                                    placeholder="Name of official releasing the document..." 
                                    className="w-full p-3.5 bg-white border-2 border-slate-300 focus:border-emerald-600 rounded-xl outline-none font-bold text-slate-900 text-base transition-colors" 
                                />
                            </div>

                            <div>
                                <label className="block text-base font-bold text-slate-900 mb-2">Document Retention *</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div 
                                        onClick={() => setRetentionFate('originator')}
                                        className={`p-4 border-2 rounded-xl cursor-pointer transition-all active:scale-[0.98] ${retentionFate === 'originator' ? 'bg-emerald-50 border-emerald-500' : 'bg-white border-slate-300 hover:border-slate-400'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${retentionFate === 'originator' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-400 bg-white'}`}>
                                                {retentionFate === 'originator' && <div className="w-2 h-2 bg-white rounded-full"></div>}
                                            </div>
                                            <div>
                                                <p className={`font-bold text-base ${retentionFate === 'originator' ? 'text-emerald-900' : 'text-slate-700'}`}>Return to Originator</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div 
                                        onClick={() => setRetentionFate('destination')}
                                        className={`p-4 border-2 rounded-xl cursor-pointer transition-all active:scale-[0.98] ${retentionFate === 'destination' ? 'bg-emerald-50 border-emerald-500' : 'bg-white border-slate-300 hover:border-slate-400'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${retentionFate === 'destination' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-400 bg-white'}`}>
                                                {retentionFate === 'destination' && <div className="w-2 h-2 bg-white rounded-full"></div>}
                                            </div>
                                            <div>
                                                <p className={`font-bold text-base ${retentionFate === 'destination' ? 'text-emerald-900' : 'text-slate-700'}`}>Retain at Office</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-base font-bold text-slate-900 mb-2">Completion Remarks (Optional)</label>
                                <textarea 
                                    value={completionRemarks}
                                    onChange={(e) => setCompletionRemarks(e.target.value)}
                                    placeholder="Add final notes or context for the archive..." 
                                    className="w-full p-3.5 bg-white border-2 border-slate-300 focus:border-emerald-600 rounded-xl outline-none font-bold text-slate-900 text-base min-h-[100px] resize-y transition-colors" 
                                ></textarea>
                            </div>
                        </div>
                    )}

                    {activeAction === 'reject' && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                            <div>
                                <label className="block text-base font-bold text-slate-900 mb-2">Returning To Office *</label>
                                <CustomSelect options={departments} value={rejectOffice} onChange={setRejectOffice} placeholder="Select office..." />
                            </div>

                            <div>
                                <label className="block text-base font-bold text-slate-900 mb-2">Reason for Rejection *</label>
                                <textarea 
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    placeholder="E.g., Missing signature, incorrect attachments..." 
                                    className="w-full p-3.5 bg-white border-2 border-slate-300 focus:border-red-600 rounded-xl outline-none font-bold text-slate-900 text-base min-h-[140px] resize-y transition-colors" 
                                ></textarea>
                            </div>
                        </div>
                    )}
                </div>

                {activeAction && (
                    <div className="bg-white p-4 sm:p-6 pb-8 sm:pb-6 border-t-2 border-slate-200 flex shrink-0">
                        {activeAction === 'route' && (
                            <button onClick={handleSaveRouting} disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-95 text-base flex justify-center items-center gap-2 border-2 border-blue-700 disabled:opacity-50">
                                {isSubmitting ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <><MapPin size={24} strokeWidth={2.5} /> Confirm Add Step</>}
                            </button>
                        )}
                        {activeAction === 'complete' && (
                            <button onClick={confirmComplete} disabled={isSubmitting || isProcessingFile} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-95 text-base flex items-center justify-center gap-2 border-2 border-emerald-700 disabled:opacity-50">
                                {isSubmitting ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <><CheckCircle size={24} strokeWidth={3} /> Finalize Document</>}
                            </button>
                        )}
                        {activeAction === 'reject' && (
                            <button onClick={handleReject} disabled={isSubmitting} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-95 text-base flex items-center justify-center gap-2 border-2 border-red-700 disabled:opacity-50">
                                {isSubmitting ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <><AlertCircle size={24} strokeWidth={3} /> Confirm Return</>}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}