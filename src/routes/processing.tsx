import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
    Search, AlertCircle, MapPin, Eye, Clock, ChevronRight, X, Activity, CornerUpLeft, User, MessageSquareWarning, CheckCircle, UserPlus, ChevronDown, Camera, Paperclip, UploadCloud, Ban
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { formatPHDateTime } from '../lib/utils';
import { jsPDF } from 'jspdf';
import HandoverScreen from '../components/system/HandoverScreen';
import DigitalTrailModal from '../components/system/DigitalTrailModal';
import FilePreviewModal from '../components/system/FilePreviewModal';

// --- Shared Animation Styles ---
const modalAnimationStyles = `
    @keyframes customFadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes iosSlideUp { from { transform: translateY(100vh); } to { transform: translateY(0); } }
    @keyframes desktopZoomIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    @keyframes customFadeOut { from { opacity: 1; } to { opacity: 0; } }
    @keyframes iosSlideDown { from { transform: translateY(0); } to { transform: translateY(100vh); } }
    @keyframes desktopZoomOut { from { transform: scale(1); opacity: 1; } to { transform: scale(0.95); opacity: 0; } }
    
    .animate-overlay-fade { animation: customFadeIn 0.15s ease-out forwards; }
    .animate-overlay-fade-out { animation: customFadeOut 0.15s ease-in forwards; }
    
    .animate-responsive-modal { animation: iosSlideUp 0.25s cubic-bezier(0.25, 1, 0.3, 1) forwards; will-change: transform; }
    .animate-responsive-modal-close { animation: iosSlideDown 0.2s cubic-bezier(0.3, 0, 0.8, 0.15) forwards; will-change: transform; }

    .scrollbar-hide::-webkit-scrollbar { display: none; }
    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
    
    @media (min-width: 640px) {
        .animate-responsive-modal { animation: desktopZoomIn 0.2s cubic-bezier(0.25, 1, 0.3, 1) forwards; }
        .animate-responsive-modal-close { animation: desktopZoomOut 0.15s cubic-bezier(0.3, 0, 0.8, 0.15) forwards; }
    }
`;

// --- TypeScript Interfaces ---
interface DocumentItem {
    id: string;
    reference_no?: string;
    title?: string;
    subject?: string;
    status: string;
    assigned_clerk?: string;
    created_by?: string;
    remarks?: string;
    is_urgent?: boolean;
    current_location?: string;
    final_destination?: string;
    attachment_url?: string;
    created_at: string;
    updated_at?: string;
}

interface DepartmentOption {
    label: string;
    value: string;
}

interface ProcessingData {
    processing: DocumentItem[];
    returned: DocumentItem[];
    departments: DepartmentOption[];
    currentUserName: string;
    currentUserId: string;
    colleagues: string[];
}

interface TabButtonProps {
    label: string;
    icon: React.ReactNode;
    count: number;
    isActive: boolean;
    onClick: () => void;
    colorClass: string;
    badgeClass: string;
    newCount?: number; 
}

interface SelectOption { 
    label: string; 
    value: string; 
}
type OptionType = SelectOption | string;

interface CustomSelectProps {
    options: OptionType[];
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
}

// --- DATA FETCHING FUNCTION FOR REACT QUERY ---
const fetchProcessingData = async (): Promise<ProcessingData> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("No authenticated session");

    const currentUserId = session.user.id;
    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', currentUserId).single();
    const currentUserName = profile?.full_name || '';

    let colleagues: string[] = [];
    
    if (currentUserName) {
        const { data: empData } = await supabase.from('employees').select('department').eq('name', currentUserName).single();
        if (empData?.department) {
            const { data: deptEmps } = await supabase
                .from('employees')
                .select('name')
                .eq('department', empData.department);
            
            if (deptEmps) {
                colleagues = deptEmps.map(e => e.name);
            }
        }
    }

    const [docsRes, deptRes] = await Promise.all([
        supabase.from('documents').select('*').neq('status', 'sealed').neq('status', 'cancelled'),
        supabase.from('departments').select('name').order('name')
    ]);

    let processing: DocumentItem[] = [];
    let returned: DocumentItem[] = [];
    let departments: DepartmentOption[] = [];

    if (docsRes.data) {
        const myActiveDocs = (docsRes.data as DocumentItem[]).filter((d) => {
            if (d.status === 'cancelled') return false;
            return d.created_by === currentUserId || d.assigned_clerk === currentUserName;
        });

        const sortedDocs = myActiveDocs.sort((a, b) => 
            new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
        );
        
        returned = sortedDocs.filter((d) => d.status === 'pending' && d.remarks);
        processing = sortedDocs.filter((d) => d.status === 'routing' || (d.status === 'pending' && !d.remarks));
    }
    
    if (deptRes.data) {
        departments = deptRes.data.map(d => ({ label: d.name, value: d.name }));
    }

    return { processing, returned, departments, currentUserName, currentUserId, colleagues };
};

