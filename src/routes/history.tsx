import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Search, MapPin, Clock, CheckCircle, XCircle, AlertCircle, 
  Archive, FileText, X, Eye, CornerUpLeft, User
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// --- IMPORT OUR EXTRACTED UTILS & COMPONENTS ---
import { formatPHDateTime } from '../lib/utils';
import DigitalTrailModal from '../components/system/DigitalTrailModal';
import FilePreviewModal from '../components/system/FilePreviewModal';

// --- Shared Animation Styles ---
const modalAnimationStyles = `
    @keyframes customFadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes iosSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    @keyframes desktopZoomIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    
    .animate-overlay-fade { animation: customFadeIn 0.4s ease-out forwards; }
    .animate-responsive-modal { animation: iosSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

    .scrollbar-hide::-webkit-scrollbar { display: none; }
    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }

    @media (min-width: 640px) {
        .animate-responsive-modal { animation: desktopZoomIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    }
`;

// --- TypeScript Interfaces ---
interface DocumentLog {
    action: string;
    created_at: string;
}

interface DocumentItem {
    id: string;
    reference_no?: string;
    title?: string;
    status: string;
    assigned_clerk?: string;
    final_destination?: string;
    current_location?: string;
    remarks?: string;
    attachment_url?: string;
    created_at: string;
    updated_at?: string;
    document_logs?: DocumentLog[];
    action_time?: string; 
}

interface HistoryData {
    completed: DocumentItem[];
    returned: DocumentItem[];
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

// --- DATA FETCHING FUNCTION FOR REACT QUERY ---
const fetchHistoryData = async (): Promise<HistoryData> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("No authenticated session");

    const { data: docs, error } = await supabase
      .from('documents')
      .select(`
          *,
          document_logs (
              action,
              created_at
          )
      `);

    if (error) throw error;

    let completed: DocumentItem[] = [];
    let returned: DocumentItem[] = [];

    if (docs) {
        const processedDocs = (docs as DocumentItem[]).map((doc) => {
            const logs = doc.document_logs || [];
            
            if (doc.status === 'sealed') {
                const deliveryLog = logs.filter((l) => l.action === 'Delivered')
                                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
                doc.action_time = deliveryLog ? deliveryLog.created_at : doc.created_at;
            } else {
                const returnLog = logs.filter((l) => l.action === 'Returned')
                                      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
                doc.action_time = returnLog ? returnLog.created_at : doc.created_at;
            }
            return doc;
        });

        completed = processedDocs
          .filter((d) => d.status === 'sealed')
          .sort((a, b) => new Date(b.action_time || '').getTime() - new Date(a.action_time || '').getTime());
        
        returned = processedDocs
          .filter((d) => d.status === 'pending' && d.remarks)
          .sort((a, b) => new Date(b.action_time || '').getTime() - new Date(a.action_time || '').getTime());
    }

    return { completed, returned };
};

