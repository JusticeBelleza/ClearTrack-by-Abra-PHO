import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
    Search, MapPin, Clock, CheckCircle, AlertCircle, 
    Archive, FileText, X, Eye, CornerUpLeft, Ban, ChevronDown, FolderTree, User
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
    creator_name?: string; // New field to hold the mapped profile name
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

    // Fetch documents AND profiles simultaneously so we can map IDs to actual names
    const [docsRes, profilesRes] = await Promise.all([
        supabase.from('documents')
            .select(`
                *,
                document_logs (
                    action,
                    created_at
                )
            `)
            .in('status', ['sealed', 'cancelled']),
        supabase.from('profiles').select('id, full_name')
    ]);

    if (docsRes.error) throw docsRes.error;

    // Create a dictionary to quickly look up a user's name by their ID
    const creatorMap: Record<string, string> = {};
    if (profilesRes.data) {
        profilesRes.data.forEach((p: any) => {
            creatorMap[p.id] = p.full_name;
        });
    }

    const rawDocs = docsRes.data || [];

    let completed: DocumentItem[] = [];
    let cancelled: DocumentItem[] = [];

    if (rawDocs.length > 0) {
        const myRelevantDocs = (rawDocs as DocumentItem[]).filter((d) => 
            d.created_by === currentUserId
        );

        const processedDocs = myRelevantDocs.map((doc) => {
            const logs = doc.document_logs || [];
            
            // Map the UUID to the real name
            doc.creator_name = creatorMap[doc.created_by || ''] || 'System User';
            
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

  // --- Accordion & Pagination State ---
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [categoryPages, setCategoryPages] = useState<Record<string, number>>({});
  
  // Collapsible cards state
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

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

  const toggleCardCollapse = (docId: string) => {
      setExpandedCards(prev => ({
          ...prev,
          [docId]: !prev[docId]
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

      {/* Flat Search & Filters */}
      <div className="flex flex-col gap-4 mb-8">
          <div className="relative w-full">
              <Search className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 sm:w-6 sm:h-6" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search archives by Title, ID, Category, or Location..." 
                className="w-full pl-11 sm:pl-14 pr-11 sm:pr-14 py-3 sm:py-4 rounded-xl border-2 border-slate-300 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none font-bold text-slate-900 placeholder:text-slate-400 transition-all text-base sm:text-lg shadow-sm bg-slate-50" 
              />
              {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery("")} 
                    className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 p-1 sm:p-1.5 text-slate-400 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-full transition-all duration-200 active:scale-90"
                  >
                      <X className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={3} />
                  </button>
              )}
          </div>

          <div className="flex flex-nowrap overflow-x-auto scrollbar-hide gap-2 sm:gap-3 w-full mt-2">
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
              <div className="bg-slate-50 border-2 border-slate-200 rounded-3xl p-10 flex flex-col items-center justify-center text-center">
                  <div className="bg-white p-4 border-2 border-slate-100 rounded-full mb-4 shadow-sm">
                    <FileText size={36} className="text-slate-400" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mb-2">No records found</h3>
                  <p className="text-base font-medium text-slate-500 max-w-md">
                      We couldn't find any {activeTab} documents matching your search criteria.
                  </p>
              </div>
          ) : (
              <div className="bg-white rounded-3xl border-2 border-slate-200 shadow-sm overflow-hidden animate-in fade-in">
                  <div className="bg-slate-50 px-6 py-4 border-b-2 border-slate-200 flex justify-between items-center">
                      <h3 className="text-lg font-black text-slate-900">
                          {activeTab === 'completed' ? 'Completed Archives' : 'Voided Archives'}
                      </h3>
                  </div>
                  
                  <div className="p-4 sm:p-6 space-y-4 bg-white">
                      {groupedDocs.map(({ category, docs }) => {
                          const isCategoryExpanded = expandedCategories[category];
                          const currentPage = categoryPages[category] || 1;
                          const itemsPerPage = 5;
                          const totalPages = Math.ceil(docs.length / itemsPerPage);
                          const paginatedDocs = docs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

                          return (
                              <div key={category} className="bg-white border-2 border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 transition-colors shadow-sm">
                                  {/* MINIMAL FOLDER HEADER */}
                                  <button 
                                      onClick={() => toggleCategoryAccordion(category)}
                                      className={`w-full py-4 px-4 flex items-start sm:items-center justify-between transition-all duration-200 ease-in-out focus:outline-none group active:bg-slate-100 ${isCategoryExpanded ? 'bg-slate-50' : 'bg-transparent hover:bg-slate-50/50'}`}
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
                                          className={`shrink-0 text-slate-400 transition-transform duration-200 mt-1 sm:mt-0 ${isCategoryExpanded ? 'rotate-180 text-slate-800' : 'group-hover:text-slate-600'}`} 
                                      />
                                  </button>

                                  {/* COLLAPSIBLE CARDS CONTENT */}
                                  {isCategoryExpanded && (
                                      <div className="animate-in fade-in slide-in-from-top-1 duration-200 bg-slate-50 border-t-2 border-slate-100 p-4">
                                          <div className="flex flex-col gap-3">
                                              {paginatedDocs.map((doc) => {
                                                  const isCardExpanded = !!expandedCards[doc.id];
                                                  const themeColor = activeTab === 'completed' ? 'emerald' : 'rose';
                                                  
                                                  return (
                                                      <div key={doc.id} className="bg-white rounded-2xl border-2 border-slate-200 hover:border-slate-300 transition-all relative overflow-hidden shadow-sm">
                                                          <div className={`absolute top-0 left-0 w-1.5 h-full bg-${themeColor}-500`}></div>
                                                          
                                                          {/* CARD HEADER */}
                                                          <div 
                                                              onClick={() => toggleCardCollapse(doc.id)}
                                                              className="p-4 pl-5 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-50/70 transition-colors"
                                                          >
                                                              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                                                  <div className="flex flex-col min-w-0 flex-1">
                                                                      <div className="flex items-center gap-2 mb-0.5">
                                                                          <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 shrink-0">
                                                                              {doc.reference_no || doc.id.substring(0, 8)}
                                                                          </span>
                                                                          <span className={`flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0 text-${themeColor}-700 bg-${themeColor}-50 border-${themeColor}-200`}>
                                                                              {activeTab === 'completed' ? 'Completed' : 'Cancelled'}
                                                                          </span>
                                                                      </div>
                                                                      <h4 className="font-bold text-slate-900 text-sm sm:text-base leading-snug truncate mt-1">
                                                                          {doc.title || doc.subject}
                                                                      </h4>
                                                                  </div>
                                                              </div>

                                                              <ChevronDown 
                                                                  size={18} 
                                                                  className={`text-slate-400 shrink-0 transition-transform duration-200 ease-in-out ${isCardExpanded ? `rotate-180 text-${themeColor}-600` : ''}`} 
                                                              />
                                                          </div>
                                                          
                                                          {/* SLIDE-DOWN DETAILS */}
                                                          <div 
                                                              className={`grid transition-[grid-template-rows,opacity] duration-[400ms] ease-in-out ${
                                                                  isCardExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                                                              }`}
                                                          >
                                                              <div className="overflow-hidden">
                                                                  <div className="p-4 pl-5 pt-1 border-t border-slate-100 bg-white space-y-4">
                                                                      
                                                                      <div className="flex items-center gap-1.5 pt-1">
                                                                          <User size={13} className="text-slate-400 shrink-0" />
                                                                          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                                                              Created by: <span className="text-slate-800">{doc.creator_name}</span>
                                                                          </p>
                                                                      </div>
                                                                      
                                                                      <div className="p-3.5 rounded-xl border border-slate-200 space-y-2.5 bg-slate-50">
                                                                          {activeTab === 'completed' ? (
                                                                              <div className="flex items-start gap-2">
                                                                                  <MapPin size={15} className="text-slate-400 mt-0.5 shrink-0" />
                                                                                  <p className="text-xs sm:text-sm text-slate-900 font-bold leading-snug">
                                                                                      <span className="text-slate-500 text-[10px] block font-bold uppercase tracking-wider mb-0.5">Final Destination</span>
                                                                                      {doc.final_destination || 'Archived'}
                                                                                  </p>
                                                                              </div>
                                                                          ) : (
                                                                              <div className="flex items-start gap-2">
                                                                                  <AlertCircle size={15} className="text-rose-500 mt-0.5 shrink-0" />
                                                                                  <p className="text-xs sm:text-sm text-slate-900 font-bold leading-snug">
                                                                                      <span className="text-rose-500 text-[10px] block font-bold uppercase tracking-wider mb-0.5">Reason for Cancellation</span>
                                                                                      {doc.remarks || 'No reason provided'}
                                                                                  </p>
                                                                              </div>
                                                                          )}
                                                                          <div className="flex items-start gap-2">
                                                                              <Clock size={15} className="text-slate-400 mt-0.5 shrink-0" />
                                                                              <p className="text-xs sm:text-sm text-slate-900 font-bold leading-snug">
                                                                                  <span className="text-slate-500 text-[10px] block font-bold uppercase tracking-wider mb-0.5">
                                                                                      {activeTab === 'completed' ? 'Completed On' : 'Cancelled On'}
                                                                                  </span>
                                                                                  {formatPHDateTime(doc.action_time || doc.created_at)}
                                                                              </p>
                                                                          </div>
                                                                      </div>
                                                                      
                                                                      <div className="flex gap-2 pt-1">
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
                                                                              className="flex-1 py-2 px-2 bg-white hover:bg-slate-50 text-slate-800 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 text-xs sm:text-sm border-2 border-slate-300 shadow-sm"
                                                                          >
                                                                              <Clock size={14} /> View Digital Trail
                                                                          </button>
                                                                      </div>
                                                                  </div>
                                                              </div>
                                                          </div>
                                                      </div>
                                                  );
                                              })}
                                          </div>

                                          {/* PAGINATION CONTROLS */}
                                          {totalPages > 1 && (
                                              <div className="p-3 sm:p-4 bg-transparent mt-2 flex items-center justify-between">
                                                  <span className="text-[10px] sm:text-xs font-bold text-slate-500">
                                                      Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, docs.length)} of {docs.length}
                                                  </span>
                                                  <div className="flex gap-2">
                                                      <button 
                                                          disabled={currentPage === 1}
                                                          onClick={() => setCategoryPages(prev => ({...prev, [category]: currentPage - 1}))}
                                                          className="px-3 py-1.5 bg-white border-2 border-slate-300 text-slate-700 rounded-lg text-[11px] sm:text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-95 active:shadow-inner transition-all duration-200 ease-in-out"
                                                      >
                                                          Prev
                                                      </button>
                                                      <button 
                                                          disabled={currentPage === totalPages}
                                                          onClick={() => setCategoryPages(prev => ({...prev, [category]: currentPage + 1}))}
                                                          className="px-3 py-1.5 bg-white border-2 border-slate-300 text-slate-700 rounded-lg text-[11px] sm:text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-95 active:shadow-inner transition-all duration-200 ease-in-out"
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
            className={`flex-none shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-95 active:shadow-inner text-sm whitespace-nowrap overflow-hidden border-2 ${
                isActive ? `${colorClass} border-transparent shadow-sm` : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700'
            }`}
        >
            {icon}
            {isActive && <span className="animate-in fade-in slide-in-from-left-2 duration-200">{label}</span>}
            <span className={`px-2 py-0.5 rounded-md text-[10px] border ${isActive ? badgeClass : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
                {count}
            </span>
        </button>
    )
}