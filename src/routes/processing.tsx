import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
    Search, AlertCircle, MapPin, Eye, Clock, ChevronRight, X, Activity, CornerUpLeft, User, MessageSquareWarning, CheckCircle, UserPlus, ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { formatPHDateTime } from '../lib/utils';
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
                .eq('department', empData.department)
                .neq('name', currentUserName);
            
            if (deptEmps) {
                colleagues = deptEmps.map(e => e.name);
            }
        }
    }

    const [docsRes, deptRes] = await Promise.all([
        supabase.from('documents').select('*').neq('status', 'sealed'),
        supabase.from('departments').select('name').order('name')
    ]);

    let processing: DocumentItem[] = [];
    let returned: DocumentItem[] = [];
    let departments: DepartmentOption[] = [];

    if (docsRes.data) {
        // Returned documents must be visible to the creator or assigned clerk so they can revise them
        const myActiveDocs = (docsRes.data as DocumentItem[]).filter((d) => {
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

  const { data, isLoading, refetch } = useQuery<ProcessingData>({
      queryKey: ['processingDocuments'],
      queryFn: fetchProcessingData
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
                colorClass="bg-amber-600 text-white"
                badgeClass="bg-amber-500 text-white border-amber-400"
              />
          </div>
      </div>

      <div key={activeTab} className="animate-in fade-in zoom-in-[0.97] duration-300 ease-out fill-mode-both">
          {filteredDocs.length === 0 && (
              <div className="bg-white border-2 border-dashed border-slate-300 rounded-3xl p-10 flex flex-col items-center justify-center text-center">
                  <div className="bg-slate-50 p-4 rounded-full mb-4">
                    {activeTab === 'processing' ? <Search size={36} className="text-slate-400" /> : <CheckCircle size={36} className="text-emerald-500" />}
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mb-2">
                      {activeTab === 'processing' ? 'No documents found' : 'Inbox Zero!'}
                  </h3>
                  <p className="text-base font-medium text-slate-600 max-w-md">
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
                        // "ACTION NEEDED" CARD DESIGN (REVISE & RESUBMIT)
                        // ==========================================
                        <div key={doc.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col">
                            <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500"></div>
                            
                            <div className="p-5 flex-1 flex flex-col pl-6">
                                <div className="flex justify-between items-start mb-3">
                                    <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-mono border border-slate-200">{doc.reference_no || doc.id}</span>
                                    <span className="flex items-center gap-1 text-[10px] font-black text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 uppercase tracking-wider">
                                        <AlertCircle size={12} strokeWidth={3}/> Needs Revision
                                    </span>
                                </div>
                                
                                <h4 className="font-black text-lg text-slate-900 mb-1.5 leading-tight">{doc.title || doc.subject}</h4>
                                
                                <div className="flex items-center gap-1.5 mb-4">
                                    <User size={14} className="text-slate-400" />
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Managed by: <span className="text-amber-700">{doc.assigned_clerk}</span></p>
                                </div>
                                
                                <div className="bg-amber-50/60 rounded-xl p-3.5 border border-amber-100 mb-5 relative">
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
                                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Returned {formatPHDateTime(doc.updated_at || doc.created_at)}</p>
                                </div>
                                
                                <div className="flex flex-col gap-2 mt-auto">
                                    <div className="flex gap-2">
                                        {doc.attachment_url && (
                                            <button 
                                                onClick={() => setPreviewDocUrl(doc.attachment_url as string)} 
                                                className="shrink-0 py-2.5 px-3 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl flex items-center justify-center transition-all active:scale-95 border-2 border-slate-200"
                                                title="View Attached File"
                                            >
                                                <Eye size={18} />
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => setTrailDoc(doc)}
                                            className="flex-1 py-2.5 px-2 bg-white hover:bg-slate-50 text-slate-800 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 border-2 border-slate-200 text-sm"
                                        >
                                            History
                                        </button>
                                        {canReassign && (
                                            <button 
                                                onClick={() => setReassignDoc(doc)}
                                                className="flex-1 py-2.5 px-2 bg-white hover:bg-slate-50 text-slate-800 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 border-2 border-slate-200 text-sm"
                                            >
                                                <UserPlus size={16} /> Re-assign
                                            </button>
                                        )}
                                    </div>
                                    
                                    {canRevise ? (
                                        <button 
                                            onClick={() => setSelectedDoc(doc)}
                                            className="w-full py-2.5 px-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 text-sm border-2 border-amber-700 shadow-sm"
                                        >
                                            Revise & Resubmit
                                        </button>
                                    ) : (
                                        <div className="w-full py-2.5 px-3 bg-amber-50/50 border-2 border-amber-100 rounded-xl text-center">
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
                        <div key={doc.id} className={`bg-white rounded-3xl border-2 ${doc.is_urgent ? 'border-red-400 shadow-md shadow-red-100 hover:border-red-500' : 'border-slate-300 hover:border-slate-500'} shadow-sm p-5 flex flex-col transition-colors relative overflow-hidden`}>
                            
                            {doc.is_urgent && <div className="absolute top-0 left-0 w-full h-1.5 bg-red-600"></div>}
                            
                            <div className="flex justify-between items-start mb-4 mt-1">
                                <span className="text-sm font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md font-mono border border-slate-200">{doc.reference_no || doc.id}</span>
                                {doc.is_urgent && <span className="flex items-center gap-1 text-xs font-black text-red-700 bg-red-50 px-2.5 py-1 rounded-full border-2 border-red-200 uppercase tracking-wider animate-pulse"><AlertCircle size={14} strokeWidth={3}/> Rush</span>}
                            </div>
                            
                            <h4 className="font-black text-xl text-slate-900 mb-2 leading-tight">{doc.title || doc.subject}</h4>
                            
                            <div className="flex items-center gap-1.5 mb-4 px-0.5">
                                <User size={14} className="text-slate-400" />
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Managed by: <span className="text-blue-600">{doc.assigned_clerk || 'Unassigned'}</span></p>
                            </div>
                            
                            <div className="p-4 rounded-xl border-2 mb-5 flex-1 space-y-3 bg-slate-50 border-slate-200">
                                <div className="flex items-start gap-3">
                                    <MapPin size={18} className="text-slate-500 mt-0.5 shrink-0" />
                                    <p className="text-sm text-slate-900 font-bold leading-snug"><span className="text-slate-500 text-xs block font-bold uppercase tracking-wider mb-0.5">Current Location</span>{doc.current_location || 'Processing'}</p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <Clock size={18} className="text-slate-500 mt-0.5 shrink-0" />
                                    <p className="text-sm text-slate-900 font-bold leading-snug"><span className="text-slate-500 text-xs block font-bold uppercase tracking-wider mb-0.5">Last Update</span>{formatPHDateTime(doc.updated_at || doc.created_at)}</p>
                                </div>
                            </div>
                            
                            <div className="flex flex-col gap-2 mt-auto">
                                <div className="flex gap-2">
                                    {doc.attachment_url && (
                                        <button 
                                            onClick={() => setPreviewDocUrl(doc.attachment_url as string)} 
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
                                    {canReassign && (
                                        <button 
                                            onClick={() => setReassignDoc(doc)}
                                            className="flex-1 py-2.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 border-2 border-slate-300 text-sm"
                                        >
                                            <UserPlus size={16} /> Re-assign
                                        </button>
                                    )}
                                </div>
                                
                                {isManager ? (
                                    <button 
                                        onClick={() => setSelectedDoc(doc)}
                                        className="w-full py-2.5 px-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 text-sm border-2 border-blue-700 shadow-sm"
                                    >
                                        Action <ChevronRight size={16} />
                                    </button>
                                ) : (
                                    <div className="w-full py-2.5 px-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-center">
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending action by {doc.assigned_clerk}</p>
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
          <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm ${isClosingReassign ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
              <div className={`bg-white w-full max-w-md rounded-[24px] shadow-2xl border-2 border-slate-200 ${isClosingReassign ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
                  <div className="bg-slate-900 p-5 flex justify-between items-center text-white rounded-t-[22px]">
                      <h3 className="font-black text-xl flex items-center gap-2">
                          <UserPlus size={22} className="text-blue-400" /> Re-assign Document
                      </h3>
                      <button onClick={closeReassignModal} className="p-1.5 hover:bg-white/20 rounded-full transition-colors">
                          <X size={20} />
                      </button>
                  </div>
                  <div className="p-6 space-y-5 rounded-b-[24px]">
                      <div>
                          <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Document ID</p>
                          <p className="font-mono text-lg font-black text-slate-900">{reassignDoc.reference_no || reassignDoc.id}</p>
                      </div>
                      
                      <div className="relative z-20">
                          <label className="block text-sm font-bold text-slate-900 mb-2">Select Colleague (Same Department)</label>
                          <CustomSelect 
                              options={data?.colleagues || []}
                              value={selectedColleague}
                              onChange={(val: string) => setSelectedColleague(val)}
                              placeholder={data?.colleagues.length === 0 ? "No colleagues available" : "Choose an employee..."}
                          />
                      </div>

                      <div className="pt-2 flex gap-3 relative z-10">
                          <button 
                              onClick={closeReassignModal} 
                              className="flex-1 py-3.5 bg-white border-2 border-slate-300 hover:bg-slate-50 rounded-xl font-bold text-slate-700 transition-all active:scale-95"
                          >
                              Cancel
                          </button>
                          <button 
                              onClick={handleReassignConfirm} 
                              disabled={!selectedColleague || isReassigning}
                              className="flex-[1.5] py-3.5 bg-blue-600 border-2 border-blue-700 text-white rounded-xl font-bold shadow-md hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex justify-center items-center gap-2"
                          >
                              {isReassigning ? 'Updating...' : 'Confirm Re-assign'}
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {selectedDoc && <HandoverScreen doc={selectedDoc} departments={departments} onBack={() => setSelectedDoc(null)} onSuccess={() => refetch()} />}
      {trailDoc && <DigitalTrailModal doc={trailDoc} onBack={() => setTrailDoc(null)} />}
      {previewDocUrl && <FilePreviewModal url={previewDocUrl} onClose={() => setPreviewDocUrl(null)} />}
    </div>
  );
}

// --- HELPER COMPONENTS ---

function TabButton({ label, icon, count, isActive, onClick, colorClass, badgeClass }: TabButtonProps) {
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
            className={`w-full px-4 py-3.5 bg-slate-50 border-2 rounded-xl flex justify-between items-center transition-all text-base outline-none active:scale-[0.99] ${isOpen ? 'border-blue-600 ring-4 ring-blue-600/10 bg-white' : 'border-slate-300 hover:bg-white hover:border-slate-400'} ${!value ? 'text-slate-500 font-medium' : 'text-slate-900 font-bold'}`}
        >
          <span className="truncate">
            {displayLabel}
          </span>
          <ChevronDown size={20} className={`text-slate-600 transition-transform duration-300 ease-in-out ${isOpen ? 'rotate-180 text-slate-900' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute z-30 w-full mt-2 bg-white border-2 border-slate-300 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
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
                        className={`px-4 py-3 text-base rounded-lg cursor-pointer transition-colors flex items-center active:scale-95 ${optValue === value ? 'bg-blue-600 text-white font-bold' : 'text-slate-800 hover:bg-slate-100 font-medium'}`}
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