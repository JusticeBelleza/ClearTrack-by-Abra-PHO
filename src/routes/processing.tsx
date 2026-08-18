import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
    Search, AlertCircle, MapPin, Eye, Clock, ChevronRight, X, Activity, CornerUpLeft, 
    User, MessageSquareWarning, CheckCircle, UserPlus, ChevronDown, Camera, Paperclip, 
    UploadCloud, Ban, CheckSquare, Square, Layers, PenTool, ArrowLeft, RefreshCw
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
    allEmployeesList: OptionType[];
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
    disabled?: boolean;
    emptyText?: string;
    isRelative?: boolean;
    itemType?: string;
}

// --- DATA FETCHING FUNCTION ---
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

    const [docsRes, deptRes, allEmpsRes] = await Promise.all([
        supabase.from('documents').select('*').neq('status', 'sealed').neq('status', 'cancelled'),
        supabase.from('departments').select('name').order('name'),
        supabase.from('employees').select('name').order('name')
    ]);

    let processing: DocumentItem[] = [];
    let returned: DocumentItem[] = [];
    let departments: DepartmentOption[] = [];
    const allEmployeesList = allEmpsRes.data ? allEmpsRes.data.map(e => ({ label: e.name, value: e.name })) : [];

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

    return { processing, returned, departments, currentUserName, currentUserId, colleagues, allEmployeesList };
};

