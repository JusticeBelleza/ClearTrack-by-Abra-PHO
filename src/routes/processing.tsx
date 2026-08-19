// src/routes/processing.tsx
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, X, Activity, CornerUpLeft, RefreshCw, CheckCircle, MapPin, ChevronDown, User, Clock, Eye, UserPlus, Ban, Square, CheckSquare, AlertCircle, Plus, Layers, PenTool, Camera, Paperclip, ChevronRight, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { jsPDF } from 'jspdf';
import type { ProcessingData, DocumentItem, OptionType } from '../types/processing';
import HandoverScreen from '../components/system/HandoverScreen';
import DigitalTrailModal from '../components/system/DigitalTrailModal';
import FilePreviewModal from '../components/system/FilePreviewModal';

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
            const { data: deptEmps } = await supabase.from('employees').select('name').eq('department', empData.department);
            if (deptEmps) colleagues = deptEmps.map(e => e.name);
        }
    }

    const [docsRes, deptRes, allEmpsRes] = await Promise.all([
        supabase.from('documents').select('*').neq('status', 'sealed').neq('status', 'cancelled'),
        supabase.from('departments').select('name').order('name'),
        supabase.from('employees').select('name').order('name')
    ]);

    let processing: DocumentItem[] = [];
    let returned: DocumentItem[] = [];
    const departments = deptRes.data ? deptRes.data.map(d => ({ label: d.name, value: d.name })) : [];
    const allEmployeesList = allEmpsRes.data ? allEmpsRes.data.map(e => ({ label: e.name, value: e.name })) : [];

    if (docsRes.data) {
        const myActiveDocs = (docsRes.data as DocumentItem[]).filter((d) => {
            if (d.status === 'cancelled') return false;
            return d.created_by === currentUserId || d.assigned_clerk === currentUserName;
        });

        const sortedDocs = myActiveDocs.sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime());
        returned = sortedDocs.filter((d) => d.status === 'pending' && d.remarks);
        processing = sortedDocs.filter((d) => d.status === 'routing' || (d.status === 'pending' && !d.remarks));
    }

    return { processing, returned, departments, currentUserName, currentUserId, colleagues, allEmployeesList };
};

