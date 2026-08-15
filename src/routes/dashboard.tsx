import React, { useState, useMemo } from 'react';
import { 
  Search, Activity, AlertCircle, MapPin, Clock, 
  ChevronRight, CheckCircle, FileText, XCircle, Eye, X, Plus,
  Inbox, CornerUpLeft, Folder, User, UserPlus
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { useUiStore } from '../store/uiStore';
import DigitalTrailModal from '../components/system/DigitalTrailModal';

// --- Import React Query ---
import { useQuery } from '@tanstack/react-query';

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
interface DocumentItem {
    id: string;
    reference_no?: string;
    title?: string;
    subject?: string;
    status: string;
    assigned_clerk?: string;
    custodian_id?: string;
    created_by?: string;
    remarks?: string;
    is_urgent?: boolean;
    current_location?: string;
    final_destination?: string;
    attachment_url?: string;
    created_at: string;
    updated_at?: string;
}

interface StatCardProps {
    title: string;
    value: number | string;
    icon: React.ReactNode;
    color: 'blue' | 'red' | 'emerald' | 'orange';
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

// --- PH Time Formatter ---
const formatPHDateTime = (isoString?: string) => {
    if (!isoString) return 'Unknown Time';
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

export default function Dashboard() {
  const openCreateModal = useUiStore((state) => state.openCreateModal);
  
  const [activeTab, setActiveTab] = useState<'assigned' | 'myDocuments' | 'processing' | 'rejected'>('assigned');
  const [searchQuery, setSearchQuery] = useState("");
  const [trailDoc, setTrailDoc] = useState<DocumentItem | null>(null);

  // =========================================
  // 🚀 REACT QUERY: FETCH DASHBOARD DATA
  // =========================================
  const { data: dashboardData, isLoading, isError } = useQuery({
    queryKey: ['dashboardData'],
    queryFn: async () => {
      // 1. Get Session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) throw new Error("Authentication required");
      const currentUserId = session.user.id;

      // 2. Fetch Profile and Documents
      const [profileRes, docsRes] = await Promise.all([
          supabase.from('profiles').select('full_name').eq('id', currentUserId).single(),
          supabase.from('documents').select('*').order('updated_at', { ascending: false })
      ]);

      if (docsRes.error) throw docsRes.error;

      const currentUserName = profileRes.data?.full_name || '';
      const firstName = currentUserName.split(' ')[0];
      const safeDocs = docsRes.data || [];

      // 3. SECURITY & CANCELLATION FIX: Filter to relevant user AND globally exclude 'cancelled' documents here
      const myRelevantDocs = safeDocs.filter((d: DocumentItem) => 
          (d.created_by === currentUserId || 
           d.assigned_clerk === currentUserName || 
           d.custodian_id === currentUserId) &&
          d.status !== 'cancelled'
      );

      // 4. Process the buckets
      const assigned = myRelevantDocs.filter((d: DocumentItem) => 
          (d.assigned_clerk === currentUserName || d.custodian_id === currentUserId) && 
          d.status !== 'sealed' &&
          !d.remarks
      );
      
      const myDocuments = myRelevantDocs.filter((d: DocumentItem) => 
          d.created_by === currentUserId && 
          d.status !== 'sealed'
      );

      const processing = myRelevantDocs.filter((d: DocumentItem) => 
          d.assigned_clerk !== currentUserName && 
          d.custodian_id !== currentUserId && 
          (d.status === 'routing' || (d.status === 'pending' && !d.remarks))
      );

      const rejected = myRelevantDocs.filter((d: DocumentItem) => 
          d.status === 'pending' && 
          !!d.remarks
      );

      const completed = myRelevantDocs.filter((d: DocumentItem) => d.status === 'sealed');

      return {
          userName: firstName,
          currentUserName: currentUserName,
          currentUserId: currentUserId,
          documents: { assigned, myDocuments, processing, rejected },
          stats: {
              active: processing.length + assigned.length, 
              urgent: myRelevantDocs.filter((d: DocumentItem) => d.is_urgent && d.status !== 'sealed').length, 
              actionNeeded: assigned.length + rejected.length, 
              completed: completed.length
          }
      };
    }
  });

  const documents = useMemo(() => {
      return dashboardData?.documents || { assigned: [], myDocuments: [], processing: [], rejected: [] };
  }, [dashboardData?.documents]);

  const stats = dashboardData?.stats || { active: 0, urgent: 0, actionNeeded: 0, completed: 0 };
  const userName = dashboardData?.userName || '';
  const currentUserName = dashboardData?.currentUserName || '';
  const currentUserId = dashboardData?.currentUserId || '';

  if (isError) {
      toast.error("Failed to sync dashboard data.");
  }

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

  if (isLoading) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[50vh]">
              <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
              <p className="mt-4 text-slate-500 font-bold">Loading Your Dashboard...</p>
          </div>
      );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500 pb-12">
      <style>{modalAnimationStyles}</style>

      {/* Flat Professional Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4 mb-6">
          <div>
              <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
                  Welcome, {userName || 'User'}! 👋
              </h1>
              <p className="text-sm sm:text-base text-slate-500 font-bold mt-1">
                  Here is the status of your assigned documents.
              </p>
          </div>

          <button 
              onClick={openCreateModal}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all active:scale-95 border-2 border-blue-600"
          >
              <Plus size={20} strokeWidth={3} />
              <span>Route Document</span>
          </button>
      </div>

      {/* Minimalist Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-8">
          <StatCard title="Active Routing" value={stats.active} icon={<Activity size={24} />} color="blue" />
          <StatCard title="Priority / Rush" value={stats.urgent} icon={<AlertCircle size={24} />} color="red" />
          <StatCard title="Action Needed" value={stats.actionNeeded} icon={<XCircle size={24} />} color="orange" />
          <StatCard title="Completed" value={stats.completed} icon={<CheckCircle size={24} />} color="emerald" />
      </div>

      {/* Flat Search & Filters */}
      <div className="flex flex-col gap-4 mb-8">
          <div className="relative w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search your documents..." 
                className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border-2 border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl outline-none font-bold text-slate-900 placeholder:text-slate-400 transition-all text-sm sm:text-base shadow-sm" 
              />
              {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery("")} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-all active:scale-90"
                  >
                      <X className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={3} />
                  </button>
              )}
          </div>

          {/* Clean Expandable Icon Tabs */}
          <div className="flex flex-nowrap overflow-x-auto scrollbar-hide gap-2 sm:gap-3 w-full">
              <TabButton 
                label="Assigned to Me" 
                icon={<Inbox size={18} strokeWidth={activeTab === 'assigned' ? 3 : 2} />}
                count={documents.assigned.length} 
                isActive={activeTab === 'assigned'} 
                onClick={() => { setActiveTab('assigned'); setSearchQuery(''); }} 
                colorClass="bg-purple-600 text-white"
                badgeClass="bg-purple-500 text-white border-purple-400"
              />
              <TabButton 
                label="My Documents" 
                icon={<Folder size={18} strokeWidth={activeTab === 'myDocuments' ? 3 : 2} />}
                count={documents.myDocuments.length} 
                isActive={activeTab === 'myDocuments'} 
                onClick={() => { setActiveTab('myDocuments'); setSearchQuery(''); }} 
                colorClass="bg-indigo-600 text-white"
                badgeClass="bg-indigo-500 text-white border-indigo-400"
              />
              <TabButton 
                label="Processing" 
                icon={<Activity size={18} strokeWidth={activeTab === 'processing' ? 3 : 2} />}
                count={documents.processing.length} 
                isActive={activeTab === 'processing'} 
                onClick={() => { setActiveTab('processing'); setSearchQuery(''); }} 
                colorClass="bg-blue-600 text-white"
                badgeClass="bg-blue-500 text-white border-blue-400"
              />
              <TabButton 
                label="Action Needed" 
                icon={<CornerUpLeft size={18} strokeWidth={activeTab === 'rejected' ? 3 : 2} />}
                count={documents.rejected.length} 
                isActive={activeTab === 'rejected'} 
                onClick={() => { setActiveTab('rejected'); setSearchQuery(''); }} 
                colorClass="bg-orange-600 text-white"
                badgeClass="bg-orange-500 text-white border-orange-400"
              />
          </div>
      </div>

      <div key={activeTab} className="animate-in fade-in zoom-in-[0.97] duration-300 ease-out fill-mode-both">
          {/* Empty State */}
          {filteredDocs.length === 0 && (
              <div className="bg-slate-50 border-2 border-slate-200 rounded-3xl p-10 flex flex-col items-center justify-center text-center">
                  <div className="bg-white p-4 rounded-full mb-4 shadow-sm border-2 border-slate-100">
                    <FileText size={32} className="text-slate-400" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mb-2">No records found</h3>
                  <p className="text-base font-medium text-slate-500 max-w-md">
                      You don't have any documents in this tab matching your criteria.
                  </p>
              </div>
          )}

          {/* Document Grid */}
          {filteredDocs.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredDocs.map((doc: DocumentItem) => {
                    const isManager = doc.assigned_clerk === currentUserName;
                    const isCreator = doc.created_by === currentUserId;
                    const canReassign = isManager || isCreator;

                    return (
                    <div key={doc.id} className={`bg-white rounded-[1.5rem] border-2 ${activeTab === 'rejected' ? 'border-orange-300 shadow-sm shadow-orange-100/50 hover:border-orange-400' : (doc.is_urgent ? 'border-red-300 shadow-sm shadow-red-100/50 hover:border-red-400' : 'border-slate-200 hover:border-slate-300')} shadow-sm p-5 flex flex-col transition-all relative overflow-hidden group`}>
                        
                        <div className={`absolute top-0 left-0 w-full h-1.5 ${activeTab === 'rejected' ? 'bg-orange-500' : (doc.is_urgent ? 'bg-red-500' : 'bg-transparent')} `}></div>
                        
                        <div className="flex justify-between items-start mb-4 mt-1">
                            <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-mono tracking-wide">{doc.reference_no || doc.id}</span>
                            
                            {activeTab === 'rejected' ? (
                                 <span className="flex items-center gap-1 text-[10px] font-black text-orange-700 bg-orange-50 px-2 py-0.5 rounded border border-orange-200 uppercase tracking-wider"><AlertCircle size={12} strokeWidth={3}/> Returned</span>
                            ) : doc.is_urgent ? (
                                 <span className="flex items-center gap-1 text-[10px] font-black text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200 uppercase tracking-wider animate-pulse"><AlertCircle size={12} strokeWidth={3}/> Rush</span>
                            ) : null}
                        </div>
                        
                        <h4 className="font-black text-lg text-slate-900 mb-2 leading-tight group-hover:text-blue-600 transition-colors">{doc.title}</h4>
                        
                        {/* ASSIGNED EMPLOYEE TAG */}
                        <div className="flex items-center gap-1.5 mb-4">
                            <User size={14} className="text-slate-400" />
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Managed by: <span className="text-blue-600">{doc.assigned_clerk || 'Unassigned'}</span></p>
                        </div>
                        
                        {/* Info Container with Borders */}
                        <div className={`p-4 rounded-xl border-2 mb-5 flex-1 space-y-3 ${activeTab === 'rejected' ? 'bg-orange-50/50 border-orange-100' : 'bg-slate-50 border-slate-200'}`}>
                            {activeTab === 'rejected' ? (
                                <>
                                    <div className="flex items-start gap-2.5">
                                        <MapPin size={16} className="text-orange-500 mt-0.5 shrink-0" />
                                        <p className="text-sm text-slate-900 font-bold leading-snug"><span className="text-orange-700/70 text-[10px] block font-bold uppercase tracking-wider mb-0.5">Returned By</span>{doc.current_location}</p>
                                    </div>
                                    <div className="flex items-start gap-2.5">
                                        <Clock size={16} className="text-orange-500 mt-0.5 shrink-0" />
                                        <p className="text-sm text-slate-900 font-bold leading-snug"><span className="text-orange-700/70 text-[10px] block font-bold uppercase tracking-wider mb-0.5">Returned On</span>{formatPHDateTime(doc.updated_at || doc.created_at)}</p>
                                    </div>
                                    <div className="flex items-start gap-2.5">
                                        <AlertCircle size={16} className="text-orange-500 mt-0.5 shrink-0" />
                                        <p className="text-sm text-slate-900 font-bold leading-snug"><span className="text-orange-700/70 text-[10px] block font-bold uppercase tracking-wider mb-0.5">Reason</span>{doc.remarks}</p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="flex items-start gap-2.5">
                                        <MapPin size={16} className="text-slate-400 mt-0.5 shrink-0" />
                                        <p className="text-sm text-slate-900 font-bold leading-snug"><span className="text-slate-500 text-[10px] block font-bold uppercase tracking-wider mb-0.5">Current Location</span>{doc.current_location || 'Processing'}</p>
                                    </div>
                                    <div className="flex items-start gap-2.5">
                                        <Clock size={16} className="text-slate-400 mt-0.5 shrink-0" />
                                        <p className="text-sm text-slate-900 font-bold leading-snug"><span className="text-slate-500 text-[10px] block font-bold uppercase tracking-wider mb-0.5">Last Update</span>{formatPHDateTime(doc.updated_at || doc.created_at)}</p>
                                    </div>
                                </>
                            )}
                        </div>
                        
                        {/* Action Buttons with defined borders */}
                        <div className="flex flex-col gap-2 mt-auto">
                            <div className="flex gap-2">
                                {doc.attachment_url && (
                                    <a 
                                        href={doc.attachment_url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="shrink-0 py-2.5 px-3 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl flex items-center justify-center transition-all active:scale-95 border-2 border-slate-300"
                                        title="View Attached File"
                                    >
                                        <Eye size={18} />
                                    </a>
                                )}
                                <button 
                                    onClick={() => setTrailDoc(doc)}
                                    className="flex-1 py-2.5 px-2 bg-white hover:bg-slate-50 text-slate-800 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 text-sm border-2 border-slate-300"
                                >
                                    <Clock size={16} /> Track
                                </button>
                                {canReassign && (
                                    <button 
                                        className="flex-1 py-2.5 px-2 bg-slate-50 hover:bg-slate-100 text-slate-800 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 text-sm border-2 border-slate-300"
                                    >
                                        <UserPlus size={16} /> Re-assign
                                    </button>
                                )}
                            </div>
                            {isManager && (
                                <button className="w-full py-2.5 px-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 text-sm border-2 border-blue-700 shadow-sm mt-1">
                                    Action <ChevronRight size={16} />
                                </button>
                            )}
                        </div>
                    </div>
                )})}
              </div>
          )}
      </div>

      {trailDoc && <DigitalTrailModal doc={trailDoc} onBack={() => setTrailDoc(null)} />}
    </div>
  );
}

// --- Helper Components ---
function StatCard({ title, value, icon, color }: StatCardProps) {
    const colorClasses = {
        blue: "bg-blue-50 border-blue-200 text-blue-600",
        red: "bg-red-50 border-red-200 text-red-600",
        emerald: "bg-emerald-50 border-emerald-200 text-emerald-600",
        orange: "bg-orange-50 border-orange-200 text-orange-600"
    };
    
    return (
        <div className="bg-white p-5 rounded-[1.5rem] border-2 border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-all hover:-translate-y-0.5 min-h-[140px]">
            <div className={`w-fit p-3 rounded-xl border-2 ${colorClasses[color]}`}>
                {icon}
            </div>
            <div className="mt-4">
                <p className="text-3xl sm:text-4xl font-black text-slate-900 leading-none">{value}</p>
                <p className="text-xs sm:text-sm font-bold text-slate-500 mt-1.5 tracking-wide">{title}</p>
            </div>
        </div>
    );
}

function TabButton({ label, icon, count, isActive, onClick, colorClass, badgeClass }: TabButtonProps) {
    return (
        <button 
            onClick={onClick}
            title={label}
            className={`flex-none shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all active:scale-95 text-sm whitespace-nowrap overflow-hidden border-2 ${
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