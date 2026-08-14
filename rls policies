import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
    Search, MapPin, Clock, CheckCircle, AlertCircle, 
    Archive, FileText, X, Eye, CornerUpLeft, Ban, ChevronDown, FolderTree
} from 'lucide-react';
import { supabase } from '../lib/supabase';

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
    category?: string;
    status: string;
    assigned_clerk?: string;
    created_by?: string;
    custodian_id?: string;
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
    cancelled: DocumentItem[];
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
    const currentUserId = session.user.id;

    const { data: docsRes, error } = await supabase.from('documents')
        .select(`
            *,
            document_logs (
                action,
                created_at
            )
        `)
        .in('status', ['sealed', 'cancelled']);

    if (error) throw error;

    const rawDocs = docsRes || [];

    let completed: DocumentItem[] = [];
    let cancelled: DocumentItem[] = [];

    if (rawDocs.length > 0) {
        const myRelevantDocs = (rawDocs as DocumentItem[]).filter((d) => 
            d.created_by === currentUserId
        );

        const processedDocs = myRelevantDocs.map((doc) => {
            const logs = doc.document_logs || [];
            
            if (doc.status === 'sealed') {
                const deliveryLog = logs.filter((l) => l.action === 'Delivered')
                                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
                doc.action_time = deliveryLog ? deliveryLog.created_at : doc.created_at;
            } else if (doc.status === 'cancelled') {
                const cancelLog = logs.filter((l) => l.action === 'Cancelled')
                                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
                doc.action_time = cancelLog ? cancelLog.created_at : (doc.updated_at || doc.created_at);
            }
            return doc;
        });

        completed = processedDocs
          .filter((d) => d.status === 'sealed')
          .sort((a, b) => new Date(b.action_time || '').getTime() - new Date(a.action_time || '').getTime());

        cancelled = processedDocs
          .filter((d) => d.status === 'cancelled')
          .sort((a, b) => new Date(b.action_time || '').getTime() - new Date(a.action_time || '').getTime());
    }

    return { completed, cancelled };
};