export default function Processing() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'processing' | 'returned'>('processing');
  const [searchQuery, setSearchQuery] = useState("");
  
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [selectedDocs, setSelectedDocs] = useState<DocumentItem[]>([]);
  
  // FAB & Batch Actions State
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [batchAction, setBatchAction] = useState<'add_step' | 'complete' | 'reject' | 'reassign' | null>(null);
  
  // Modals
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [trailDoc, setTrailDoc] = useState<DocumentItem | null>(null);
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);
  const [reassignDoc, setReassignDoc] = useState<DocumentItem | null>(null);

  const [lastViewedProcessing, setLastViewedProcessing] = useState(() => localStorage.getItem('filetrackr_viewed_processing') || '0');
  const [lastViewedReturned, setLastViewedReturned] = useState(() => localStorage.getItem('filetrackr_viewed_returned') || '0');

  const { data, isLoading, isFetching, refetch } = useQuery<ProcessingData>({
      queryKey: ['processingDocuments'],
      queryFn: fetchProcessingData,
      refetchInterval: 15000, 
  });

  // REALTIME UPDATES
  useEffect(() => {
      const channel = supabase.channel('processing-document-updates')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, () => {
              queryClient.invalidateQueries({ queryKey: ['processingDocuments'] });
          }).subscribe();
      return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const documents = useMemo(() => data ? { processing: data.processing, returned: data.returned } : { processing: [], returned: [] }, [data]);
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

  const nestedProcessingGroups = useMemo(() => {
      if (activeTab !== 'processing') return [];
      const hierarchy: Record<string, Record<string, DocumentItem[]>> = {};
      filteredDocs.forEach((doc: DocumentItem) => {
          const dest = doc.final_destination || 'Unspecified Destination';
          const clerk = doc.assigned_clerk || 'Unassigned';
          if (!hierarchy[dest]) hierarchy[dest] = {};
          if (!hierarchy[dest][clerk]) hierarchy[dest][clerk] = [];
          hierarchy[dest][clerk].push(doc);
      });
      return Object.entries(hierarchy).sort(([destA], [destB]) => destA.localeCompare(destB))
          .map(([destination, clerksMap]) => ({
              destination,
              clerks: Object.entries(clerksMap).sort(([clerkA], [clerkB]) => clerkA.localeCompare(clerkB))
          }));
  }, [filteredDocs, activeTab]);

  const clerkDocCounts = useMemo(() => {
      if (activeTab !== 'processing') return {};
      const counts: Record<string, number> = {};
      filteredDocs.forEach((doc: DocumentItem) => {
          const clerk = doc.assigned_clerk || 'Unassigned';
          counts[clerk] = (counts[clerk] || 0) + 1;
      });
      return counts;
  }, [filteredDocs, activeTab]);

  const availableColleagues = useMemo(() => {
      if (!data) return [];
      if (reassignDoc) return data.colleagues.filter((name: string) => name !== reassignDoc.assigned_clerk);
      return data.colleagues;
  }, [data, reassignDoc]);

  // Security check for batch processing
  const canProcessBatch = useMemo(() => {
      return selectedDocs.every((doc) => doc.assigned_clerk === data?.currentUserName);
  }, [selectedDocs, data?.currentUserName]);

  useEffect(() => { setSelectedDocs([]); setIsFabOpen(false); }, [activeTab, searchQuery]);

  const newProcessingCount = useMemo(() => documents.processing.filter((d: DocumentItem) => new Date(d.updated_at || d.created_at).getTime() > Number(lastViewedProcessing)).length, [documents.processing, lastViewedProcessing]);
  const newReturnedCount = useMemo(() => documents.returned.filter((d: DocumentItem) => new Date(d.updated_at || d.created_at).getTime() > Number(lastViewedReturned)).length, [documents.returned, lastViewedReturned]);

  useEffect(() => {
      if (activeTab === 'processing' && documents.processing.length > 0) {
          const newest = Math.max(...documents.processing.map((d: DocumentItem) => new Date(d.updated_at || d.created_at).getTime()));
          if (newest > Number(lastViewedProcessing)) { localStorage.setItem('filetrackr_viewed_processing', newest.toString()); setLastViewedProcessing(newest.toString()); }
      }
      if (activeTab === 'returned' && documents.returned.length > 0) {
          const newest = Math.max(...documents.returned.map((d: DocumentItem) => new Date(d.updated_at || d.created_at).getTime()));
          if (newest > Number(lastViewedReturned)) { localStorage.setItem('filetrackr_viewed_returned', newest.toString()); setLastViewedReturned(newest.toString()); }
      }
  }, [activeTab, documents.processing, documents.returned, lastViewedProcessing, lastViewedReturned]);

  if (isLoading) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[50vh]">
              <div className="w-10 h-10 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin"></div>
              <p className="mt-4 text-slate-500 font-bold">Loading Your Documents...</p>
          </div>
      );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500 pb-28 relative">
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
                    type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by Title, ID, Location, or Assigned Name..." 
                    className="w-full pl-10 sm:pl-11 pr-10 py-2.5 sm:py-3 rounded-xl border border-slate-300 focus:bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 outline-none font-semibold text-slate-800 placeholder:text-slate-400 transition-all text-sm sm:text-[15px] shadow-sm bg-white" 
                  />
                  {searchQuery && (
                      <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all active:scale-90"><X className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={3} /></button>
                  )}
              </div>
              <button 
                  onClick={() => refetch()} disabled={isFetching}
                  className="p-2.5 sm:py-3 sm:px-4 bg-white border border-slate-300 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-teal-600 shadow-sm transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 shrink-0"
              >
                  <RefreshCw size={18} className={isFetching ? "animate-spin text-teal-600" : ""} />
                  <span className="hidden sm:inline font-bold text-sm">Refresh</span>
              </button>
          </div>

          <div className="flex flex-nowrap overflow-x-auto scrollbar-hide gap-2 sm:gap-3 w-full">
              <TabButton 
                label="Active Routing" icon={<Activity size={20} strokeWidth={activeTab === 'processing' ? 3 : 2} />} count={documents.processing.length} newCount={newProcessingCount}
                isActive={activeTab === 'processing'} onClick={() => { setActiveTab('processing'); setSearchQuery(''); }} 
                colorClass="bg-teal-600 text-white" badgeClass="bg-teal-500 text-white border-teal-400"
              />
              <TabButton 
                label="Action Needed" icon={<CornerUpLeft size={20} strokeWidth={activeTab === 'returned' ? 3 : 2} />} count={documents.returned.length} newCount={newReturnedCount}
                isActive={activeTab === 'returned'} onClick={() => { setActiveTab('returned'); setSearchQuery(''); }} 
                colorClass="bg-amber-600 text-white" badgeClass="bg-amber-500 text-white border-amber-400"
              />
          </div>
      </div>

      <div key={activeTab} className="animate-in fade-in zoom-in-[0.97] duration-300 ease-out fill-mode-both">
          {filteredDocs.length === 0 && (
              <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-10 flex flex-col items-center justify-center text-center">
                  <div className="bg-white p-4 border-2 border-slate-100 rounded-xl mb-4 shadow-sm">
                    {activeTab === 'processing' ? <Search size={36} className="text-slate-400" /> : <CheckCircle size={36} className="text-emerald-500" />}
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mb-2">{activeTab === 'processing' ? 'No documents found' : 'Inbox Zero!'}</h3>
                  <p className="text-base font-medium text-slate-500 max-w-md">{activeTab === 'processing' ? 'You currently have no active documents assigned to you.' : 'You have no returned documents requiring your attention. Great job!'}</p>
              </div>
          )}

          {filteredDocs.length > 0 && activeTab === 'processing' ? (
              <div className="space-y-12">
                  {nestedProcessingGroups.map(({ destination, clerks }) => (
                      <div key={destination} className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                          <div className="flex items-center gap-3 mb-4 mt-6">
                              <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                                  <MapPin size={12} className="text-teal-600" />
                                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{destination}</span>
                              </div>
                              <div className="h-px bg-slate-200 flex-1"></div>
                          </div>
                          
                          <div className="space-y-6 pl-1 sm:pl-2">
                              {clerks.map(([clerkName, clerkDocs]) => (
                                  <div key={clerkName} className="space-y-3">
                                      <div className="flex items-center gap-2 pl-1">
                                          <span className="text-[10px] font-bold text-slate-400">({clerkDocs.length}) managed by {clerkName}</span>
                                          <div className="h-px bg-slate-200/80 flex-1"></div>
                                      </div>

                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                                          {clerkDocs.map(doc => (
                                              <DocumentCard 
                                                key={doc.id} doc={doc} isSelected={selectedDocs.some(d => d.id === doc.id)}
                                                isExpanded={!!expandedCards[doc.id]} showCheckbox={clerkDocCounts[doc.assigned_clerk || 'Unassigned'] > 1 && (!selectedDocs.length || selectedDocs[0].assigned_clerk === (doc.assigned_clerk || 'Unassigned'))}
                                                currentUserName={data?.currentUserName || ''} currentUserId={data?.currentUserId || ''}
                                                onToggleSelection={(d: DocumentItem) => setSelectedDocs((prev: DocumentItem[]) => prev.some((x: DocumentItem) => x.id === d.id) ? prev.filter((x: DocumentItem) => x.id !== d.id) : [...prev, d])}
                                                onToggleCollapse={(id: string) => setExpandedCards((prev: Record<string, boolean>) => ({...prev, [id]: !prev[id]}))}
                                                onPreview={(url: string) => setPreviewDocUrl(url)} onTrack={(d: DocumentItem) => setTrailDoc(d)}
                                                onReassign={(d: DocumentItem) => setReassignDoc(d)} onAction={(d: DocumentItem) => setSelectedDoc(d)}
                                              />
                                          ))}
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
                      {filteredDocs.map((doc: DocumentItem) => (
                          <DocumentCard 
                            key={doc.id} doc={doc} isSelected={selectedDocs.some(d => d.id === doc.id)}
                            isExpanded={!!expandedCards[doc.id]} showCheckbox={clerkDocCounts[doc.assigned_clerk || 'Unassigned'] > 1 && (!selectedDocs.length || selectedDocs[0].assigned_clerk === (doc.assigned_clerk || 'Unassigned'))}
                            currentUserName={data?.currentUserName || ''} currentUserId={data?.currentUserId || ''}
                            onToggleSelection={(d: DocumentItem) => setSelectedDocs((prev: DocumentItem[]) => prev.some((x: DocumentItem) => x.id === d.id) ? prev.filter((x: DocumentItem) => x.id !== d.id) : [...prev, d])}
                            onToggleCollapse={(id: string) => setExpandedCards((prev: Record<string, boolean>) => ({...prev, [id]: !prev[id]}))}
                            onPreview={(url: string) => setPreviewDocUrl(url)} onTrack={(d: DocumentItem) => setTrailDoc(d)}
                            onReassign={(d: DocumentItem) => setReassignDoc(d)} onAction={(d: DocumentItem) => setSelectedDoc(d)}
                          />
                      ))}
                  </div>
              )
          )}
      </div>

      {/* FAB & POPOVER MENU */}
      {activeTab === 'processing' && (
          <div 
              className={`fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-[100] flex flex-col items-end transition-all duration-500 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] ${
                  selectedDocs.length > 0 
                      ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' 
                      : 'opacity-0 scale-50 translate-y-12 pointer-events-none'
              }`}
          >
              
              {/* Popover Menu with Slide Up/Down Animation */}
              <div 
                  className={`absolute bottom-[100%] right-0 mb-4 bg-white p-2 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-100 flex flex-col gap-1 w-56 origin-bottom transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                      isFabOpen && selectedDocs.length > 0
                          ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto' 
                          : 'opacity-0 translate-y-4 scale-95 pointer-events-none'
                  }`}
              >
                  {!canProcessBatch && (
                      <div className="p-2.5 mb-1 bg-amber-50 rounded-xl border border-amber-100">
                          <p className="text-[10px] text-amber-800 font-bold leading-tight">
                              Batch contains documents managed by others. Only Re-assign is allowed.
                          </p>
                      </div>
                  )}

                  {canProcessBatch && <MenuButton icon={<MapPin size={18}/>} label="Route Document" onClick={() => setBatchAction('add_step')} />}
                  {canProcessBatch && <MenuButton icon={<CheckCircle size={18}/>} label="Complete Batch" onClick={() => setBatchAction('complete')} />}
                  
                  <MenuButton icon={<UserPlus size={18}/>} label="Re-assign Batch" onClick={() => setBatchAction('reassign')} />
                  
                  {canProcessBatch && <MenuButton icon={<Ban size={18}/>} label="Reject / Return" onClick={() => setBatchAction('reject')} />}
                  
                  <div className="h-px bg-slate-100 my-1 mx-2"></div>
                  <MenuButton icon={<X size={18}/>} label="Clear Selection" colorTheme="slate" onClick={() => { setSelectedDocs([]); setIsFabOpen(false); }} />
              </div>

              {/* Floating Action Button with Icon Rotation */}
              <button 
                  onClick={() => setIsFabOpen(!isFabOpen)}
                  className="relative flex items-center justify-center w-14 h-14 bg-teal-700 hover:bg-teal-800 text-white rounded-[1.25rem] shadow-lg shadow-teal-900/30 transition-all active:scale-95 z-10"
              >
                  <div className="relative flex items-center justify-center w-full h-full">
                      <Plus 
                          size={28} 
                          strokeWidth={2.5} 
                          className={`absolute transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                              isFabOpen ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'
                          }`} 
                      />
                      <X 
                          size={24} 
                          strokeWidth={2.5} 
                          className={`absolute transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                              isFabOpen ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'
                          }`} 
                      />
                  </div>
                  
                  {/* Badge scales down when menu is open or fading out */}
                  <span 
                      className={`absolute -top-2 -right-2 bg-rose-500 text-white text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full shadow-sm ring-2 ring-white transition-all duration-300 ${
                          isFabOpen || selectedDocs.length === 0 ? 'scale-0 opacity-0' : 'scale-100 opacity-100 delay-100'
                      }`}
                  >
                      {selectedDocs.length}
                  </span>
              </button>
          </div>
      )}

      {batchAction && (
          <BatchActionModal 
            selectedDocs={selectedDocs} 
            initialAction={batchAction}
            currentUserId={data?.currentUserId || ''} 
            currentUserName={data?.currentUserName || ''}
            departments={departments} 
            colleagues={availableColleagues} 
            onClose={() => { setBatchAction(null); setIsFabOpen(false); }}
            onSuccess={() => { setSelectedDocs([]); setBatchAction(null); setIsFabOpen(false); refetch(); }}
          />
      )}

      {selectedDoc && <HandoverScreen doc={selectedDoc} departments={departments} onBack={() => setSelectedDoc(null)} onSuccess={() => refetch()} />}
      {trailDoc && <DigitalTrailModal doc={trailDoc} onBack={() => setTrailDoc(null)} />}
      {previewDocUrl && <FilePreviewModal url={previewDocUrl} onClose={() => setPreviewDocUrl(null)} />}
      
      {/* Inline Fallback Modals (Reassign) */}
      {reassignDoc && <ReassignModal doc={reassignDoc} currentUserName={data?.currentUserName || ''} currentUserId={data?.currentUserId || ''} colleagues={availableColleagues} onClose={() => setReassignDoc(null)} onSuccess={() => refetch()} />}
    </div>
  );
}

// ==========================================
// INLINE COMPONENTS WITH STRICT TYPING
// ==========================================

function MenuButton({ icon, label, onClick, colorTheme = 'teal' }: { icon: React.ReactNode, label: string, onClick: () => void, colorTheme?: 'teal' | 'slate' }) {
    const colors = {
        teal: 'bg-teal-50 text-teal-700',
        slate: 'bg-slate-100 text-slate-700'
    };
    const activeColor = colors[colorTheme] || colors.teal;
    
    return (
        <button onClick={onClick} className="flex items-center gap-3 p-2 w-full hover:bg-slate-50 rounded-xl transition-colors text-left active:scale-[0.98]">
            <div className={`p-2 rounded-[0.8rem] ${activeColor}`}>
                {icon}
            </div>
            <span className="font-bold text-slate-800 text-sm">{label}</span>
        </button>
    );
}

function TabButton({ label, icon, count, isActive, onClick, colorClass, badgeClass, newCount = 0 }: { label: string, icon: React.ReactNode, count: number, isActive: boolean, onClick: () => void, colorClass: string, badgeClass: string, newCount?: number }) {
    return (
        <button 
            onClick={onClick} title={label}
            className={`relative flex-none shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-95 active:shadow-inner text-sm whitespace-nowrap overflow-hidden border-2 ${isActive ? `${colorClass} border-transparent shadow-sm` : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700'}`}
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
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] border ${isActive ? badgeClass : 'bg-slate-100 border-slate-200 text-slate-600'}`}>{count}</span>
                {newCount > 0 && !isActive && <span className="text-[9px] font-black text-white bg-red-500 px-1.5 py-0.5 rounded shadow-sm animate-in zoom-in flex items-center">{newCount} NEW</span>}
            </div>
        </button>
    );
}

function CustomSelect({ options, value, onChange, placeholder, disabled = false, emptyText = "Loading options...", isRelative = false }: { options: OptionType[], value: string, onChange: (val: string) => void, placeholder?: string, disabled?: boolean, emptyText?: string, isRelative?: boolean }) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      function handleClickOutside(event: MouseEvent) { if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false); }
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredOptions = options.filter((opt: OptionType) => {
        const optLabel = typeof opt === 'string' ? opt : opt.label;
        return optLabel.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const selectedOptionLabel = options.find((opt: OptionType) => (typeof opt === 'string' ? opt : opt.value) === value);
    const displayLabel = selectedOptionLabel ? (typeof selectedOptionLabel === 'string' ? selectedOptionLabel : selectedOptionLabel.label) : placeholder;
 
    return (
      <div className="relative w-full" ref={dropdownRef}>
        <button type="button" disabled={disabled} onClick={() => !disabled && setIsOpen(!isOpen)} className={`w-full px-4 py-3.5 bg-slate-50/50 focus:bg-white border focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 rounded-xl flex justify-between items-center transition-all text-sm outline-none active:scale-[0.99] ${isOpen ? 'border-teal-500 bg-white ring-4 ring-teal-500/10' : 'border-slate-200 hover:bg-white hover:border-slate-300'} ${!value ? 'text-slate-500 font-medium' : 'text-slate-700 font-bold'}`}>
          <span className="truncate">{displayLabel}</span>
          <ChevronDown size={20} className={`text-slate-400 transition-transform duration-300 ease-in-out sm:w-5 sm:h-5 ${isOpen ? 'rotate-180 text-slate-800' : ''}`} />
        </button>
        {isOpen && !disabled && (
          <div className={`${isRelative ? 'relative mt-2 mb-4' : 'absolute mt-1.5'} z-50 w-full bg-white border border-slate-200 rounded-xl shadow-xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200`}>
            {options.length > 5 && (
                <div className="p-2 border-b border-slate-100 bg-slate-50 shrink-0">
                    <div className="relative">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="text" placeholder="Type to search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onClick={(e) => e.stopPropagation()} className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all font-medium text-slate-800 placeholder:text-slate-400" />
                    </div>
                </div>
            )}
            <div className="max-h-[240px] overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
              {filteredOptions.length === 0 ? <div className="px-4 py-6 text-sm text-slate-500 text-center font-medium">{emptyText}</div> : filteredOptions.map((option: OptionType, idx: number) => {
                    const optValue = typeof option === 'string' ? option : option.value;
                    const optLabel = typeof option === 'string' ? option : option.label;
                    return <div key={idx} onClick={() => { onChange(optValue); setIsOpen(false); }} className={`px-4 py-3 text-sm rounded-lg cursor-pointer transition-colors flex items-center active:scale-95 ${optValue === value ? 'bg-teal-600 text-white font-bold shadow-sm' : 'text-slate-700 hover:bg-slate-100 font-medium'}`}>{optLabel}</div>
              })}
            </div>
          </div>
        )}
      </div>
    );
}

function DocumentCard({ doc, isSelected, isExpanded, showCheckbox, currentUserName, currentUserId, onToggleSelection, onToggleCollapse, onPreview, onTrack, onReassign, onAction }: { doc: DocumentItem, isSelected: boolean, isExpanded: boolean, showCheckbox: boolean, currentUserName: string, currentUserId: string, onToggleSelection: (d: DocumentItem) => void, onToggleCollapse: (id: string) => void, onPreview: (url: string) => void, onTrack: (d: DocumentItem) => void, onReassign: (d: DocumentItem) => void, onAction: (d: DocumentItem) => void }) {
    const isManager = doc.assigned_clerk === currentUserName;
    const isCreator = doc.created_by === currentUserId;
    const canReassign = isManager || isCreator;
    
    return (
        <div className={`bg-white rounded-2xl border-2 transition-all relative overflow-hidden ${doc.is_urgent ? 'border-red-300 shadow-sm hover:border-red-400' : (isSelected ? 'border-teal-500 ring-4 ring-teal-500/10' : 'border-slate-200 hover:border-slate-300')}`}>
            <div className={`absolute top-0 left-0 w-full h-1 ${doc.is_urgent ? 'bg-red-600' : (isSelected ? 'bg-teal-500' : 'bg-transparent')}`}></div>
            <div onClick={() => onToggleCollapse(doc.id)} className="p-4 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-50/70 transition-colors">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    {showCheckbox && (
                        <button type="button" onClick={(e) => { e.stopPropagation(); onToggleSelection(doc); }} className={`p-1 rounded-lg transition-all border-2 shrink-0 ${isSelected ? 'bg-teal-600 text-white border-teal-600 shadow-sm' : 'bg-white text-slate-300 border-slate-200 hover:text-slate-500 hover:border-slate-300'}`}>
                            {isSelected ? <CheckSquare size={16} strokeWidth={2.5} /> : <Square size={16} strokeWidth={2.5} />}
                        </button>
                    )}
                    <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 shrink-0">{doc.reference_no || doc.id.substring(0, 8)}</span>
                            {doc.is_urgent && <span className="flex items-center gap-0.5 text-[9px] font-black text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-200 uppercase tracking-wider animate-pulse shrink-0"><AlertCircle size={10} strokeWidth={3}/> Rush</span>}
                        </div>
                        <h4 className="font-bold text-slate-900 text-sm sm:text-base leading-snug truncate">{doc.title || doc.subject}</h4>
                    </div>
                </div>
                <ChevronDown size={18} className={`text-slate-400 shrink-0 transition-transform duration-200 ease-in-out ${isExpanded ? 'rotate-180 text-teal-600' : ''}`} />
            </div>
            <div className={`grid transition-[grid-template-rows,opacity] duration-[400ms] ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                    <div className="p-4 pt-1 border-t border-slate-100 bg-white space-y-4">
                        <div className="flex items-center gap-1.5 pt-1">
                            <User size={13} className="text-slate-400 shrink-0" />
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Managed by: <span className="text-slate-800">{doc.assigned_clerk || 'Unassigned'}</span></p>
                        </div>
                        <div className="p-3.5 rounded-xl border border-slate-200 space-y-2.5 bg-slate-50">
                            <div className="flex items-start gap-2">
                                <MapPin size={15} className="text-slate-400 mt-0.5 shrink-0" />
                                <p className="text-xs sm:text-sm text-slate-900 font-bold leading-snug"><span className="text-slate-500 text-[10px] block font-bold uppercase tracking-wider mb-0.5">Current Location</span>{doc.current_location || 'Processing'}</p>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2 pt-1">
                            <div className="flex gap-2">
                                {doc.attachment_url && <button onClick={() => onPreview(doc.attachment_url as string)} className="shrink-0 py-2 px-3 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl flex items-center justify-center transition-all active:scale-95 border-2 border-slate-300 shadow-sm"><Eye size={16} /></button>}
                                <button onClick={() => onTrack(doc)} className="flex-1 py-2 px-2 bg-white hover:bg-slate-50 text-slate-800 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 text-xs sm:text-sm border-2 border-slate-300 shadow-sm"><Clock size={14} /> Track</button>
                                {canReassign && <button onClick={() => onReassign(doc)} className="flex-1 py-2 px-2 bg-white hover:bg-slate-50 text-slate-800 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 text-xs sm:text-sm border-2 border-slate-300 shadow-sm"><UserPlus size={14} /> Re-assign</button>}
                            </div>
                            {isManager ? (
                                <button onClick={() => onAction(doc)} className="w-full py-2.5 px-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 text-xs sm:text-sm shadow-sm">Action <ChevronRight size={15} /></button>
                            ) : (
                                <div className="w-full py-2 px-3 bg-slate-100 border border-slate-200 rounded-xl text-center"><p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pending action by {doc.assigned_clerk}</p></div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function BatchActionModal({ selectedDocs, initialAction, currentUserId, currentUserName, departments, colleagues, onClose, onSuccess }: { selectedDocs: DocumentItem[], initialAction: 'add_step' | 'complete' | 'reject' | 'reassign', currentUserId: string, currentUserName: string, departments: OptionType[], colleagues: string[], onClose: () => void, onSuccess: () => void }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawingRef = useRef(false);
    const [isClosing, setIsClosing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [activeAction] = useState<'add_step' | 'complete' | 'reject' | 'reassign'>(initialAction);
    
    const [hasSignature, setHasSignature] = useState(false);
    const [destination, setDestination] = useState('');
    const [receivingClerk, setReceivingClerk] = useState('');
    const [remarks, setRemarks] = useState('');
    const [rejectOffice, setRejectOffice] = useState('');
    const [selectedColleague, setSelectedColleague] = useState('');
    const [releasedBy, setReleasedBy] = useState('');
    const [retentionFate, setRetentionFate] = useState<'originator' | 'destination' | null>(null);
    const [isProcessingFile, setIsProcessingFile] = useState(false);
    const [attachment, setAttachment] = useState<File | Blob | null>(null);
    const [attachmentName, setAttachmentName] = useState<string>('');

    const handleClose = () => { setIsClosing(true); setTimeout(onClose, 300); };

    useEffect(() => {
        if (activeAction !== 'add_step' && activeAction !== 'complete') return;
        const timer = setTimeout(() => {
            const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext('2d'); if (!ctx) return;
            ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            const getCoordinates = (e: MouseEvent | TouchEvent) => {
                const rect = canvas.getBoundingClientRect(); const scaleX = canvas.width / rect.width; const scaleY = canvas.height / rect.height;
                const clientX = e.type.includes('touch') ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
                const clientY = e.type.includes('touch') ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
                return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
            };
            const startDrawing = (e: MouseEvent | TouchEvent) => { e.preventDefault(); isDrawingRef.current = true; setHasSignature(true); const { x, y } = getCoordinates(e); ctx.beginPath(); ctx.moveTo(x, y); };
            const draw = (e: MouseEvent | TouchEvent) => { if (!isDrawingRef.current) return; e.preventDefault(); const { x, y } = getCoordinates(e); ctx.lineTo(x, y); ctx.stroke(); };
            const stopDrawing = () => { isDrawingRef.current = false; ctx.closePath(); };
            canvas.addEventListener('mousedown', startDrawing); canvas.addEventListener('mousemove', draw); canvas.addEventListener('mouseup', stopDrawing); canvas.addEventListener('mouseout', stopDrawing);
            canvas.addEventListener('touchstart', startDrawing, { passive: false }); canvas.addEventListener('touchmove', draw, { passive: false }); canvas.addEventListener('touchend', stopDrawing);
            return () => { canvas.removeEventListener('mousedown', startDrawing); canvas.removeEventListener('mousemove', draw); canvas.removeEventListener('mouseup', stopDrawing); canvas.removeEventListener('mouseout', stopDrawing); canvas.removeEventListener('touchstart', startDrawing); canvas.removeEventListener('touchmove', draw); canvas.removeEventListener('touchend', stopDrawing); };
        }, 50);
        return () => clearTimeout(timer);
    }, [activeAction]);

    const clearSignature = () => { const canvas = canvasRef.current; if(canvas) { canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height); setHasSignature(false); } };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return; setIsProcessingFile(true); setAttachmentName("Processing file...");
        try {
            if (file.type === 'application/pdf') { setAttachment(file); setAttachmentName(file.name); } 
            else if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                const pdfBlob = await new Promise<Blob>((resolve, reject) => {
                    reader.onload = (event) => {
                        const img = new Image();
                        img.onload = () => {
                            const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); if (!ctx) return reject("Canvas error");
                            canvas.width = img.width; canvas.height = img.height; ctx.filter = 'grayscale(100%) contrast(150%) brightness(110%)'; ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                            const processedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                            const pdf = new jsPDF({ orientation: img.width > img.height ? 'landscape' : 'portrait', unit: 'px', format: [img.width, img.height] });
                            pdf.addImage(processedDataUrl, 'JPEG', 0, 0, img.width, img.height); resolve(pdf.output('blob'));
                        }; img.onerror = reject; img.src = event.target?.result as string;
                    }; reader.onerror = reject; reader.readAsDataURL(file);
                });
                setAttachment(pdfBlob); setAttachmentName('Batch_Completed.pdf');
            } else { toast.error("Unsupported file type."); setAttachmentName(""); }
        } catch { toast.error("Failed to process the document."); setAttachmentName(""); } finally { setIsProcessingFile(false); }
    };

    const handleBatchSubmit = async () => {
        if (activeAction === 'reject' && (!rejectOffice || !remarks.trim())) { toast.error("Validation Error", { description: "Please provide the returning office and a reason." }); return; }
        if (activeAction === 'add_step' && (!destination || !receivingClerk.trim() || !hasSignature)) { toast.error("Validation Error", { description: "Please fill all required fields and sign." }); return; }
        if (activeAction === 'complete' && (!releasedBy.trim() || !retentionFate || !hasSignature)) { toast.error("Validation Error", { description: "Please fill all required fields and sign." }); return; }
        if (activeAction === 'reassign' && !selectedColleague) { toast.error("Validation Error", { description: "Please select a colleague." }); return; }

        setIsSubmitting(true);
        try {
            const nowIso = new Date().toISOString();
            let sharedSignatureUrl = null; let sharedAttachmentUrl = null;
            if (canvasRef.current && (activeAction === 'add_step' || activeAction === 'complete')) {
                const blob = await new Promise<Blob | null>((resolve) => canvasRef.current!.toBlob(resolve, 'image/png'));
                if (blob) {
                    const fileName = `batch-signature-${Date.now()}.png`;
                    const { error } = await supabase.storage.from('attachments').upload(fileName, blob, { contentType: 'image/png' });
                    if (!error) sharedSignatureUrl = supabase.storage.from('attachments').getPublicUrl(fileName).data.publicUrl;
                }
            }
            if (attachment && activeAction === 'complete') {
                const fileName = `batch-completed-${Date.now()}.pdf`;
                const { error } = await supabase.storage.from('attachments').upload(fileName, attachment, { contentType: 'application/pdf' });
                if (!error) sharedAttachmentUrl = supabase.storage.from('attachments').getPublicUrl(fileName).data.publicUrl;
            }

            const promises = selectedDocs.map(async (doc: DocumentItem) => {
                if (activeAction === 'complete') {
                    const fateString = retentionFate === 'originator' ? 'Returned to Originator' : 'Retained at Final Destination';
                    const detailedRemarks = `Released By: ${releasedBy.trim()}\nDocument Retention: ${fateString}${remarks ? `\nRemarks: ${remarks.trim()}` : ''}`;
                    const updateData: Record<string, string | null> = { status: 'sealed', updated_at: nowIso };
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
        } catch { toast.error("An error occurred during batch processing."); } finally { setIsSubmitting(false); }
    };

    const headerConfig = {
        add_step: { title: 'Route Document Batch', color: 'bg-slate-900', icon: <MapPin size={22} className="text-teal-400" /> },
        complete: { title: 'Finalize Batch', color: 'bg-emerald-700', icon: <CheckCircle size={22} className="text-emerald-300" /> },
        reject: { title: 'Reject & Return Batch', color: 'bg-red-700', icon: <Ban size={22} className="text-red-300" /> },
        reassign: { title: 'Re-assign Batch', color: 'bg-teal-700', icon: <UserPlus size={22} className="text-teal-200" /> }
    }[activeAction] || { title: 'Batch Action', color: 'bg-slate-900', icon: <Layers size={22} className="text-slate-300"/> };

    return (
        <div className={`fixed inset-0 z-[999] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/70 backdrop-blur-sm ${isClosing ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
            <div className={`bg-white w-full max-w-xl max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden shadow-2xl rounded-t-[1.5rem] sm:rounded-3xl ${isClosing ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
                
                <div className={`text-white relative flex flex-col shrink-0 transition-colors duration-300 ${headerConfig.color}`}>
                    <div className="w-16 h-1.5 bg-white/30 rounded-full mx-auto mt-3 sm:hidden shrink-0"></div>
                    <div className="p-5 pt-3 sm:pt-6 flex items-center justify-between">
                        <div className="w-10"></div>
                        <h3 className="font-black text-xl tracking-tight absolute left-1/2 -translate-x-1/2 whitespace-nowrap flex items-center gap-2">
                            {headerConfig.icon} {headerConfig.title}
                        </h3>
                        <button onClick={handleClose} disabled={isSubmitting} className="p-2 -mr-2 bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-full transition-all active:scale-90 disabled:opacity-50">
                            <X size={24} />
                        </button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6 custom-scrollbar bg-white">
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
                    
                    <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                        {activeAction === 'add_step' && (
                            <>
                                <div className="relative z-20"><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Next Destination Office *</label><CustomSelect options={departments} value={destination} onChange={setDestination} placeholder="Select receiving office..." isRelative={true} /></div>
                                <div className="relative z-10"><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Receiving Clerk *</label><input type="text" value={receivingClerk} onChange={(e) => setReceivingClerk(e.target.value)} placeholder="Enter name of receiving clerk..." className="w-full px-4 py-3.5 bg-slate-50/50 border border-slate-200 focus:bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 rounded-xl outline-none font-bold text-slate-700 text-sm transition-all" /></div>
                                <div>
                                    <div className="flex justify-between items-center mb-1.5"><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><PenTool size={13}/> Signature *</label><button onClick={clearSignature} type="button" className="text-[11px] text-slate-600 font-bold hover:text-slate-900 transition-colors bg-white px-3 py-1.5 rounded-lg border border-slate-200 active:scale-95 shadow-sm">Clear Pad</button></div>
                                    <div className="border border-slate-200 rounded-xl bg-slate-50/50 overflow-hidden touch-none relative shadow-sm"><div className="absolute top-1/2 left-4 right-4 h-0 border-b-2 border-dashed border-slate-200 pointer-events-none"></div><canvas ref={canvasRef} width={600} height={200} className="w-full h-[180px] sm:h-[200px] cursor-crosshair bg-transparent relative z-10" style={{ touchAction: 'none' }} /></div>
                                </div>
                            </>
                        )}
                        {activeAction === 'complete' && (
                            <>
                                <div><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Scanned Signed Copy (Optional)</label><label className={`w-full flex items-center justify-center gap-2 p-3.5 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${attachment ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}><input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} disabled={isProcessingFile} />{isProcessingFile ? <span className="animate-pulse font-bold text-sm">Processing...</span> : attachment ? <><CheckCircle size={18}/> <span className="font-bold text-sm truncate max-w-[200px]">{attachmentName}</span></> : <><Camera size={18}/> <span className="font-bold text-sm">Scan Signed Document</span></>}</label>{attachment && !isProcessingFile && (<div className="mt-2 text-right"><button type="button" onClick={() => { setAttachment(null); setAttachmentName(''); }} className="text-xs text-red-500 font-bold hover:underline">Remove Attachment</button></div>)}</div>
                                <div><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Released By *</label><input type="text" value={releasedBy} onChange={(e) => setReleasedBy(e.target.value)} placeholder="Name of official releasing the documents..." className="w-full p-3.5 bg-slate-50/50 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-xl outline-none font-bold text-slate-700 text-sm transition-all" /></div>
                                <div>
                                    <div className="flex justify-between items-center mb-1.5"><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><PenTool size={13}/> Signature *</label><button onClick={clearSignature} type="button" className="text-[11px] text-slate-600 font-bold hover:text-slate-900 transition-colors bg-white px-3 py-1.5 rounded-lg border border-slate-200 active:scale-95 shadow-sm">Clear Pad</button></div>
                                    <div className="border border-slate-200 rounded-xl bg-slate-50/50 overflow-hidden touch-none relative shadow-sm"><div className="absolute top-1/2 left-4 right-4 h-0 border-b-2 border-dashed border-slate-200 pointer-events-none"></div><canvas ref={canvasRef} width={600} height={200} className="w-full h-[180px] sm:h-[200px] cursor-crosshair bg-transparent relative z-10" style={{ touchAction: 'none' }} /></div>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Document Retention *</label>
                                    <div className="flex flex-col gap-2">
                                        <div onClick={() => setRetentionFate('originator')} className={`p-4 border rounded-xl cursor-pointer transition-all active:scale-[0.98] flex items-center gap-3 ${retentionFate === 'originator' ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-200 bg-white hover:border-slate-300'}`}><div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${retentionFate === 'originator' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'}`}>{retentionFate === 'originator' && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}</div><p className="font-bold text-sm text-slate-700">Return to Originator</p></div>
                                        <div onClick={() => setRetentionFate('destination')} className={`p-4 border rounded-xl cursor-pointer transition-all active:scale-[0.98] flex items-center gap-3 ${retentionFate === 'destination' ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-200 bg-white hover:border-slate-300'}`}><div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${retentionFate === 'destination' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'}`}>{retentionFate === 'destination' && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}</div><p className="font-bold text-sm text-slate-700">Retain at Office</p></div>
                                    </div>
                                </div>
                            </>
                        )}
                        {activeAction === 'reject' && (
                            <>
                                <div className="relative z-20"><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Returning To Office *</label><CustomSelect options={departments} value={rejectOffice} onChange={setRejectOffice} placeholder="Select office..." isRelative={true}/></div>
                                <div className="relative z-10"><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Reason for Rejection *</label><textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="E.g., Missing signature, incorrect attachments..." className="w-full p-3.5 bg-slate-50/50 border border-slate-200 focus:bg-white focus:border-red-500 focus:ring-4 focus:ring-red-500/10 rounded-xl outline-none font-bold text-slate-700 text-sm min-h-[140px] resize-y transition-all" ></textarea></div>
                            </>
                        )}
                        {activeAction === 'reassign' && (
                            <div className="relative z-20"><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Select Colleague *</label><CustomSelect options={colleagues} value={selectedColleague} onChange={(val: string) => setSelectedColleague(val)} placeholder="Choose an employee..." emptyText="No employee found" isRelative={true} /></div>
                        )}
                    </div>
                </div>

                <div className="bg-white p-4 sm:p-5 flex shrink-0 border-t border-slate-100">
                    {activeAction === 'add_step' && <button onClick={handleBatchSubmit} disabled={isSubmitting || !destination || !receivingClerk.trim() || !hasSignature} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl shadow-sm transition-all active:scale-[0.98] text-sm flex justify-center items-center gap-2 disabled:opacity-50">{isSubmitting ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <><MapPin size={18} strokeWidth={2.5} /> Confirm Add Step</>}</button>}
                    {activeAction === 'complete' && <button onClick={handleBatchSubmit} disabled={isSubmitting || !releasedBy.trim() || !retentionFate || !hasSignature || isProcessingFile} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl shadow-sm transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2 disabled:opacity-50">{isSubmitting ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <><CheckCircle size={18} strokeWidth={2.5} /> Finalize Batch</>}</button>}
                    {activeAction === 'reject' && <button onClick={handleBatchSubmit} disabled={isSubmitting || !remarks.trim() || !rejectOffice} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl shadow-sm transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2 disabled:opacity-50">{isSubmitting ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <><Ban size={18} strokeWidth={2.5} /> Confirm Return</>}</button>}
                    {activeAction === 'reassign' && <button onClick={handleBatchSubmit} disabled={isSubmitting || !selectedColleague} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 rounded-xl shadow-sm transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2 disabled:opacity-50">{isSubmitting ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <><UserPlus size={18} strokeWidth={2.5} /> Confirm Re-assign</>}</button>}
                </div>
            </div>
        </div>
    );
}

// INLINE COMPONENT FOR RE-ASSIGNMENT OF SINGLE DOCUMENT
function ReassignModal({ doc, currentUserName, currentUserId, colleagues, onClose, onSuccess }: { doc: DocumentItem, currentUserName: string, currentUserId: string, colleagues: string[], onClose: () => void, onSuccess: () => void }) {
    const [selectedColleague, setSelectedColleague] = useState('');
    const [isReassigning, setIsReassigning] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

    const handleClose = () => { setIsClosing(true); setTimeout(onClose, 250); };
    const handleConfirm = async () => {
        if (!selectedColleague) return;
        setIsReassigning(true);
        try {
            const previousClerk = doc.assigned_clerk || 'Unassigned';
            const nowIso = new Date().toISOString();
            await supabase.from('document_logs').insert([{ document_id: doc.id, action: 'REASSIGNED', remarks: `Re-assigned from ${previousClerk} to ${selectedColleague} by ${currentUserName || 'System User'}`, location: doc.current_location || 'Processing', created_by: currentUserId }]);
            await supabase.from('documents').update({ assigned_clerk: selectedColleague, updated_at: nowIso }).eq('id', doc.id);
            toast.success(`Document re-assigned to ${selectedColleague}`);
            onSuccess(); handleClose();
        } catch { toast.error("Failed to re-assign document."); } finally { setIsReassigning(false); }
    };

    return (
        <div className={`fixed inset-0 z-[999] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50 backdrop-blur-sm ${isClosing ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
            <div className={`bg-white w-full max-w-md flex flex-col shadow-2xl rounded-t-[1.5rem] sm:rounded-3xl ${isClosing ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
                <div className="bg-slate-900 p-5 sm:p-6 flex justify-between items-center text-white relative shrink-0 rounded-t-[1.5rem] sm:rounded-t-3xl z-20">
                    <div className="w-12 h-1.5 bg-white/30 rounded-full mx-auto absolute top-2 left-1/2 -translate-x-1/2 sm:hidden"></div>
                    <h3 className="font-black text-xl flex items-center gap-2 mt-2 sm:mt-0"><UserPlus size={22} className="text-teal-400" /> Re-assign</h3>
                    <button onClick={handleClose} className="p-1.5 hover:bg-white/20 rounded-full transition-colors active:scale-95 mt-2 sm:mt-0"><X size={20} /></button>
                </div>
                <div className="p-5 sm:p-6 space-y-5 bg-slate-50 flex-1 relative z-10 overflow-y-auto custom-scrollbar">
                    <div className="bg-white border-2 border-slate-200 p-4 rounded-xl shadow-sm">
                        <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Document ID</p>
                        <p className="font-mono text-base sm:text-lg font-black text-slate-900">{doc.reference_no || doc.id}</p>
                    </div>
                    <div className="relative z-20">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Select Colleague</label>
                        <CustomSelect options={colleagues} value={selectedColleague} onChange={(val: string) => setSelectedColleague(val)} placeholder={colleagues.length === 0 ? "No other colleagues available" : "Choose an employee..."} emptyText="No employee found" isRelative={true} />
                    </div>
                </div>
                <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex gap-3 shrink-0 relative z-0 sm:rounded-b-3xl">
                    <button onClick={handleClose} className="flex-1 py-3.5 bg-white border-2 border-slate-300 hover:bg-slate-50 rounded-xl font-bold text-slate-700 transition-all active:scale-95 text-sm sm:text-base">Cancel</button>
                    <button onClick={handleConfirm} disabled={!selectedColleague || isReassigning} className="flex-[1.5] py-3.5 bg-teal-600 border-2 border-teal-700 text-white rounded-xl font-bold shadow-sm hover:bg-teal-700 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex justify-center items-center gap-2 text-sm sm:text-base">{isReassigning ? 'Updating...' : 'Confirm Re-assign'}</button>
                </div>
            </div>
        </div>
    );
}