export default function History() {
  const [activeTab, setActiveTab] = useState<'completed' | 'returned'>('completed');
  const [searchQuery, setSearchQuery] = useState("");
  const [trailDoc, setTrailDoc] = useState<DocumentItem | null>(null);
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);

  // --- REACT QUERY MAGIC ---
  const { data, isLoading } = useQuery<HistoryData>({
      queryKey: ['historyDocuments'],
      queryFn: fetchHistoryData
  });

  // FIX: Wrap the initialization of 'documents' in its own useMemo hook
  const documents = useMemo<HistoryData>(() => {
      return data ? { completed: data.completed, returned: data.returned } : { completed: [], returned: [] };
  }, [data]);

  const filteredDocs = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const sourceList = documents[activeTab];
    
    if (!query) return sourceList;
    
    return sourceList.filter((doc: DocumentItem) => 
        (doc.title || '').toLowerCase().includes(query) ||
        (doc.reference_no || '').toLowerCase().includes(query) ||
        (doc.final_destination || '').toLowerCase().includes(query) ||
        (doc.current_location || '').toLowerCase().includes(query) ||
        (doc.assigned_clerk || '').toLowerCase().includes(query)
    );
  }, [searchQuery, documents, activeTab]);

  if (isLoading) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[50vh]">
              <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
              <p className="mt-4 text-slate-500 font-bold">Loading Archives...</p>
          </div>
      );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500 pb-12">
      <style>{modalAnimationStyles}</style>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <Archive className="text-emerald-600" size={32} /> Document History
          </h2>
          <p className="text-base text-slate-600 mt-1">Search through completed and returned documents.</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col gap-4 mb-8">
          <div className="relative w-full">
              <Search className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5 sm:w-6 sm:h-6" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search archives by Title, ID, Assigned Name, or Location..." 
                className="w-full pl-11 sm:pl-14 pr-11 sm:pr-14 py-3 sm:py-4 rounded-xl border-2 border-slate-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10 outline-none font-bold text-slate-900 placeholder:text-slate-500 transition-all text-base sm:text-lg shadow-sm" 
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
                label="Completed" 
                icon={<CheckCircle size={20} strokeWidth={activeTab === 'completed' ? 3 : 2} />}
                count={documents.completed.length} 
                isActive={activeTab === 'completed'} 
                onClick={() => { setActiveTab('completed'); setSearchQuery(''); }} 
                colorClass="bg-emerald-600 text-white"
                badgeClass="bg-emerald-500 text-white border-emerald-400"
              />
              <TabButton 
                label="Returned / Rejected" 
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
                    <FileText size={36} className="text-slate-400" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mb-2">No records found</h3>
                  <p className="text-base font-medium text-slate-600 max-w-md">
                     We couldn't find any {activeTab} documents matching your search criteria.
                  </p>
              </div>
          )}

          {filteredDocs.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredDocs.map((doc: DocumentItem) => (
                    <div key={doc.id} className={`bg-white rounded-3xl border-2 ${activeTab === 'completed' ? 'border-emerald-200 hover:border-emerald-400' : 'border-red-200 hover:border-red-400'} shadow-sm p-5 flex flex-col transition-colors relative overflow-hidden`}>
                        
                        <div className={`absolute top-0 left-0 w-full h-1.5 ${activeTab === 'completed' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                        
                        <div className="flex justify-between items-start mb-4 mt-1">
                            <span className="text-sm font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md font-mono border border-slate-200">{doc.reference_no || doc.id}</span>
                            <span className={`flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-full border-2 uppercase tracking-wider ${
                                activeTab === 'completed' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-700 bg-red-50 border-red-200'
                            }`}>
                                {activeTab === 'completed' ? <CheckCircle size={14} strokeWidth={3}/> : <XCircle size={14} strokeWidth={3}/>}
                                {activeTab === 'completed' ? 'Completed' : 'Returned'}
                            </span>
                        </div>
                        
                        <h4 className="font-black text-xl text-slate-900 mb-2 leading-tight">{doc.title}</h4>

                        <div className="flex items-center gap-1.5 mb-4 px-0.5">
                            <User size={14} className="text-slate-400" />
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Managed by: <span className="text-blue-600">{doc.assigned_clerk || 'Unassigned'}</span></p>
                        </div>
                        
                        <div className={`p-4 rounded-xl border-2 mb-5 flex-1 space-y-3 ${activeTab === 'completed' ? 'bg-emerald-50/50 border-emerald-100' : 'bg-red-50/50 border-red-100'}`}>
                            {activeTab === 'completed' ? (
                                <>
                                    <div className="flex items-start gap-3">
                                        <MapPin size={18} className="text-emerald-600 mt-0.5 shrink-0" />
                                        <p className="text-sm text-slate-900 font-bold leading-snug"><span className="text-slate-500 text-xs block font-bold uppercase tracking-wider mb-0.5">Final Location</span>{doc.final_destination || 'Archived'}</p>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <Clock size={18} className="text-emerald-600 mt-0.5 shrink-0" />
                                        <p className="text-sm text-slate-900 font-bold leading-snug"><span className="text-slate-500 text-xs block font-bold uppercase tracking-wider mb-0.5">Completed On</span>{formatPHDateTime(doc.action_time)}</p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="flex items-start gap-3">
                                        <MapPin size={18} className="text-red-600 mt-0.5 shrink-0" />
                                        <p className="text-sm text-slate-900 font-bold leading-snug"><span className="text-slate-500 text-xs block font-bold uppercase tracking-wider mb-0.5">Returned By</span>{doc.current_location}</p>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <Clock size={18} className="text-red-600 mt-0.5 shrink-0" />
                                        <p className="text-sm text-slate-900 font-bold leading-snug"><span className="text-slate-500 text-xs block font-bold uppercase tracking-wider mb-0.5">Returned On</span>{formatPHDateTime(doc.action_time)}</p>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <AlertCircle size={18} className="text-red-600 mt-0.5 shrink-0" />
                                        <p className="text-sm text-slate-900 font-bold leading-snug"><span className="text-slate-500 text-xs block font-bold uppercase tracking-wider mb-0.5">Reason</span>{doc.remarks}</p>
                                    </div>
                                </>
                            )}
                        </div>
                        
                        <div className="flex gap-2 mt-auto">
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
                                className="flex-1 py-2.5 px-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 border-2 border-blue-700 text-sm"
                            >
                                View Record <CornerUpLeft size={16} />
                            </button>
                        </div>
                    </div>
                ))}
              </div>
          )}
      </div>

      {/* --- RENDER MODALS --- */}
      {trailDoc && <DigitalTrailModal doc={trailDoc} onBack={() => setTrailDoc(null)} />}
      {previewDocUrl && <FilePreviewModal url={previewDocUrl} onClose={() => setPreviewDocUrl(null)} />}
    </div>
  );
}

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