export default function Processing() {
  const [activeTab, setActiveTab] = useState<'processing' | 'returned'>('processing');
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [trailDoc, setTrailDoc] = useState<DocumentItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);
  
  // Re-assign Modal States
  const [reassignDoc, setReassignDoc] = useState<DocumentItem | null>(null);
  const [selectedColleague, setSelectedColleague] = useState<string>('');
  const [isReassigning, setIsReassigning] = useState(false);
  const [isClosingReassign, setIsClosingReassign] = useState(false);

  // Revise & Cancel Modal States
  const [reviseDoc, setReviseDoc] = useState<DocumentItem | null>(null);
  const [cancelDoc, setCancelDoc] = useState<DocumentItem | null>(null);

  // --- SMART NOTIFICATION TRACKING ---
  const [lastViewedProcessing, setLastViewedProcessing] = useState(() => localStorage.getItem('filetrackr_viewed_processing') || '0');
  const [lastViewedReturned, setLastViewedReturned] = useState(() => localStorage.getItem('filetrackr_viewed_returned') || '0');

  const { data, isLoading, refetch } = useQuery<ProcessingData>({
      queryKey: ['processingDocuments'],
      queryFn: fetchProcessingData,
      refetchInterval: 15000, 
  });

  const documents = useMemo(() => {
      return data ? { processing: data.processing, returned: data.returned } : { processing: [], returned: [] };
  }, [data]);
  
  const departments = data?.departments || [];

  const filteredDocs = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const sourceList = documents[activeTab];

    if (!query) return sourceList;
    
    return sourceList.filter((doc: DocumentItem) => 
        (doc.title || '').toLowerCase().includes(query) ||
        (doc.reference_no || '').toLowerCase().includes(query) ||
        (doc.current_location || '').toLowerCase().includes(query) ||
        (doc.assigned_clerk || '').toLowerCase().includes(query)
    );
  }, [searchQuery, documents, activeTab]);

  const availableColleagues = useMemo(() => {
      if (!data || !reassignDoc) return [];
      return data.colleagues.filter((name) => name !== reassignDoc.assigned_clerk);
  }, [data, reassignDoc]);

  // --- NOTIFICATION CALCULATIONS ---
  const newProcessingCount = useMemo(() => {
      if (!documents.processing.length) return 0;
      return documents.processing.filter(d => new Date(d.updated_at || d.created_at).getTime() > Number(lastViewedProcessing)).length;
  }, [documents.processing, lastViewedProcessing]);

  const newReturnedCount = useMemo(() => {
      if (!documents.returned.length) return 0;
      return documents.returned.filter(d => new Date(d.updated_at || d.created_at).getTime() > Number(lastViewedReturned)).length;
  }, [documents.returned, lastViewedReturned]);

  // Automatically mark the active tab as "viewed"
  useEffect(() => {
      if (activeTab === 'processing' && documents.processing.length > 0) {
          const newest = Math.max(...documents.processing.map(d => new Date(d.updated_at || d.created_at).getTime()));
          if (newest > Number(lastViewedProcessing)) {
              localStorage.setItem('filetrackr_viewed_processing', newest.toString());
              setLastViewedProcessing(newest.toString());
          }
      }
      if (activeTab === 'returned' && documents.returned.length > 0) {
          const newest = Math.max(...documents.returned.map(d => new Date(d.updated_at || d.created_at).getTime()));
          if (newest > Number(lastViewedReturned)) {
              localStorage.setItem('filetrackr_viewed_returned', newest.toString());
              setLastViewedReturned(newest.toString());
          }
      }
  }, [activeTab, documents.processing, documents.returned, lastViewedProcessing, lastViewedReturned]);

  // --- HANDLERS ---
  const closeReassignModal = () => {
      setIsClosingReassign(true);
      setTimeout(() => {
          setReassignDoc(null);
          setSelectedColleague('');
          setIsClosingReassign(false);
      }, 250);
  };

  const handleReassignConfirm = async () => {
      if (!reassignDoc || !selectedColleague) return;
      setIsReassigning(true);
      
      try {
          const previousClerk = reassignDoc.assigned_clerk || 'Unassigned';
          const nowIso = new Date().toISOString();

          const { error: trailError } = await supabase
              .from('document_logs')
              .insert([{
                  document_id: reassignDoc.id,
                  action: 'REASSIGNED',
                  remarks: `Re-assigned from ${previousClerk} to ${selectedColleague} by ${data?.currentUserName || 'System User'}`,
                  location: reassignDoc.current_location || 'Processing'
              }]);

          if (trailError) console.warn("Failed to write re-assignment trail log:", trailError.message);

          const { error: updateError } = await supabase
              .from('documents')
              .update({ 
                  assigned_clerk: selectedColleague,
                  updated_at: nowIso 
              })
              .eq('id', reassignDoc.id);
          
          if (updateError) throw updateError;
          
          toast.success(`Document re-assigned to ${selectedColleague}`);
          closeReassignModal();
          refetch();
      } catch (error) {
          console.error("Re-assign Error:", error);
          toast.error("Failed to re-assign document. Please try again.");
      } finally {
          setIsReassigning(false);
      }
  };

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
              <Search className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 sm:w-6 sm:h-6" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Title, ID, Location, or Assigned Name..." 
                className="w-full pl-11 sm:pl-14 pr-11 sm:pr-14 py-3 sm:py-4 rounded-xl border-2 border-slate-300 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 outline-none font-bold text-slate-900 placeholder:text-slate-400 transition-all text-base sm:text-lg shadow-sm bg-slate-50" 
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

          <div className="flex flex-nowrap overflow-x-auto scrollbar-hide gap-2 sm:gap-3 w-full">
              <TabButton 
                label="Active Routing" 
                icon={<Activity size={20} strokeWidth={activeTab === 'processing' ? 3 : 2} />}
                count={documents.processing.length} 
                newCount={newProcessingCount}
                isActive={activeTab === 'processing'} 
                onClick={() => { setActiveTab('processing'); setSearchQuery(''); }} 
                colorClass="bg-blue-600 text-white"
                badgeClass="bg-blue-500 text-white border-blue-400"
              />
              <TabButton 
                label="Action Needed" 
                icon={<CornerUpLeft size={20} strokeWidth={activeTab === 'returned' ? 3 : 2} />}
                count={documents.returned.length} 
                newCount={newReturnedCount}
                isActive={activeTab === 'returned'} 
                onClick={() => { setActiveTab('returned'); setSearchQuery(''); }} 
                colorClass="bg-amber-600 text-white"
                badgeClass="bg-amber-500 text-white border-amber-400"
              />
          </div>
      </div>

      <div key={activeTab} className="animate-in fade-in zoom-in-[0.97] duration-300 ease-out fill-mode-both">
          {filteredDocs.length === 0 && (
              <div className="bg-slate-50 border-2 border-slate-200 rounded-3xl p-10 flex flex-col items-center justify-center text-center">
                  <div className="bg-white p-4 border-2 border-slate-100 rounded-full mb-4 shadow-sm">
                    {activeTab === 'processing' ? <Search size={36} className="text-slate-400" /> : <CheckCircle size={36} className="text-emerald-500" />}
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mb-2">
                      {activeTab === 'processing' ? 'No documents found' : 'Inbox Zero!'}
                  </h3>
                  <p className="text-base font-medium text-slate-500 max-w-md">
                       {activeTab === 'processing' 
                        ? 'You currently have no active documents assigned to you.' 
                        : 'You have no returned documents requiring your attention. Great job!'}
                  </p>
              </div>
          )}

          {filteredDocs.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredDocs.map((doc: DocumentItem) => {
                    const isManager = doc.assigned_clerk === data?.currentUserName;
                    const isCreator = doc.created_by === data?.currentUserId;
                    const canReassign = isManager || isCreator;
                    const canRevise = isManager || isCreator;

                    return activeTab === 'returned' ? (
                        // ==========================================
                        // "ACTION NEEDED" CARD DESIGN 
                        // ==========================================
                        <div key={doc.id} className="bg-white rounded-[1.5rem] border-2 border-amber-300 shadow-sm shadow-amber-100 hover:border-amber-400 transition-all relative overflow-hidden flex flex-col group">
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
                                    <p className="text-sm text-amber-950 font-medium leading-relaxed">
                                        {doc.remarks}
                                    </p>
                                </div>

                                <div className="flex items-center gap-1.5 mb-5 mt-auto">
                                    <Clock size={14} className="text-slate-400" />
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Returned {formatPHDateTime(doc.updated_at || doc.created_at)}</p>
                                </div>
                                
                                <div className="flex flex-col gap-2 mt-auto">
                                    <div className="flex gap-2">
                                        {doc.attachment_url && (
                                            <button 
                                                onClick={() => setPreviewDocUrl(doc.attachment_url as string)} 
                                                className="shrink-0 py-2.5 px-3 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl flex items-center justify-center transition-all active:scale-95 border-2 border-slate-300 shadow-sm"
                                                title="View Attached File"
                                            >
                                                <Eye size={18} />
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => setTrailDoc(doc)}
                                            className="flex-1 py-2.5 px-2 bg-white hover:bg-slate-50 text-slate-800 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 text-sm border-2 border-slate-300 shadow-sm"
                                        >
                                            History
                                        </button>
                                        {canReassign && (
                                            <button 
                                                onClick={() => setReassignDoc(doc)}
                                                className="flex-1 py-2.5 px-2 bg-white hover:bg-slate-50 text-slate-800 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 text-sm border-2 border-slate-300 shadow-sm"
                                            >
                                                <UserPlus size={16} /> Re-assign
                                            </button>
                                        )}
                                    </div>
                                    
                                    {canRevise ? (
                                        <div className="flex gap-2 w-full mt-1">
                                            <button 
                                                onClick={() => setCancelDoc(doc)}
                                                className="flex-[1] py-2.5 px-2 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 text-sm border-2 border-red-200 shadow-sm"
                                            >
                                                <Ban size={16}/> Cancel
                                            </button>
                                            <button 
                                                onClick={() => setReviseDoc(doc)}
                                                className="flex-[2.5] py-2.5 px-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 text-sm border-2 border-amber-700 shadow-sm"
                                            >
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

                    ) : (

                        // ==========================================
                        // STANDARD "PROCESSING" CARD DESIGN
                        // ==========================================
                        <div key={doc.id} className={`bg-white rounded-[1.5rem] border-2 ${doc.is_urgent ? 'border-red-300 shadow-md shadow-red-100 hover:border-red-400' : 'border-slate-200 hover:border-slate-300'} shadow-sm p-5 flex flex-col transition-all relative overflow-hidden group`}>
                            
                            {doc.is_urgent && <div className="absolute top-0 left-0 w-full h-1.5 bg-red-600"></div>}
                            
                            <div className="flex justify-between items-start mb-4 mt-1">
                                <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md font-mono border border-slate-200 tracking-wide">{doc.reference_no || doc.id}</span>
                                {doc.is_urgent && <span className="flex items-center gap-1 text-[10px] font-black text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200 uppercase tracking-wider animate-pulse"><AlertCircle size={12} strokeWidth={3}/> Rush</span>}
                            </div>
                            
                            <h4 className="font-black text-lg sm:text-xl text-slate-900 mb-2 leading-tight group-hover:text-blue-600 transition-colors">{doc.title || doc.subject}</h4>
                            
                            <div className="flex items-center gap-1.5 mb-4">
                                <User size={14} className="text-slate-400" />
                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Managed by: <span className="text-slate-800">{doc.assigned_clerk || 'Unassigned'}</span></p>
                            </div>
                            
                            <div className="p-4 rounded-xl border-2 mb-5 flex-1 space-y-3 bg-slate-50 border-slate-200">
                                <div className="flex items-start gap-2.5">
                                    <MapPin size={16} className="text-slate-400 mt-0.5 shrink-0" />
                                    <p className="text-sm text-slate-900 font-bold leading-snug"><span className="text-slate-500 text-[10px] block font-bold uppercase tracking-wider mb-0.5">Current Location</span>{doc.current_location || 'Processing'}</p>
                                </div>
                                <div className="flex items-start gap-2.5">
                                    <Clock size={16} className="text-slate-400 mt-0.5 shrink-0" />
                                    <p className="text-sm text-slate-900 font-bold leading-snug"><span className="text-slate-500 text-[10px] block font-bold uppercase tracking-wider mb-0.5">Last Update</span>{formatPHDateTime(doc.updated_at || doc.created_at)}</p>
                                </div>
                            </div>
                            
                            <div className="flex flex-col gap-2 mt-auto">
                                <div className="flex gap-2">
                                    {doc.attachment_url && (
                                        <button 
                                            onClick={() => setPreviewDocUrl(doc.attachment_url as string)} 
                                            className="shrink-0 py-2.5 px-3 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl flex items-center justify-center transition-all active:scale-95 border-2 border-slate-300 shadow-sm"
                                            title="View Attached File"
                                        >
                                            <Eye size={18} />
                                        </button>
                                    )}
                                    <button 
                                        onClick={() => setTrailDoc(doc)}
                                        className="flex-1 py-2.5 px-2 bg-white hover:bg-slate-50 text-slate-800 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 text-sm border-2 border-slate-300 shadow-sm"
                                    >
                                        <Clock size={16} /> Track
                                    </button>
                                    {canReassign && (
                                        <button 
                                            onClick={() => setReassignDoc(doc)}
                                            className="flex-1 py-2.5 px-2 bg-white hover:bg-slate-50 text-slate-800 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 text-sm border-2 border-slate-300 shadow-sm"
                                        >
                                            <UserPlus size={16} /> Re-assign
                                        </button>
                                    )}
                                </div>
                                
                                {isManager ? (
                                    <button 
                                        onClick={() => setSelectedDoc(doc)}
                                        className="w-full py-2.5 px-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 text-sm border-2 border-blue-700 shadow-sm mt-1"
                                    >
                                        Action <ChevronRight size={16} />
                                    </button>
                                ) : (
                                    <div className="w-full py-2.5 px-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-center mt-1">
                                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pending action by {doc.assigned_clerk}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
              </div>
          )}
      </div>

      {/* RE-ASSIGN MODAL */}
      {reassignDoc && (
          <div className={`fixed inset-0 z-[999] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50 backdrop-blur-sm ${isClosingReassign ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
              <div className={`bg-white w-full max-w-md flex flex-col shadow-2xl rounded-t-[1.5rem] sm:rounded-3xl overflow-hidden ${isClosingReassign ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
                  
                  <div className="bg-slate-900 p-5 sm:p-6 flex justify-between items-center text-white relative shrink-0">
                      <div className="w-12 h-1.5 bg-white/30 rounded-full absolute top-2 left-1/2 -translate-x-1/2 sm:hidden"></div>
                      <h3 className="font-black text-xl flex items-center gap-2 mt-2 sm:mt-0">
                          <UserPlus size={22} className="text-blue-400" /> Re-assign
                      </h3>
                      <button onClick={closeReassignModal} className="p-1.5 hover:bg-white/20 rounded-full transition-colors active:scale-95 mt-2 sm:mt-0">
                          <X size={20} />
                      </button>
                  </div>
                  
                  <div className="p-5 sm:p-6 space-y-5 bg-slate-50 flex-1">
                      <div className="bg-white border-2 border-slate-200 p-4 rounded-xl shadow-sm">
                          <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Document ID</p>
                          <p className="font-mono text-base sm:text-lg font-black text-slate-900">{reassignDoc.reference_no || reassignDoc.id}</p>
                      </div>
                      
                      <div className="relative z-20">
                          <label className="block text-[11px] font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Select Colleague</label>
                          <CustomSelect 
                              options={availableColleagues}
                              value={selectedColleague}
                              onChange={(val: string) => setSelectedColleague(val)}
                              placeholder={availableColleagues.length === 0 ? "No other colleagues available" : "Choose an employee..."}
                          />
                      </div>
                  </div>

                  <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex gap-3 shrink-0">
                      <button 
                          onClick={closeReassignModal} 
                          className="flex-1 py-3.5 bg-white border-2 border-slate-300 hover:bg-slate-50 rounded-xl font-bold text-slate-700 transition-all active:scale-95 text-sm sm:text-base"
                      >
                          Cancel
                      </button>
                      <button 
                          onClick={handleReassignConfirm} 
                          disabled={!selectedColleague || isReassigning}
                          className="flex-[1.5] py-3.5 bg-blue-600 border-2 border-blue-700 text-white rounded-xl font-bold shadow-sm hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex justify-center items-center gap-2 text-sm sm:text-base"
                      >
                          {isReassigning ? 'Updating...' : 'Confirm Re-assign'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* RENDER MODALS */}
      {selectedDoc && <HandoverScreen doc={selectedDoc} departments={departments} onBack={() => setSelectedDoc(null)} onSuccess={() => refetch()} />}
      {reviseDoc && <ReviseModal doc={reviseDoc} departments={departments} onClose={() => setReviseDoc(null)} onSuccess={() => refetch()} />}
      {cancelDoc && <CancelModal doc={cancelDoc} onClose={() => setCancelDoc(null)} onSuccess={() => refetch()} />}
      {trailDoc && <DigitalTrailModal doc={trailDoc} onBack={() => setTrailDoc(null)} />}
      {previewDocUrl && <FilePreviewModal url={previewDocUrl} onClose={() => setPreviewDocUrl(null)} />}
    </div>
  );
}

// --- HELPER COMPONENTS ---

function TabButton({ label, icon, count, isActive, onClick, colorClass, badgeClass, newCount = 0 }: TabButtonProps) {
    return (
        <button 
            onClick={onClick}
            title={label}
            className={`relative flex-none shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all active:scale-95 text-sm whitespace-nowrap border-2 ${
                isActive ? `${colorClass} border-transparent shadow-sm` : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700'
            }`}
        >
            {/* RED DOT ALERT */}
            {newCount > 0 && !isActive && (
                <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border border-white"></span>
                </span>
            )}
            
            {icon}
            
            {isActive && <span className="animate-in fade-in slide-in-from-left-2 duration-200">{label}</span>}
            
            <div className="flex items-center gap-1.5">
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] border ${isActive ? badgeClass : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
                    {count}
                </span>
                
                {/* NEW BADGE */}
                {newCount > 0 && !isActive && (
                    <span className="text-[9px] font-black text-white bg-red-500 px-1.5 py-0.5 rounded shadow-sm animate-in zoom-in flex items-center">
                        {newCount} NEW
                    </span>
                )}
            </div>
        </button>
    )
}

function CustomSelect({ options, value, onChange, placeholder }: CustomSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
 
    useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false);
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedOptionLabel = options.find(opt => (typeof opt === 'string' ? opt : opt.value) === value);
    const displayLabel = selectedOptionLabel 
        ? (typeof selectedOptionLabel === 'string' ? selectedOptionLabel : selectedOptionLabel.label)
        : placeholder;
 
    return (
      <div className="relative w-full" ref={dropdownRef}>
        <button 
            type="button" 
            onClick={() => setIsOpen(!isOpen)} 
            className={`w-full px-4 py-3 bg-white border-2 rounded-xl flex justify-between items-center transition-all text-sm sm:text-base outline-none active:scale-[0.99] ${isOpen ? 'border-blue-500 ring-4 ring-blue-500/10' : 'border-slate-300 hover:bg-slate-50 hover:border-slate-400'} ${!value ? 'text-slate-500 font-medium' : 'text-slate-900 font-bold'}`}
        >
          <span className="truncate">
            {displayLabel}
          </span>
          <ChevronDown size={20} className={`text-slate-400 transition-transform duration-300 ease-in-out sm:w-5 sm:h-5 ${isOpen ? 'rotate-180 text-slate-800' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute z-30 w-full mt-1.5 bg-white border-2 border-slate-300 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="max-h-60 overflow-y-auto p-1.5 space-y-1 scrollbar-hide">
              {options.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-slate-500 font-medium text-center">
                      No options available
                  </div>
              ) : (
                  options.map((option: OptionType, idx: number) => {
                    const optValue = typeof option === 'string' ? option : option.value;
                    const optLabel = typeof option === 'string' ? option : option.label;
                    return (
                      <div 
                        key={idx} 
                        onClick={() => { onChange(optValue); setIsOpen(false); }} 
                        className={`px-4 py-3 text-sm sm:text-base rounded-lg cursor-pointer transition-colors flex items-center active:scale-95 ${optValue === value ? 'bg-blue-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-100 font-medium'}`}
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

// --- REVISE MODAL ---
interface ReviseModalProps {
    doc: DocumentItem;
    departments: OptionType[];
    onClose: () => void;
    onSuccess: () => void;
}

function ReviseModal({ doc, departments, onClose, onSuccess }: ReviseModalProps) {
    const [isClosing, setIsClosing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [destination, setDestination] = useState(doc.final_destination || '');
    const [isProcessingFile, setIsProcessingFile] = useState(false);
    const [attachment, setAttachment] = useState<File | Blob | null>(null);
    const [attachmentName, setAttachmentName] = useState<string>('');
    const [remarks, setRemarks] = useState(''); 

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(onClose, 250);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsProcessingFile(true); setAttachmentName("Processing file...");
        try {
            if (file.type === 'application/pdf') { setAttachment(file); setAttachmentName(file.name); } 
            else if (file.type.startsWith('image/')) {
                const pdfBlob = await processImageToScannedPDF(file);
                setAttachment(pdfBlob); setAttachmentName(`Revised_${doc.reference_no}.pdf`);
            } else { toast.error("Unsupported file type."); setAttachmentName(""); }
        } catch { toast.error("Failed to process the document."); setAttachmentName(""); } 
        finally { setIsProcessingFile(false); }
    };

    const processImageToScannedPDF = (file: File): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
                    if (!ctx) return reject("Canvas error");
                    canvas.width = img.width; canvas.height = img.height;
                    ctx.filter = 'grayscale(100%) contrast(150%) brightness(110%)';
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    const processedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                    const pdf = new jsPDF({ orientation: img.width > img.height ? 'landscape' : 'portrait', unit: 'px', format: [img.width, img.height] });
                    pdf.addImage(processedDataUrl, 'JPEG', 0, 0, img.width, img.height);
                    resolve(pdf.output('blob'));
                };
                img.onerror = reject; img.src = event.target?.result as string;
            };
            reader.onerror = reject; reader.readAsDataURL(file);
        });
    };

    const handleSubmit = async () => {
        if (!destination) { 
            toast.error("Validation Error", { description: "Please provide a destination." }); 
            return; 
        }

        setIsSubmitting(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            let newUrl = doc.attachment_url;

            if (attachment) {
                const fileName = `revised-${doc.reference_no}-${Date.now()}.pdf`;
                const { error: uploadError } = await supabase.storage.from('attachments').upload(fileName, attachment, { contentType: 'application/pdf' });
                if (uploadError) throw uploadError;
                const { data } = supabase.storage.from('attachments').getPublicUrl(fileName);
                newUrl = data.publicUrl;
            }

            const { error: updateError } = await supabase.from('documents').update({
                current_location: destination,
                assigned_clerk: null, 
                status: 'routing',
                remarks: null, 
                attachment_url: newUrl,
                updated_at: new Date().toISOString()
            }).eq('id', doc.id);
            if (updateError) throw updateError;

            const logRemarks = remarks.trim() 
                ? `Document revised and routed to ${destination}\nRemarks: ${remarks.trim()}`
                : `Document revised and routed to ${destination}`;

            const { error: logError } = await supabase.from('document_logs').insert([{
                document_id: doc.id,
                action: 'Resubmitted',
                location: destination, 
                assigned_to: 'Office Queue', 
                remarks: logRemarks,
                created_by: session?.user?.id || null
            }]);
            if (logError) throw logError;

            toast.success("Document Successfully Revised & Resubmitted!");
            onSuccess();
            handleClose();
        } catch (err: unknown) {
            console.error(err);
            toast.error("Failed to resubmit the document.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={`fixed inset-0 z-[999] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50 backdrop-blur-sm ${isClosing ? 'animate-overlay-fade-out pointer-events-none' : 'animate-overlay-fade'}`}>
            <div className={`bg-white w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl rounded-t-[1.5rem] sm:rounded-3xl overflow-hidden ${isClosing ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
                
                <div className="bg-slate-900 p-5 sm:p-6 flex justify-between items-center text-white relative shrink-0">
                    <div className="w-12 h-1.5 bg-white/20 rounded-full absolute top-2 left-1/2 -translate-x-1/2 sm:hidden"></div>
                    <div>
                        <h3 className="font-black text-xl flex items-center gap-2 mt-2 sm:mt-0">
                            <UploadCloud size={24} className="text-blue-400" /> Revise & Resubmit
                        </h3>
                        <p className="text-slate-400 text-sm font-medium mt-1">Make adjustments and re-route document.</p>
                    </div>
                    <button onClick={handleClose} disabled={isSubmitting} className="p-1.5 -mr-1.5 bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-full transition-colors mt-2 sm:mt-0 disabled:opacity-50">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-5 sm:p-6 overflow-y-auto space-y-6 bg-slate-50 flex-1 custom-scrollbar">
                    
                    <div className="bg-white p-4 rounded-xl border-2 border-slate-200 shadow-sm">
                        <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Document</p>
                        <p className="text-base font-black text-slate-900">{doc.title || doc.subject}</p>
                        <p className="text-xs font-mono text-slate-500 mt-1">{doc.reference_no}</p>
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Upload Corrected Document (Optional)</label>
                        <div className="flex items-center gap-3">
                            <label className={`hidden sm:flex flex-1 items-center justify-center gap-2 p-3 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${attachment ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} disabled={isProcessingFile || isSubmitting} />
                                {isProcessingFile ? <span className="animate-pulse font-bold text-sm">Processing PDF...</span> : attachment ? <><CheckCircle size={18}/> <span className="font-bold text-sm truncate max-w-[200px]">{attachmentName}</span></> : <><Paperclip size={18}/> <span className="font-bold text-sm">Attach New PDF</span></>}
                            </label>
                            <label className={`flex sm:hidden flex-1 items-center justify-center gap-2 p-3 border-2 border-dashed rounded-xl cursor-pointer transition-colors active:scale-95 ${attachment ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} disabled={isProcessingFile || isSubmitting} />
                                {isProcessingFile ? <span className="animate-pulse font-bold text-sm">Processing PDF...</span> : attachment ? <><CheckCircle size={18}/> <span className="font-bold text-sm truncate max-w-[150px]">{attachmentName}</span></> : <><Camera size={18}/> <span className="font-bold text-sm">Re-Scan Document</span></>}
                            </label>
                            {attachment && !isProcessingFile && (
                                <button type="button" onClick={() => { setAttachment(null); setAttachmentName(''); }} className="p-3 bg-red-50 text-red-600 rounded-xl border-2 border-red-200 hover:bg-red-100 active:scale-95 transition-all"><X size={18} strokeWidth={3} /></button>
                            )}
                        </div>
                    </div>
                    
                    <div className="relative z-10">
                        <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Remarks / Notes</label>
                        <textarea 
                            value={remarks} 
                            onChange={(e) => setRemarks(e.target.value)} 
                            placeholder="What was revised? Or provide additional notes..." 
                            className="w-full p-3 sm:p-3.5 bg-white border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl outline-none font-bold text-slate-900 text-sm sm:text-base min-h-[100px] resize-y transition-colors"
                        ></textarea>
                    </div>

                    <div className="relative z-20">
                        <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Next Destination Office *</label>
                        <CustomSelect options={departments} value={destination} onChange={setDestination} placeholder="Select destination office..." />
                    </div>

                </div>

                <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex gap-3 shrink-0">
                    <button 
                        onClick={handleClose} 
                        className="flex-1 py-3 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition-all active:scale-95 border-2 border-slate-300 text-sm sm:text-base"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSubmit} 
                        disabled={isSubmitting || isProcessingFile || !destination}
                        className="flex-[2] py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 border-2 border-blue-700 shadow-sm disabled:opacity-50 text-sm sm:text-base"
                    >
                        {isSubmitting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : 'Submit Revision'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// --- NEW CANCEL MODAL ---
interface CancelModalProps {
    doc: DocumentItem;
    onClose: () => void;
    onSuccess: () => void;
}

function CancelModal({ doc, onClose, onSuccess }: CancelModalProps) {
    const [isClosing, setIsClosing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [reason, setReason] = useState('');

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(onClose, 250);
    };

    const handleSubmit = async () => {
        if (!reason.trim()) { 
            toast.error("Validation Error", { description: "Please provide a reason for cancellation." }); 
            return; 
        }

        setIsSubmitting(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();

            // 1. Mark document as cancelled
            const { error: updateError } = await supabase.from('documents').update({
                status: 'cancelled',
                assigned_clerk: null, // Clear assignment
                remarks: reason.trim(), // Save the cancellation reason here
                updated_at: new Date().toISOString()
            }).eq('id', doc.id);
            if (updateError) throw updateError;

            // 2. Log it to the digital trail
            const { error: logError } = await supabase.from('document_logs').insert([{
                document_id: doc.id,
                action: 'Cancelled',
                location: doc.current_location || 'Origin',
                remarks: `Document cancelled by creator. Reason: ${reason.trim()}`,
                created_by: session?.user?.id || null
            }]);
            if (logError) throw logError;

            toast.success("Document Cancelled", { description: "It has been moved to your cancelled history." });
            onSuccess();
            handleClose();
        } catch (err) {
            console.error(err);
            toast.error("Failed to cancel the document.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={`fixed inset-0 z-[999] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50 backdrop-blur-sm ${isClosing ? 'animate-overlay-fade-out pointer-events-none' : 'animate-overlay-fade'}`}>
            <div className={`bg-white w-full max-w-md flex flex-col shadow-2xl rounded-t-[1.5rem] sm:rounded-3xl overflow-hidden ${isClosing ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
                
                <div className="bg-slate-900 p-5 sm:p-6 flex justify-between items-center text-white relative shrink-0">
                    <div className="w-12 h-1.5 bg-white/20 rounded-full absolute top-2 left-1/2 -translate-x-1/2 sm:hidden"></div>
                    <h3 className="font-black text-xl flex items-center gap-2 mt-2 sm:mt-0">
                        <Ban size={22} className="text-red-500" /> Cancel Document
                    </h3>
                    <button onClick={handleClose} disabled={isSubmitting} className="p-1.5 -mr-1.5 bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-full transition-colors mt-2 sm:mt-0 disabled:opacity-50">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-5 sm:p-6 overflow-y-auto space-y-5 bg-slate-50 flex-1">
                    <p className="text-slate-600 font-medium text-sm">
                        Cancelling will permanently stop this document from routing and move it to your archives as a voided record.
                    </p>
                    
                    <div className="bg-white p-4 rounded-xl border-2 border-slate-200 shadow-sm">
                        <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Target Document</p>
                        <p className="text-base font-black text-slate-900">{doc.title || doc.subject}</p>
                        <p className="text-xs font-mono text-slate-500 mt-1">{doc.reference_no}</p>
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Reason for Cancellation *</label>
                        <textarea 
                            value={reason} 
                            onChange={(e) => setReason(e.target.value)} 
                            placeholder="E.g., Made a mistake, duplicate record, no longer needed..." 
                            className="w-full p-3 sm:p-3.5 bg-white border-2 border-slate-200 focus:border-red-500 focus:ring-4 focus:ring-red-500/10 rounded-xl outline-none font-bold text-slate-900 text-sm sm:text-base min-h-[100px] resize-y transition-colors"
                        ></textarea>
                    </div>
                </div>

                <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex gap-3 shrink-0">
                    <button 
                        onClick={handleClose} 
                        className="flex-1 py-3 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition-all active:scale-95 border-2 border-slate-300 text-sm sm:text-base"
                    >
                        Go Back
                    </button>
                    <button 
                        onClick={handleSubmit} 
                        disabled={isSubmitting || !reason.trim()}
                        className="flex-[1.5] py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 border-2 border-red-700 shadow-md disabled:opacity-50 text-sm sm:text-base"
                    >
                        {isSubmitting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : 'Confirm Cancel'}
                    </button>
                </div>
            </div>
        </div>
    );
}