export default function History() {
  const [activeTab, setActiveTab] = useState<'completed' | 'cancelled'>('completed');
  const [searchQuery, setSearchQuery] = useState("");
  const [trailDoc, setTrailDoc] = useState<DocumentItem | null>(null);
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);

  // --- Accordion & Pagination State for Document Categories ---
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [categoryPages, setCategoryPages] = useState<Record<string, number>>({});

  const { data, isLoading } = useQuery<HistoryData>({
      queryKey: ['historyDocuments'],
      queryFn: fetchHistoryData
  });

  const documents = useMemo<HistoryData>(() => {
      return { 
          completed: data?.completed || [], 
          cancelled: data?.cancelled || [] 
      };
  }, [data]);

  const filteredDocs = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const sourceList = documents[activeTab] || []; 
    
    if (!query) return sourceList;
    
    return sourceList.filter((doc: DocumentItem) => 
        (doc.title || '').toLowerCase().includes(query) ||
        (doc.reference_no || '').toLowerCase().includes(query) ||
        (doc.final_destination || '').toLowerCase().includes(query) ||
        (doc.current_location || '').toLowerCase().includes(query) ||
        (doc.assigned_clerk || '').toLowerCase().includes(query) ||
        (doc.category || '').toLowerCase().includes(query)
    );
  }, [searchQuery, documents, activeTab]);

  // --- Group Documents by Category ---
  const groupedDocs = useMemo(() => {
      const grouped: Record<string, DocumentItem[]> = {};
      
      filteredDocs.forEach(doc => {
          const category = doc.category || 'Uncategorized';
          if (!grouped[category]) grouped[category] = [];
          grouped[category].push(doc);
      });

      return Object.entries(grouped)
          .map(([category, docs]) => ({ category, docs }))
          .sort((a, b) => a.category.localeCompare(b.category));
  }, [filteredDocs]);

  const toggleCategoryAccordion = (categoryName: string) => {
      setExpandedCategories(prev => ({
          ...prev,
          [categoryName]: !prev[categoryName]
      }));
  };

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
          <p className="text-base text-slate-600 mt-1">Search through your completed and voided documents.</p>
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
                placeholder="Search archives by Title, ID, Category, or Location..." 
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
                label="Cancelled" 
                icon={<Ban size={20} strokeWidth={activeTab === 'cancelled' ? 3 : 2} />}
                count={documents.cancelled.length} 
                isActive={activeTab === 'cancelled'} 
                onClick={() => { setActiveTab('cancelled'); setSearchQuery(''); }} 
                colorClass="bg-rose-600 text-white"
                badgeClass="bg-rose-500 text-white border-rose-400"
              />
          </div>
      </div>

      <div key={activeTab} className="animate-in fade-in zoom-in-[0.97] duration-300 ease-out fill-mode-both">
          {filteredDocs.length === 0 ? (
              <div className="bg-white border-2 border-dashed border-slate-300 rounded-3xl p-10 flex flex-col items-center justify-center text-center">
                  <div className="bg-slate-50 p-4 rounded-full mb-4">
                    <FileText size={36} className="text-slate-400" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mb-2">No records found</h3>
                  <p className="text-base font-medium text-slate-600 max-w-md">
                     We couldn't find any {activeTab} documents matching your search criteria.
                  </p>
              </div>
          ) : (
              <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-sm overflow-hidden animate-in fade-in">
                  <div className="bg-slate-50 px-6 py-4 border-b-2 border-slate-200 flex justify-between items-center">
                      <h3 className="text-lg font-black text-slate-900">
                          {activeTab === 'completed' ? 'Completed Archives' : 'Voided Archives'}
                      </h3>
                  </div>
                  
                  <div className="p-4 sm:p-6 space-y-4">
                      {groupedDocs.map(({ category, docs }) => {
                          const isExpanded = expandedCategories[category];
                          const currentPage = categoryPages[category] || 1;
                          const itemsPerPage = 5;
                          const totalPages = Math.ceil(docs.length / itemsPerPage);
                          const paginatedDocs = docs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

                          return (
                              <div key={category} className="bg-white border-2 border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 transition-colors shadow-sm">
                                  {/* MINIMAL FOLDER HEADER */}
                                  <button 
                                      onClick={() => toggleCategoryAccordion(category)}
                                      className={`w-full py-4 px-4 flex items-start sm:items-center justify-between transition-colors focus:outline-none group ${isExpanded ? 'bg-slate-50' : 'bg-transparent'}`}
                                  >
                                      <div className="flex flex-col text-left flex-1 min-w-0 pr-4 gap-1">
                                          <div className="flex items-center gap-2">
                                              <FolderTree size={16} className={activeTab === 'completed' ? 'text-emerald-500' : 'text-rose-500'} />
                                              <h4 className="font-bold text-slate-800 text-sm sm:text-base leading-snug break-words">{category}</h4>
                                          </div>
                                          <span className="text-[10px] font-bold px-2 py-0.5 rounded text-slate-500 bg-slate-200 w-fit mt-0.5">
                                              {docs.length} document{docs.length !== 1 ? 's' : ''}
                                          </span>
                                      </div>
                                      <ChevronDown 
                                          size={18} 
                                          className={`shrink-0 text-slate-400 transition-transform duration-200 mt-1 sm:mt-0 ${isExpanded ? 'rotate-180 text-slate-800' : 'group-hover:text-slate-600'}`} 
                                      />
                                  </button>

                                  {/* MINIMAL FOLDER CONTENT (DOCUMENTS) */}
                                  {isExpanded && (
                                      <div className="animate-in fade-in slide-in-from-top-1 duration-200 bg-white border-t-2 border-slate-100 flex flex-col">
                                          <div className="flex flex-col">
                                              {paginatedDocs.map((doc) => (
                                                  <div key={doc.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:p-5 gap-4 group hover:bg-slate-50/50 transition-colors border-b border-slate-200 last:border-b-0">
                                                      
                                                      {/* SMART VERTICAL STACK */}
                                                      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                                                          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">{doc.reference_no || doc.id}</span>
                                                          <h4 className="font-black text-slate-900 text-sm sm:text-base leading-tight break-words">{doc.title}</h4>
                                                          
                                                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs sm:text-sm font-medium text-slate-600 mt-0.5">
                                                              {activeTab === 'completed' ? (
                                                                  <span className="flex items-start gap-1.5 break-words">
                                                                      <MapPin size={14} className="text-emerald-500 shrink-0 mt-0.5"/>
                                                                      <span className="truncate">Final: {doc.final_destination || 'Archived'}</span>
                                                                  </span>
                                                              ) : (
                                                                  <span className="flex items-start gap-1.5 break-words">
                                                                      <AlertCircle size={14} className="text-rose-500 shrink-0 mt-0.5"/>
                                                                      <span className="truncate">Reason: {doc.remarks}</span>
                                                                  </span>
                                                              )}
                                                              <span className="hidden sm:inline text-slate-300">•</span>
                                                              <span className="flex items-start gap-1.5 break-words text-slate-500">
                                                                  <Clock size={14} className="text-slate-400 shrink-0 mt-0.5"/>
                                                                  {formatPHDateTime(doc.action_time)}
                                                              </span>
                                                          </div>
                                                      </div>

                                                      {/* RIGHT BORDERED ACTION BUTTONS */}
                                                      <div className="flex gap-2 shrink-0 mt-2 sm:mt-0 w-full sm:w-auto">
                                                          {doc.attachment_url && (
                                                              <button 
                                                                  onClick={() => setPreviewDocUrl(doc.attachment_url as string)} 
                                                                  className="p-2 sm:p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 bg-white rounded-xl transition-all border-2 border-slate-200 hover:border-blue-200 active:scale-95 shadow-sm"
                                                                  title="View Document"
                                                              >
                                                                  <Eye size={18} className="w-4 h-4 sm:w-5 sm:h-5" />
                                                              </button>
                                                          )}
                                                          <button 
                                                              onClick={() => setTrailDoc(doc)} 
                                                              className="flex-1 sm:flex-none py-2 px-3 sm:p-2.5 text-slate-700 hover:text-blue-700 hover:bg-blue-50 bg-slate-50 rounded-xl font-bold transition-all border-2 border-slate-200 hover:border-blue-300 active:scale-95 shadow-sm flex items-center justify-center gap-1.5 text-xs sm:text-sm"
                                                          >
                                                              Track <CornerUpLeft size={16} className="w-4 h-4 sm:w-4 sm:h-4" />
                                                          </button>
                                                      </div>
                                                      
                                                  </div>
                                              ))}
                                          </div>

                                          {/* PAGINATION CONTROLS */}
                                          {totalPages > 1 && (
                                              <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                                                  <span className="text-[10px] sm:text-xs font-bold text-slate-500">
                                                      Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, docs.length)} of {docs.length}
                                                  </span>
                                                  <div className="flex gap-2">
                                                      <button 
                                                          disabled={currentPage === 1}
                                                          onClick={() => setCategoryPages(prev => ({...prev, [category]: currentPage - 1}))}
                                                          className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-[11px] sm:text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 active:scale-95 transition-all shadow-sm"
                                                      >
                                                          Prev
                                                      </button>
                                                      <button 
                                                          disabled={currentPage === totalPages}
                                                          onClick={() => setCategoryPages(prev => ({...prev, [category]: currentPage + 1}))}
                                                          className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-[11px] sm:text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 active:scale-95 transition-all shadow-sm"
                                                      >
                                                          Next
                                                      </button>
                                                  </div>
                                              </div>
                                          )}
                                      </div>
                                  )}
                              </div>
                          );
                      })}
                  </div>
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