export default function Processing() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'processing' | 'returned'>('processing');
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [trailDoc, setTrailDoc] = useState<DocumentItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);
  
  // Collapsible cards state
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  // Re-assign Modal States
  const [reassignDoc, setReassignDoc] = useState<DocumentItem | null>(null);
  const [selectedColleague, setSelectedColleague] = useState<string>('');
  const [isReassigning, setIsReassigning] = useState(false);
  const [isClosingReassign, setIsClosingReassign] = useState(false);

  // Revise & Cancel Modal States
  const [reviseDoc, setReviseDoc] = useState<DocumentItem | null>(null);
  const [cancelDoc, setCancelDoc] = useState<DocumentItem | null>(null);

  // Batch Processing States
  const [selectedDocs, setSelectedDocs] = useState<DocumentItem[]>([]);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);

  // Smart Notification Tracking
  const [lastViewedProcessing, setLastViewedProcessing] = useState(() => localStorage.getItem('filetrackr_viewed_processing') || '0');
  const [lastViewedReturned, setLastViewedReturned] = useState(() => localStorage.getItem('filetrackr_viewed_returned') || '0');

  const { data, isLoading, isFetching, refetch } = useQuery<ProcessingData>({
      queryKey: ['processingDocuments'],
      queryFn: fetchProcessingData,
      refetchInterval: 15000, 
  });

  // =========================================
  // 🚀 SUPABASE REALTIME NOTIFICATIONS
  // =========================================
  useEffect(() => {
      const channel = supabase
          .channel('processing-document-updates')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, () => {
              queryClient.invalidateQueries({ queryKey: ['processingDocuments'] });
          })
          .subscribe();

      return () => {
          supabase.removeChannel(channel);
      };
  }, [queryClient]);

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

  // SMART TWO-TIER GROUPING: Destination -> Clerk -> Documents[]
  const nestedProcessingGroups = useMemo(() => {
      if (activeTab !== 'processing') return [];
      
      const hierarchy: Record<string, Record<string, DocumentItem[]>> = {};

      filteredDocs.forEach(doc => {
          const dest = doc.final_destination || 'Unspecified Destination';
          const clerk = doc.assigned_clerk || 'Unassigned';

          if (!hierarchy[dest]) hierarchy[dest] = {};
          if (!hierarchy[dest][clerk]) hierarchy[dest][clerk] = [];
          hierarchy[dest][clerk].push(doc);
      });

      return Object.entries(hierarchy)
          .sort(([destA], [destB]) => destA.localeCompare(destB))
          .map(([destination, clerksMap]) => ({
              destination,
              clerks: Object.entries(clerksMap).sort(([clerkA], [clerkB]) => clerkA.localeCompare(clerkB))
          }));
  }, [filteredDocs, activeTab]);

  // SMART CHECKBOX LOGIC
  const clerkDocCounts = useMemo(() => {
      if (activeTab !== 'processing') return {};
      const counts: Record<string, number> = {};
      filteredDocs.forEach(doc => {
          const clerk = doc.assigned_clerk || 'Unassigned';
          counts[clerk] = (counts[clerk] || 0) + 1;
      });
      return counts;
  }, [filteredDocs, activeTab]);

  const activeBatchClerk = selectedDocs.length > 0 ? (selectedDocs[0].assigned_clerk || 'Unassigned') : null;

  const availableColleagues = useMemo(() => {
      if (!data) return [];
      if (reassignDoc) {
          return data.colleagues.filter((name) => name !== reassignDoc.assigned_clerk);
      }
      return data.colleagues;
  }, [data, reassignDoc]);

  useEffect(() => {
      setSelectedDocs([]);
  }, [activeTab, searchQuery]);

  const newProcessingCount = useMemo(() => {
      if (!documents.processing.length) return 0;
      return documents.processing.filter(d => new Date(d.updated_at || d.created_at).getTime() > Number(lastViewedProcessing)).length;
  }, [documents.processing, lastViewedProcessing]);

  const newReturnedCount = useMemo(() => {
      if (!documents.returned.length) return 0;
      return documents.returned.filter(d => new Date(d.updated_at || d.created_at).getTime() > Number(lastViewedReturned)).length;
  }, [documents.returned, lastViewedReturned]);

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

  const toggleDocSelection = (doc: DocumentItem) => {
      setSelectedDocs(prev => 
          prev.some(d => d.id === doc.id) ? prev.filter(d => d.id !== doc.id) : [...prev, doc]
      );
  };

  const toggleCardCollapse = (docId: string) => {
      setExpandedCards(prev => ({
          ...prev,
          [docId]: !prev[docId]
      }));
  };

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
                  location: reassignDoc.current_location || 'Processing',
                  created_by: data?.currentUserId
              }]);

          if (trailError) console.warn("Failed to write trail log:", trailError.message);

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
          toast.error("Failed to re-assign document. Please try again.");
      } finally {
          setIsReassigning(false);
      }
  };

  const renderDocumentCard = (doc: DocumentItem) => {
      const isManager = doc.assigned_clerk === data?.currentUserName;
      const isCreator = doc.created_by === data?.currentUserId;
      const canReassign = isManager || isCreator;
      const canRevise = isManager || isCreator;
      
      const isActionableTab = activeTab === 'processing';
      const isSelected = selectedDocs.some(d => d.id === doc.id);
      const isExpanded = !!expandedCards[doc.id];

      // Smart Checkbox visibility rules
      const clerkName = doc.assigned_clerk || 'Unassigned';
      const isEligibleForBatch = clerkDocCounts[clerkName] > 1;
      const isAllowedToSelect = !activeBatchClerk || activeBatchClerk === clerkName;
      const showCheckbox = isActionableTab && isEligibleForBatch && isAllowedToSelect;

      return activeTab === 'returned' ? (
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
          <div key={doc.id} className={`bg-white rounded-2xl border-2 transition-all relative overflow-hidden ${doc.is_urgent ? 'border-red-300 shadow-sm hover:border-red-400' : (isSelected ? 'border-blue-500 ring-4 ring-blue-500/10' : 'border-slate-200 hover:border-slate-300')}`}>
              
              <div className={`absolute top-0 left-0 w-full h-1 ${doc.is_urgent ? 'bg-red-600' : (isSelected ? 'bg-blue-500' : 'bg-transparent')}`}></div>
              
              <div 
                  onClick={() => toggleCardCollapse(doc.id)}
                  className="p-4 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-50/70 transition-colors"
              >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      {showCheckbox && (
                          <button 
                              type="button"
                              onClick={(e) => { e.stopPropagation(); toggleDocSelection(doc); }}
                              className={`p-1 rounded-lg transition-all border-2 shrink-0 ${isSelected ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-300 border-slate-200 hover:text-slate-500 hover:border-slate-300'}`}
                          >
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
                          <h4 className="font-bold text-slate-900 text-sm sm:text-base leading-snug truncate">
                              {doc.title || doc.subject}
                          </h4>
                      </div>
                  </div>

                  <ChevronDown 
                      size={18} 
                      className={`text-slate-400 shrink-0 transition-transform duration-200 ease-in-out ${isExpanded ? 'rotate-180 text-blue-600' : ''}`} 
                  />
              </div>
              
              <div 
                  className={`grid transition-[grid-template-rows,opacity] duration-[400ms] ease-in-out ${
                      isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                  }`}
              >
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
                                      <button 
                                          onClick={() => setPreviewDocUrl(doc.attachment_url as string)} 
                                          className="shrink-0 py-2 px-3 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl flex items-center justify-center transition-all active:scale-95 border-2 border-slate-300 shadow-sm"
                                          title="View Attached File"
                                      >
                                          <Eye size={16} />
                                      </button>
                                  )}
                                  <button 
                                      onClick={() => setTrailDoc(doc)}
                                      className="flex-1 py-2 px-2 bg-white hover:bg-slate-50 text-slate-800 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 text-xs sm:text-sm border-2 border-slate-300 shadow-sm"
                                  >
                                      <Clock size={14} /> Track
                                  </button>
                                  {canReassign && (
                                      <button 
                                          onClick={() => setReassignDoc(doc)}
                                          className="flex-1 py-2 px-2 bg-white hover:bg-slate-50 text-slate-800 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 text-xs sm:text-sm border-2 border-slate-300 shadow-sm"
                                      >
                                          <UserPlus size={14} /> Re-assign
                                      </button>
                                  )}
                              </div>
                              
                              {isManager ? (
                                  <button 
                                      onClick={() => setSelectedDoc(doc)}
                                      className="w-full py-2.5 px-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 text-xs sm:text-sm border-2 border-blue-700 shadow-sm"
                                  >
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
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500 pb-28">
      <style>{modalAnimationStyles}</style>

      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Active Processing</h2>
          <p className="text-base text-slate-600 mt-1">Manage documents currently assigned to you or created by you.</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 mb-8">
          <div className="flex items-center gap-3 w-full">
              <div className="relative flex-1">
                  <Search className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 sm:w-5 sm:h-5" />
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by Title, ID, Location, or Assigned Name..." 
                    className="w-full pl-10 sm:pl-11 pr-10 py-2.5 sm:py-3 rounded-[0.8rem] border border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none font-semibold text-slate-800 placeholder:text-slate-400 transition-all text-sm sm:text-[15px] shadow-sm bg-white" 
                  />
                  {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-full transition-all active:scale-90"
                      >
                          <X className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={3} />
                      </button>
                  )}
              </div>
              
              <button 
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="p-2.5 sm:py-3 sm:px-4 bg-white border border-slate-300 rounded-[0.8rem] text-slate-600 hover:bg-slate-50 hover:text-blue-600 shadow-sm transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 shrink-0"
                  title="Refresh Documents"
              >
                  <RefreshCw size={18} className={isFetching ? "animate-spin text-blue-600" : ""} />
                  <span className="hidden sm:inline font-bold text-sm">Refresh</span>
              </button>
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

          {filteredDocs.length > 0 && activeTab === 'processing' ? (
              <div className="space-y-12">
                  {nestedProcessingGroups.map(({ destination, clerks }) => (
                      <div key={destination} className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                          <div className="flex items-center gap-3 mb-4 mt-6">
                              <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                                  <MapPin size={12} className="text-blue-500" />
                                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{destination}</span>
                              </div>
                              <div className="h-px bg-slate-200 flex-1"></div>
                              <span className="text-[10px] font-bold text-slate-400">
                                  {clerks.reduce((total, [_, docs]) => total + docs.length, 0)} items
                              </span>
                          </div>
                          
                          <div className="space-y-6 pl-1 sm:pl-2">
                              {clerks.map(([clerkName, clerkDocs]) => (
                                  <div key={clerkName} className="space-y-3">
                                      <div className="flex items-center gap-2 pl-1">
                                          <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-md border border-blue-200">
                                              <User size={11} className="text-blue-500" />
                                              <span className="text-[10px] font-bold tracking-tight">Managed by: {clerkName}</span>
                                          </div>
                                          <span className="text-[10px] font-bold text-slate-400">({clerkDocs.length})</span>
                                          <div className="h-px bg-slate-200/80 flex-1"></div>
                                      </div>

                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                                          {clerkDocs.map(doc => renderDocumentCard(doc))}
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  ))}
              </div>
          ) : (
              filteredDocs.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {filteredDocs.map(doc => renderDocumentCard(doc))}
                  </div>
              )
          )}
      </div>

      {/* FLOATING BATCH ACTION BAR */}
      {selectedDocs.length > 0 && activeTab === 'processing' && (
          <div className="fixed bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 z-[100] w-[95%] sm:w-auto bg-slate-900/95 backdrop-blur-md border border-slate-700 text-white px-3 py-2 sm:px-4 sm:py-2.5 rounded-2xl sm:rounded-full shadow-2xl flex items-center justify-between gap-3 animate-in slide-in-from-bottom-10 fade-in duration-300">
             
             <div className="flex items-center gap-2.5 shrink-0 pl-1">
                 <div className="flex items-center gap-2">
                     <span className="flex items-center justify-center bg-blue-600 text-white text-xs sm:text-sm font-black w-6 h-6 sm:w-7 sm:h-7 rounded-full shadow-sm">{selectedDocs.length}</span>
                 </div>
                 <div className="w-px h-4 sm:h-5 bg-slate-700 hidden sm:block"></div>
                 <button onClick={() => setSelectedDocs([])} className="text-slate-400 hover:text-white font-bold text-xs transition-colors uppercase tracking-wider hidden sm:block">Clear</button>
             </div>
             
             <div className="flex gap-2 shrink-0 ml-auto sm:ml-0 overflow-x-auto scrollbar-hide py-0.5">
                 <button 
                    onClick={() => setIsBatchModalOpen(true)} 
                    className="bg-white hover:bg-slate-50 text-slate-900 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl sm:rounded-full font-bold text-xs sm:text-sm transition-all active:scale-95 shadow-sm flex items-center gap-1.5"
                 >
                     Batch Action <ChevronRight size={14} className="text-slate-400"/>
                 </button>
             </div>
          </div>
      )}

      {/* BATCH ACTION MODAL */}
      {isBatchModalOpen && (
          <BatchActionModal 
            selectedDocs={selectedDocs}
            currentUserId={data?.currentUserId}
            currentUserName={data?.currentUserName}
            departments={departments}
            colleagues={availableColleagues}
            onClose={() => setIsBatchModalOpen(false)}
            onSuccess={() => {
                setSelectedDocs([]);
                setIsBatchModalOpen(false);
                refetch();
            }}
          />
      )}

      {/* RE-ASSIGN MODAL */}
      {reassignDoc && (
          <div className={`fixed inset-0 z-[999] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50 backdrop-blur-sm ${isClosingReassign ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
              <div className={`bg-white w-full max-w-md flex flex-col shadow-2xl rounded-t-[1.5rem] sm:rounded-3xl ${isClosingReassign ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
                  
                  <div className="bg-slate-900 p-5 sm:p-6 flex justify-between items-center text-white relative shrink-0 rounded-t-[1.5rem] sm:rounded-t-3xl z-20">
                      <div className="w-12 h-1.5 bg-white/30 rounded-full mx-auto absolute top-2 left-1/2 -translate-x-1/2 sm:hidden"></div>
                      <h3 className="font-black text-xl flex items-center gap-2 mt-2 sm:mt-0">
                          <UserPlus size={22} className="text-blue-400" /> Re-assign
                      </h3>
                      <button onClick={closeReassignModal} className="p-1.5 hover:bg-white/20 rounded-full transition-colors active:scale-95 mt-2 sm:mt-0">
                          <X size={20} />
                      </button>
                  </div>
                  
                  <div className="p-5 sm:p-6 space-y-5 bg-slate-50 flex-1 relative z-10 overflow-y-auto custom-scrollbar">
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
                              emptyText="No employee found"
                              isRelative={true}
                              itemType="employee"
                          />
                      </div>
                  </div>

                  <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex gap-3 shrink-0 relative z-0 sm:rounded-b-3xl">
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

      {selectedDoc && <HandoverScreen doc={selectedDoc} departments={departments} onBack={() => setSelectedDoc(null)} onSuccess={() => refetch()} />}
      {reviseDoc && <ReviseModal doc={reviseDoc} departments={departments} onClose={() => setReviseDoc(null)} onSuccess={() => refetch()} />}
      {cancelDoc && <CancelModal doc={cancelDoc} onClose={() => setCancelDoc(null)} onSuccess={() => refetch()} />}
      {trailDoc && <DigitalTrailModal doc={trailDoc} onBack={() => setTrailDoc(null)} />}
      {previewDocUrl && <FilePreviewModal url={previewDocUrl} onClose={() => setPreviewDocUrl(null)} />}
    </div>
  );
}

// ==========================================
// BATCH ACTION MODAL
// ==========================================

function BatchActionModal({ selectedDocs, currentUserId, currentUserName, departments, colleagues, onClose, onSuccess }: any) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawingRef = useRef(false);

    const [isClosing, setIsClosing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeAction, setActiveAction] = useState<'add_step' | 'complete' | 'reject' | 'reassign' | null>(null);
    
    // Canvas States
    const [hasSignature, setHasSignature] = useState(false);

    // Form States
    const [destination, setDestination] = useState('');
    const [receivingClerk, setReceivingClerk] = useState('');
    const [remarks, setRemarks] = useState('');
    const [rejectOffice, setRejectOffice] = useState('');
    const [selectedColleague, setSelectedColleague] = useState('');
    
    // Completion Form States
    const [releasedBy, setReleasedBy] = useState('');
    const [retentionFate, setRetentionFate] = useState<'originator' | 'destination' | null>(null);
    const [isProcessingFile, setIsProcessingFile] = useState(false);
    const [attachment, setAttachment] = useState<File | Blob | null>(null);
    const [attachmentName, setAttachmentName] = useState<string>('');

    // --- SECURITY LOGIC ---
    // If the user selected a document they do NOT manage, hide the process actions.
    const canProcessBatch = useMemo(() => {
        return selectedDocs.every((doc: DocumentItem) => doc.assigned_clerk === currentUserName);
    }, [selectedDocs, currentUserName]);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(onClose, 300);
    };

    const handleBackBtn = () => {
        if (isSubmitting) return;
        setActiveAction(null);
        setHasSignature(false);
        setRemarks('');
        setDestination('');
        setReceivingClerk('');
        setRejectOffice('');
        setSelectedColleague('');
        setReleasedBy('');
        setRetentionFate(null);
        setAttachment(null);
    };

    useEffect(() => {
        if (activeAction !== 'add_step' && activeAction !== 'complete') return;

        const timer = setTimeout(() => {
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
                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;

                let clientX, clientY;
                if (e.type.includes('touch')) {
                    clientX = (e as TouchEvent).touches[0].clientX;
                    clientY = (e as TouchEvent).touches[0].clientY;
                } else {
                    clientX = (e as MouseEvent).clientX;
                    clientY = (e as MouseEvent).clientY;
                }

                return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
            };

            const startDrawing = (e: MouseEvent | TouchEvent) => { 
                e.preventDefault(); 
                isDrawingRef.current = true;
                setHasSignature(true); 
                const { x, y } = getCoordinates(e); 
                ctx.beginPath(); 
                ctx.moveTo(x, y); 
            };

            const draw = (e: MouseEvent | TouchEvent) => { 
                if (!isDrawingRef.current) return; 
                e.preventDefault(); 
                const { x, y } = getCoordinates(e); 
                ctx.lineTo(x, y); 
                ctx.stroke(); 
            };

            const stopDrawing = () => { 
                isDrawingRef.current = false; 
                ctx.closePath(); 
            };

            canvas.addEventListener('mousedown', startDrawing); canvas.addEventListener('mousemove', draw); canvas.addEventListener('mouseup', stopDrawing); canvas.addEventListener('mouseout', stopDrawing);
            canvas.addEventListener('touchstart', startDrawing, { passive: false }); canvas.addEventListener('touchmove', draw, { passive: false }); canvas.addEventListener('touchend', stopDrawing);

            return () => {
                canvas.removeEventListener('mousedown', startDrawing); canvas.removeEventListener('mousemove', draw); canvas.removeEventListener('mouseup', stopDrawing); canvas.removeEventListener('mouseout', stopDrawing);
                canvas.removeEventListener('touchstart', startDrawing); canvas.removeEventListener('touchmove', draw); canvas.removeEventListener('touchend', stopDrawing);
            };
        }, 50);

        return () => clearTimeout(timer);
    }, [activeAction]);

    const clearSignature = () => { 
        const canvas = canvasRef.current; 
        if(canvas) {
            canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height); 
            setHasSignature(false);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsProcessingFile(true); setAttachmentName("Processing file...");
        try {
            if (file.type === 'application/pdf') { setAttachment(file); setAttachmentName(file.name); } 
            else if (file.type.startsWith('image/')) {
                const pdfBlob = await processImageToScannedPDF(file);
                setAttachment(pdfBlob); setAttachmentName(`Batch_Completed_${Date.now()}.pdf`);
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

    const handleBatchSubmit = async () => {
        if (activeAction === 'reject') {
            if (!rejectOffice) { toast.error("Validation Error", { description: "Please provide the returning office." }); return; }
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
            const nowIso = new Date().toISOString();
            let sharedSignatureUrl = null;
            let sharedAttachmentUrl = null;

            // Upload Signature once for the whole batch
            if (canvasRef.current && (activeAction === 'add_step' || activeAction === 'complete')) {
                const blob = await new Promise<Blob | null>((resolve) => canvasRef.current!.toBlob(resolve, 'image/png'));
                if (blob) {
                    const fileName = `batch-signature-${Date.now()}.png`;
                    const { error: uploadError } = await supabase.storage.from('attachments').upload(fileName, blob, { contentType: 'image/png' });
                    if (!uploadError) {
                        const { data } = supabase.storage.from('attachments').getPublicUrl(fileName);
                        sharedSignatureUrl = data.publicUrl;
                    }
                }
            }

            // Upload Document once for the whole batch (Complete action)
            if (attachment && activeAction === 'complete') {
                const fileName = `batch-completed-${Date.now()}.pdf`;
                const { error: uploadError } = await supabase.storage.from('attachments').upload(fileName, attachment, { contentType: 'application/pdf' });
                if (!uploadError) {
                    const { data } = supabase.storage.from('attachments').getPublicUrl(fileName);
                    sharedAttachmentUrl = data.publicUrl;
                }
            }

            const promises = selectedDocs.map(async (doc: DocumentItem) => {
                if (activeAction === 'complete') {
                    const fateString = retentionFate === 'originator' ? 'Returned to Originator' : 'Retained at Final Destination';
                    const detailedRemarks = `Released By: ${releasedBy.trim()}\nDocument Retention: ${fateString}${remarks ? `\nRemarks: ${remarks.trim()}` : ''}`;
                    
                    const updateData: any = { status: 'sealed', updated_at: nowIso };
                    if (sharedAttachmentUrl) updateData.completed_attachment_url = sharedAttachmentUrl;

                    await supabase.from('documents').update(updateData).eq('id', doc.id);
                    await supabase.from('document_logs').insert([{ document_id: doc.id, action: 'Delivered', location: doc.final_destination || doc.current_location, assigned_to: currentUserName, remarks: detailedRemarks, created_by: currentUserId, signature_url: sharedSignatureUrl, attachment_url: sharedAttachmentUrl }]);
                
                } else if (activeAction === 'reject') {
                    await supabase.from('documents').update({ status: 'pending', remarks: remarks, updated_at: nowIso, assigned_clerk: null }).eq('id', doc.id);
                    await supabase.from('document_logs').insert([{ document_id: doc.id, action: 'Returned', location: rejectOffice, assigned_to: 'Creator', remarks: remarks, created_by: currentUserId }]);
                
                } else if (activeAction === 'add_step') {
                    await supabase.from('documents').update({ status: 'routing', current_location: destination, remarks: null, updated_at: nowIso }).eq('id', doc.id);
                    await supabase.from('document_logs').insert([{ document_id: doc.id, action: 'In transit', location: destination, assigned_to: receivingClerk.trim(), remarks: null, created_by: currentUserId, signature_url: sharedSignatureUrl }]);
                
                } else if (activeAction === 'reassign') {
                    await supabase.from('documents').update({ assigned_clerk: selectedColleague, updated_at: nowIso }).eq('id', doc.id);
                    const prevClerk = doc.assigned_clerk || 'Unassigned';
                    await supabase.from('document_logs').insert([{ document_id: doc.id, action: 'REASSIGNED', location: doc.current_location || 'Processing', remarks: `Batch re-assigned from ${prevClerk} to ${selectedColleague} by ${currentUserName}`, created_by: currentUserId }]);
                }
            });
            
            await Promise.all(promises);
            toast.success(`Successfully processed ${selectedDocs.length} documents!`);
            onSuccess();
        } catch (e) {
            console.error(e);
            toast.error("An error occurred during batch processing.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const headerColorClass = !activeAction || activeAction === 'add_step' ? 'bg-slate-900' :
        activeAction === 'reject' ? 'bg-red-700' :
        activeAction === 'complete' ? 'bg-emerald-700' :
        activeAction === 'reassign' ? 'bg-indigo-700' : 'bg-slate-900';

    return (
        <div className={`fixed inset-0 z-[999] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/70 backdrop-blur-sm ${isClosing ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
            <div className={`bg-white w-full max-w-xl max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden shadow-2xl rounded-t-[1.5rem] sm:rounded-3xl ${isClosing ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
                
                <div className={`text-white relative flex flex-col shrink-0 transition-colors duration-300 ${headerColorClass}`}>
                    <div className="w-16 h-1.5 bg-white/30 rounded-full mx-auto mt-3 sm:hidden shrink-0"></div>
                    <div className="p-5 pt-3 sm:pt-6 flex items-center justify-between">
                        {activeAction ? (
                            <button onClick={handleBackBtn} disabled={isSubmitting} className="p-2 -ml-2 bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-full transition-all active:scale-90 disabled:opacity-50">
                                <ArrowLeft size={24} />
                            </button>
                        ) : <div className="w-10"></div>}
                        
                        <h3 className="font-black text-xl tracking-tight absolute left-1/2 -translate-x-1/2 whitespace-nowrap">
                            {!activeAction ? 'Batch Action' : activeAction === 'reject' ? 'Reject & Return' : activeAction === 'complete' ? 'Finalize Batch' : activeAction === 'reassign' ? 'Batch Re-assign' : 'Route Document'}
                        </h3>
                        
                        <button onClick={handleClose} disabled={isSubmitting} className="p-2 -mr-2 bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-full transition-all active:scale-90 disabled:opacity-50">
                            <X size={24} />
                        </button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6 custom-scrollbar bg-white">
                    
                    {!activeAction && (
                        <div className="bg-slate-50 border border-slate-200 p-4 sm:p-5 rounded-2xl flex flex-col items-start mb-2">
                            <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 font-mono">
                                Selected Documents ({selectedDocs.length})
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {selectedDocs.map((doc: DocumentItem) => (
                                    <span key={doc.id} className="text-xs font-bold font-mono bg-white text-slate-700 border border-slate-300 px-2 py-1 rounded-lg shadow-sm">
                                        {doc.reference_no || doc.id.substring(0,8)}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {!activeAction ? (
                        <div className="flex flex-col gap-3">
                            {!canProcessBatch && (
                                <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl flex items-start gap-3 shadow-sm mb-1">
                                    <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                                    <p className="text-xs sm:text-sm text-amber-800 font-medium leading-relaxed">
                                        <strong>Processing Restricted:</strong> Some documents in this batch are managed by other employees. You may only <strong className="text-amber-900">Re-assign</strong> them.
                                    </p>
                                </div>
                            )}

                            {canProcessBatch && <ActionCard title="Add Step" description="Route this batch to a new destination and clerk." icon={<MapPin size={20} strokeWidth={2.5} />} colorTheme="blue" onClick={() => setActiveAction('add_step')} />}
                            {canProcessBatch && <ActionCard title="Complete Documents" description="Instantly finalize and seal all selected records." icon={<CheckCircle size={20} strokeWidth={2.5} />} colorTheme="emerald" onClick={() => setActiveAction('complete')} />}
                            
                            <ActionCard title="Re-assign Documents" description="Transfer ownership of these documents to a colleague." icon={<UserPlus size={20} strokeWidth={2.5} />} colorTheme="indigo" onClick={() => setActiveAction('reassign')} />
                            
                            {canProcessBatch && <ActionCard title="Return / Reject" description="Send these documents back with a unified reason." icon={<Ban size={20} strokeWidth={2.5} />} colorTheme="rose" onClick={() => setActiveAction('reject')} />}
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                            {/* --- ADD STEP / ROUTE FORM --- */}
                            {activeAction === 'add_step' && (
                                <>
                                    <div className="relative z-20">
                                        <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Next Destination Office *</label>
                                        <CustomSelect options={departments} value={destination} onChange={setDestination} placeholder="Select receiving office..." isRelative={true} />
                                    </div>
                                    
                                    <div className="relative z-10">
                                        <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Receiving Clerk *</label>
                                        <input 
                                            type="text" value={receivingClerk} onChange={(e) => setReceivingClerk(e.target.value)} 
                                            placeholder="Enter name of receiving clerk..." 
                                            className="w-full px-4 py-3.5 bg-slate-50/50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl outline-none font-bold text-slate-700 text-sm transition-all" 
                                        />
                                    </div>
                                    
                                    <div>
                                        <div className="flex justify-between items-center mb-1.5">
                                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><PenTool size={13}/> Signature *</label>
                                            <button onClick={clearSignature} type="button" className="text-[11px] text-slate-600 font-bold hover:text-slate-900 transition-colors bg-white px-3 py-1.5 rounded-lg border border-slate-200 active:scale-95 shadow-sm">Clear Pad</button>
                                        </div>
                                        <div className="border border-slate-200 rounded-xl bg-slate-50/50 overflow-hidden touch-none relative shadow-sm">
                                            <div className="absolute top-1/2 left-4 right-4 h-0 border-b-2 border-dashed border-slate-200 pointer-events-none"></div>
                                            <canvas ref={canvasRef} width={600} height={200} className="w-full h-[180px] sm:h-[200px] cursor-crosshair bg-transparent relative z-10" style={{ touchAction: 'none' }} />
                                        </div>
                                        <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Sign clearly within the box above</p>
                                    </div>
                                </>
                            )}

                            {/* --- COMPLETE FORM --- */}
                            {activeAction === 'complete' && (
                                <>
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Scanned Signed Copy (Optional)</label>
                                        <label className={`w-full flex items-center justify-center gap-2 p-3.5 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${attachment ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                                            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} disabled={isProcessingFile} />
                                            {isProcessingFile ? <span className="animate-pulse font-bold text-sm">Processing...</span> : attachment ? <><CheckCircle size={18}/> <span className="font-bold text-sm truncate max-w-[200px]">{attachmentName}</span></> : <><Camera size={18}/> <span className="font-bold text-sm">Scan Signed Document</span></>}
                                        </label>
                                        {attachment && !isProcessingFile && (<div className="mt-2 text-right"><button type="button" onClick={() => { setAttachment(null); setAttachmentName(''); }} className="text-xs text-red-500 font-bold hover:underline">Remove Attachment</button></div>)}
                                    </div>
                                    
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Released By *</label>
                                        <input type="text" value={releasedBy} onChange={(e) => setReleasedBy(e.target.value)} placeholder="Name of official releasing the documents..." className="w-full p-3.5 bg-slate-50/50 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-xl outline-none font-bold text-slate-700 text-sm transition-all" />
                                    </div>

                                    <div>
                                        <div className="flex justify-between items-center mb-1.5">
                                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><PenTool size={13}/> Signature *</label>
                                            <button onClick={clearSignature} type="button" className="text-[11px] text-slate-600 font-bold hover:text-slate-900 transition-colors bg-white px-3 py-1.5 rounded-lg border border-slate-200 active:scale-95 shadow-sm">Clear Pad</button>
                                        </div>
                                        <div className="border border-slate-200 rounded-xl bg-slate-50/50 overflow-hidden touch-none relative shadow-sm">
                                            <div className="absolute top-1/2 left-4 right-4 h-0 border-b-2 border-dashed border-slate-200 pointer-events-none"></div>
                                            <canvas ref={canvasRef} width={600} height={200} className="w-full h-[180px] sm:h-[200px] cursor-crosshair bg-transparent relative z-10" style={{ touchAction: 'none' }} />
                                        </div>
                                        <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Sign clearly within the box above</p>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Document Retention *</label>
                                        <div className="flex flex-col gap-2">
                                            <div onClick={() => setRetentionFate('originator')} className={`p-4 border rounded-xl cursor-pointer transition-all active:scale-[0.98] flex items-center gap-3 ${retentionFate === 'originator' ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${retentionFate === 'originator' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'}`}>
                                                    {retentionFate === 'originator' && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                                                </div>
                                                <p className="font-bold text-sm text-slate-700">Return to Originator</p>
                                            </div>
                                            <div onClick={() => setRetentionFate('destination')} className={`p-4 border rounded-xl cursor-pointer transition-all active:scale-[0.98] flex items-center gap-3 ${retentionFate === 'destination' ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${retentionFate === 'destination' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'}`}>
                                                    {retentionFate === 'destination' && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                                                </div>
                                                <p className="font-bold text-sm text-slate-700">Retain at Office</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Unified Remarks (Optional)</label>
                                        <textarea 
                                            value={remarks} onChange={(e) => setRemarks(e.target.value)}
                                            placeholder="Add final notes or context for the archive..." 
                                            className="w-full p-3.5 bg-slate-50/50 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-xl outline-none font-bold text-slate-700 text-sm transition-all min-h-[100px] resize-y" 
                                        ></textarea>
                                    </div>
                                </>
                            )}

                            {/* --- REJECT FORM --- */}
                            {activeAction === 'reject' && (
                                <>
                                    <div className="relative z-20">
                                        <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Returning To Office *</label>
                                        <CustomSelect options={departments} value={rejectOffice} onChange={setRejectOffice} placeholder="Select office..." isRelative={true}/>
                                    </div>
                                    <div className="relative z-10">
                                        <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Reason for Rejection *</label>
                                        <textarea 
                                            value={remarks} onChange={(e) => setRemarks(e.target.value)} 
                                            placeholder="E.g., Missing signature, incorrect attachments..." 
                                            className="w-full p-3.5 bg-slate-50/50 border border-slate-200 focus:bg-white focus:border-red-500 focus:ring-4 focus:ring-red-500/10 rounded-xl outline-none font-bold text-slate-700 text-sm min-h-[140px] resize-y transition-all" 
                                        ></textarea>
                                    </div>
                                </>
                            )}

                            {/* --- REASSIGN FORM --- */}
                            {activeAction === 'reassign' && (
                                <>
                                    <div className="relative z-20">
                                        <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Select Colleague *</label>
                                        <CustomSelect 
                                            options={colleagues} 
                                            value={selectedColleague} 
                                            onChange={(val: string) => setSelectedColleague(val)}
                                            placeholder="Choose an employee..."
                                            emptyText="No employee found"
                                            isRelative={true}
                                            itemType="employee"
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* FORM SUBMISSION BUTTONS */}
                {activeAction && (
                    <div className="bg-white p-4 sm:p-5 flex shrink-0 border-t border-slate-100">
                        {activeAction === 'add_step' && (
                            <button onClick={handleBatchSubmit} disabled={isSubmitting || !destination || !receivingClerk.trim() || !hasSignature} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-sm transition-all active:scale-[0.98] text-sm flex justify-center items-center gap-2 border border-blue-600 disabled:opacity-50">
                                {isSubmitting ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <><MapPin size={18} strokeWidth={2.5} /> Confirm Add Step</>}
                            </button>
                        )}
                        {activeAction === 'complete' && (
                            <button onClick={handleBatchSubmit} disabled={isSubmitting || !releasedBy.trim() || !retentionFate || !hasSignature || isProcessingFile} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl shadow-sm transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2 border border-emerald-600 disabled:opacity-50">
                                {isSubmitting ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <><CheckCircle size={18} strokeWidth={2.5} /> Finalize Batch</>}
                            </button>
                        )}
                        {activeAction === 'reject' && (
                            <button onClick={handleBatchSubmit} disabled={isSubmitting || !remarks.trim() || !rejectOffice} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl shadow-sm transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2 border border-red-600 disabled:opacity-50">
                                {isSubmitting ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <><Ban size={18} strokeWidth={2.5} /> Confirm Return</>}
                            </button>
                        )}
                        {activeAction === 'reassign' && (
                            <button onClick={handleBatchSubmit} disabled={isSubmitting || !selectedColleague} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-sm transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2 border border-indigo-600 disabled:opacity-50">
                                {isSubmitting ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <><UserPlus size={18} strokeWidth={2.5} /> Confirm Re-assign</>}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// --- HELPER COMPONENT: ENTERPRISE ACTION CARD --- //
interface ActionCardProps {
    title: string;
    description: string;
    icon: React.ReactNode;
    colorTheme: 'blue' | 'emerald' | 'rose' | 'indigo';
    onClick: () => void;
}

function ActionCard({ title, description, icon, colorTheme, onClick }: ActionCardProps) {
    const themeStyles = {
        blue: "hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-sm",
        emerald: "hover:border-emerald-300 hover:bg-emerald-50/50 hover:shadow-sm",
        rose: "hover:border-rose-300 hover:bg-rose-50/50 hover:shadow-sm",
        indigo: "hover:border-indigo-300 hover:bg-indigo-50/50 hover:shadow-sm",
    };

    const iconStyles = {
        blue: "bg-blue-50 text-blue-600 border-blue-100",
        emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
        rose: "bg-rose-50 text-rose-600 border-rose-100",
        indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
    };

    const chevronStyles = {
        blue: "group-hover:text-blue-500 group-hover:translate-x-1",
        emerald: "group-hover:text-emerald-500 group-hover:translate-x-1",
        rose: "group-hover:text-rose-500 group-hover:translate-x-1",
        indigo: "group-hover:text-indigo-500 group-hover:translate-x-1",
    };

    return (
        <button 
            onClick={onClick}
            className={`w-full text-left group bg-white border border-slate-200 p-4 sm:p-5 rounded-[1.25rem] transition-all duration-200 flex items-center gap-4 active:scale-[0.99] ${themeStyles[colorTheme]}`}
        >
            <div className={`p-3 rounded-xl border ${iconStyles[colorTheme]} transition-transform duration-300 group-hover:scale-110 shrink-0 shadow-sm`}>
                {icon}
            </div>
            <div className="flex-1 min-w-0 pr-2">
                <h5 className="font-black text-slate-900 text-base sm:text-lg leading-tight mb-0.5 truncate">{title}</h5>
                <p className="text-xs sm:text-sm font-medium text-slate-500 leading-snug">{description}</p>
            </div>
            <ChevronRight className={`text-slate-300 transition-all duration-300 shrink-0 ${chevronStyles[colorTheme]}`} size={20} />
        </button>
    );
}

function TabButton({ label, icon, count, isActive, onClick, colorClass, badgeClass, newCount = 0 }: TabButtonProps) {
    return (
        <button 
            onClick={onClick}
            title={label}
            className={`relative flex-none shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-95 active:shadow-inner text-sm whitespace-nowrap overflow-hidden border-2 ${
                isActive ? `${colorClass} border-transparent shadow-sm` : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700'
            }`}
        >
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
                
                {newCount > 0 && !isActive && (
                    <span className="text-[9px] font-black text-white bg-red-500 px-1.5 py-0.5 rounded shadow-sm animate-in zoom-in flex items-center">
                        {newCount} NEW
                    </span>
                )}
            </div>
        </button>
    )
}

function CustomSelect({ options, value, onChange, placeholder, disabled = false, emptyText = "Loading options...", isRelative = false, itemType = "option" }: CustomSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const dropdownRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null); 
    const searchInputRef = useRef<HTMLInputElement>(null);
 
    useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false);
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
      if (isOpen) {
        setTimeout(() => {
          searchInputRef.current?.focus();
          menuRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 50);
      } else {
        setSearchTerm("");
      }
    }, [isOpen]);

    const filteredOptions = options.filter(opt => {
        const optLabel = typeof opt === 'string' ? opt : opt.label;
        return optLabel.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const MAX_ITEMS_TO_SHOW = 10;
    const visibleOptions = filteredOptions.slice(0, MAX_ITEMS_TO_SHOW);
    const hiddenCount = filteredOptions.length - visibleOptions.length;

    const selectedOptionLabel = options.find(opt => (typeof opt === 'string' ? opt : opt.value) === value);
    const displayLabel = selectedOptionLabel 
        ? (typeof selectedOptionLabel === 'string' ? selectedOptionLabel : selectedOptionLabel.label)
        : placeholder;
 
    return (
      <div className="relative w-full" ref={dropdownRef}>
        <button 
            type="button" 
            disabled={disabled}
            onClick={() => !disabled && setIsOpen(!isOpen)} 
            className={`w-full px-4 py-3.5 bg-slate-50/50 focus:bg-white border focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl flex justify-between items-center transition-all text-sm outline-none active:scale-[0.99] ${isOpen ? 'border-blue-500 bg-white ring-4 ring-blue-500/10' : 'border-slate-200 hover:bg-white hover:border-slate-300'} ${!value ? 'text-slate-500 font-medium' : 'text-slate-700 font-bold'}`}
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronDown size={20} className={`text-slate-400 transition-transform duration-300 ease-in-out sm:w-5 sm:h-5 ${isOpen ? 'rotate-180 text-slate-800' : ''}`} />
        </button>

        {isOpen && !disabled && (
          <div ref={menuRef} className={`${isRelative ? 'relative mt-2 mb-4' : 'absolute mt-1.5'} z-50 w-full bg-white border border-slate-200 rounded-xl shadow-xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200`}>
            
            {options.length > 5 && (
                <div className="p-2 border-b border-slate-100 bg-slate-50 shrink-0">
                    <div className="relative">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            ref={searchInputRef} type="text" placeholder="Type to search..."
                            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onClick={(e) => e.stopPropagation()}
                            className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-medium text-slate-800 placeholder:text-slate-400"
                        />
                    </div>
                </div>
            )}

            <div className="max-h-[240px] overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
              {filteredOptions.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-slate-500 text-center font-medium">
                      {searchTerm ? `No results for "${searchTerm}"` : emptyText}
                  </div>
              ) : (
                  visibleOptions.map((option: OptionType, idx: number) => {
                    const optValue = typeof option === 'string' ? option : option.value;
                    const optLabel = typeof option === 'string' ? option : option.label;
                    const isSelected = optValue === value;
                    return (
                      <div 
                        key={idx} onClick={() => { onChange(optValue); setIsOpen(false); }} 
                        className={`px-4 py-3 text-sm rounded-lg cursor-pointer transition-colors flex items-center active:scale-95 ${isSelected ? 'bg-blue-600 text-white font-bold shadow-sm' : 'text-slate-700 hover:bg-slate-100 font-medium'}`}
                      >
                        {optLabel}
                      </div>
                    );
                  })
              )}
            </div>
            {hiddenCount > 0 && (
                <div className="p-2.5 bg-slate-50 border-t border-slate-100 shrink-0 text-center">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        +{hiddenCount} more {hiddenCount === 1 ? itemType : `${itemType}s`}. Keep typing to search.
                    </p>
                </div>
            )}
          </div>
        )}
      </div>
    );
}

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
                        <CustomSelect 
                            options={departments} 
                            value={destination} 
                            onChange={setDestination} 
                            placeholder="Select destination office..." 
                            isRelative={true} // Extends modal when opened
                            itemType="office"
                        />
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

            const { error: updateError } = await supabase.from('documents').update({
                status: 'cancelled',
                assigned_clerk: null, 
                remarks: reason.trim(), 
                updated_at: new Date().toISOString()
            }).eq('id', doc.id);
            if (updateError) throw updateError;

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