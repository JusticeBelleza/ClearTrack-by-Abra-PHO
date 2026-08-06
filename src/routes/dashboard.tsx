import React, { useState, useEffect } from 'react';
import { 
    FileText, Activity, AlertCircle, MapPin, 
    Clock, CheckCircle, XCircle, BarChart3, ArrowRight, ArrowLeft, Check, X, Inbox, FileSearch
} from 'lucide-react';
import { useUiStore } from '../store/uiStore';
import { supabase } from '../lib/supabase';

// --- Shared Animation Styles ---
const modalAnimationStyles = `
    @keyframes customFadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes iosSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    @keyframes desktopZoomIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    @keyframes customFadeOut { from { opacity: 1; } to { opacity: 0; } }
    @keyframes iosSlideDown { from { transform: translateY(0); } to { transform: translateY(100%); } }
    @keyframes desktopZoomOut { from { transform: scale(1); opacity: 1; } to { transform: scale(0.95); opacity: 0; } }
    
    .animate-overlay-fade { animation: customFadeIn 0.5s ease-out forwards; }
    .animate-overlay-fade-out { animation: customFadeOut 0.4s ease-in forwards; }
    .animate-responsive-modal { animation: iosSlideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    .animate-responsive-modal-close { animation: iosSlideDown 0.4s cubic-bezier(0.3, 0, 0.8, 0.15) forwards; }
    
    /* Hide scrollbar for tabs on mobile */
    .scrollbar-hide::-webkit-scrollbar { display: none; }
    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }

    @media (min-width: 640px) {
        .animate-responsive-modal { animation: desktopZoomIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-responsive-modal-close { animation: desktopZoomOut 0.3s cubic-bezier(0.3, 0, 0.8, 0.15) forwards; }
    }
`;

export default function Dashboard() {
  const openCreateModal = useUiStore((state) => state.openCreateModal);
  const [userName, setUserName] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'processing' | 'rejected' | 'completed'>('processing');
  const [trailDoc, setTrailDoc] = useState<any>(null);

  // Live data states
  const [stats, setStats] = useState({ active: 0, urgent: 0, actionNeeded: 0, completed: 0 });
  const [documents, setDocuments] = useState({
      processing: [],
      rejected: [],
      completed: []
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // 1. Get current user session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // 2. Fetch real employee name from profiles table
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', session.user.id)
        .single();

      if (profile?.full_name) {
        setUserName(profile.full_name);
      }

      // 3. Fetch documents 
      const { data: docs, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && docs) {
          // 'sealed' goes to Completed Tab
          const completed = docs.filter((d: any) => d.status === 'sealed');
          
          // 'pending' WITH remarks goes to Rejected Tab (this isolates returned documents)
          const rejected = docs.filter((d: any) => d.status === 'pending' && d.remarks);
          
          // Everything else (routing, or pending without remarks) goes to Processing Tab
          const processing = docs.filter((d: any) => 
              d.status === 'routing' || (d.status === 'pending' && !d.remarks)
          );

          setDocuments({ processing, rejected, completed });
          setStats({
              active: docs.length,
              urgent: docs.filter((d: any) => d.is_urgent).length, 
              actionNeeded: rejected.length,
              completed: completed.length
          });
      }
    } catch (error) {
      console.error("Dashboard error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="mt-4 text-slate-500 font-bold">Loading Dashboard...</p>
        </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto animate-in fade-in duration-500 pb-12">
      <style>{modalAnimationStyles}</style>

      {/* Greeting & Top Stats */}
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-6 mb-2">
        <div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Welcome back, <span className="text-blue-600">{userName || 'Employee'}</span> 👋
          </h2>
          <p className="text-base sm:text-lg text-slate-600 mt-1 font-medium">Here is what is happening with your documents today.</p>
        </div>
        <button 
          onClick={openCreateModal}
          className="w-full md:w-auto px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-95 text-base flex items-center justify-center gap-2 border-2 border-blue-700"
        >
          <FileText size={20} /> Route New Document
        </button>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-5">
        <StatCard title="Active Routing" value={stats.active} icon={<Activity className="text-blue-600" />} color="bg-blue-50 border-blue-200" />
        <StatCard title="Priority / RUSH" value={stats.urgent} icon={<AlertCircle className="text-red-600" />} color="bg-red-50 border-red-200" />
        <StatCard title="Needs Action" value={stats.actionNeeded} icon={<XCircle className="text-orange-600" />} color="bg-orange-50 border-orange-200" />
        <StatCard title="Completed (30d)" value={stats.completed} icon={<CheckCircle className="text-emerald-600" />} color="bg-emerald-50 border-emerald-200" />
      </div>

      {/* My Documents Section */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                <BarChart3 className="text-slate-500" /> My Documents
            </h3>
        </div>

        {/* High-Contrast Tabs */}
        <div className="flex flex-nowrap overflow-x-auto scrollbar-hide gap-2 sm:gap-3 mb-6 bg-white p-2 rounded-2xl border-2 border-slate-300 shadow-sm w-full sm:inline-flex sm:w-auto">
            <TabButton label="Processing" count={documents.processing.length} isActive={activeTab === 'processing'} onClick={() => setActiveTab('processing')} />
            <TabButton label="Rejected" count={documents.rejected.length} isActive={activeTab === 'rejected'} onClick={() => setActiveTab('rejected')} />
            <TabButton label="Completed" count={documents.completed.length} isActive={activeTab === 'completed'} onClick={() => setActiveTab('completed')} />
        </div>

        {/* Tab Content (Cards Grid) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            
            {/* Processing Cards */}
            {activeTab === 'processing' && documents.processing.map((doc: any) => (
                <div key={doc.id} className={`bg-white rounded-2xl border-2 ${doc.is_urgent ? 'border-red-400 shadow-md shadow-red-100' : 'border-slate-300'} p-5 flex flex-col hover:border-slate-500 transition-all animate-in fade-in zoom-in-95 relative overflow-hidden`}>
                    {doc.is_urgent && <div className="absolute top-0 left-0 w-full h-1.5 bg-red-500"></div>}
                    
                    <div className="flex justify-between items-start mb-3 mt-1">
                        <span className="text-sm font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md font-mono border border-slate-200">{doc.reference_no || doc.id}</span>
                        {doc.is_urgent && <span className="flex items-center gap-1 text-xs font-black text-red-700 bg-red-50 px-2 py-1 rounded-full border-2 border-red-200 uppercase tracking-wider animate-pulse"><AlertCircle size={14}/> RUSH</span>}
                    </div>
                    
                    <h4 className="font-black text-xl text-slate-900 mb-4 leading-tight">{doc.title || doc.subject}</h4>
                    
                    <div className="bg-slate-50 p-4 rounded-xl border-2 border-slate-200 mb-5 flex-1 space-y-3">
                        <div className="flex items-start gap-3">
                            <MapPin size={18} className="text-slate-500 mt-0.5 shrink-0" />
                            <p className="text-sm text-slate-900 font-bold leading-snug"><span className="text-slate-500 text-xs block font-bold uppercase tracking-wider mb-0.5">Currently At</span>{doc.current_location || 'Processing Office'}</p>
                        </div>
                        <div className="flex items-start gap-3">
                            <Clock size={18} className="text-slate-500 mt-0.5 shrink-0" />
                            <p className="text-sm text-slate-900 font-bold leading-snug"><span className="text-slate-500 text-xs block font-bold uppercase tracking-wider mb-0.5">Logged Date</span>{new Date(doc.created_at).toLocaleDateString()}</p>
                        </div>
                    </div>

                    <button onClick={() => setTrailDoc(doc)} className="w-full py-2.5 bg-white border-2 border-slate-400 hover:bg-slate-100 text-slate-800 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 text-sm">
                        Track Document <ArrowRight size={16} />
                    </button>
                </div>
            ))}

            {/* Rejected Cards */}
            {activeTab === 'rejected' && documents.rejected.map((doc: any) => (
                <div key={doc.id} className="bg-white rounded-2xl border-2 border-red-300 p-5 flex flex-col relative overflow-hidden animate-in fade-in zoom-in-95">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-red-500"></div>
                    
                    <div className="flex justify-between items-start mb-3 mt-1">
                        <span className="text-sm font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md font-mono border border-slate-200">{doc.reference_no || doc.id}</span>
                        <span className="text-xs font-black text-red-700 bg-red-50 px-2 py-1 rounded-full border-2 border-red-200 uppercase tracking-wider">Returned</span>
                    </div>
                    
                    <h4 className="font-black text-xl text-slate-900 mb-4 leading-tight">{doc.title || doc.subject}</h4>
                    
                    <div className="bg-red-50 p-4 rounded-xl border-2 border-red-200 mb-5 flex-1">
                        <div className="flex items-start gap-2 mb-2">
                            <XCircle size={20} className="text-red-600 shrink-0" />
                            <p className="text-sm text-red-900 font-bold">Returned Document</p>
                        </div>
                        <p className="text-sm font-medium text-red-800 leading-snug pl-7">{doc.remarks || 'Needs revision.'}</p>
                    </div>
                    
                    <button onClick={() => setTrailDoc(doc)} className="w-full py-2.5 bg-red-600 border-2 border-red-700 hover:bg-red-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 text-sm">
                        View Details & Edit
                    </button>
                </div>
            ))}

            {/* Completed Cards */}
            {activeTab === 'completed' && documents.completed.map((doc: any) => (
                <div key={doc.id} className="bg-white rounded-2xl border-2 border-emerald-300 p-5 flex flex-col relative overflow-hidden animate-in fade-in zoom-in-95">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-emerald-500"></div>
                    
                    <div className="flex justify-between items-start mb-3 mt-1">
                        <span className="text-sm font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md font-mono border border-slate-200">{doc.reference_no || doc.id}</span>
                        <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full border-2 border-emerald-200 uppercase tracking-wider">Completed</span>
                    </div>
                    
                    <h4 className="font-black text-xl text-slate-900 mb-4 leading-tight">{doc.title || doc.subject}</h4>
                    
                    <div className="bg-slate-50 p-4 rounded-xl border-2 border-slate-200 mb-5 flex-1 space-y-3">
                        <div className="flex items-start gap-3">
                            <MapPin size={18} className="text-slate-500 mt-0.5 shrink-0" />
                            <p className="text-sm text-slate-900 font-bold leading-snug"><span className="text-slate-500 text-xs block font-bold uppercase tracking-wider mb-0.5">Final Location</span>{doc.final_destination || 'Archived'}</p>
                        </div>
                        <div className="flex items-start gap-3">
                            <CheckCircle size={18} className="text-emerald-500 mt-0.5 shrink-0" />
                            <p className="text-sm text-slate-900 font-bold leading-snug"><span className="text-slate-500 text-xs block font-bold uppercase tracking-wider mb-0.5">Completed On</span>{new Date(doc.updated_at || doc.created_at).toLocaleDateString()}</p>
                        </div>
                    </div>
                    
                    <button onClick={() => setTrailDoc(doc)} className="w-full py-2.5 bg-white border-2 border-slate-400 hover:bg-slate-100 text-slate-800 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 text-sm">
                        View Record <ArrowRight size={16} />
                    </button>
                </div>
            ))}

            {/* Empty State Handle */}
            {documents[activeTab].length === 0 && (
                <div className="col-span-full bg-white border-2 border-dashed border-slate-300 rounded-3xl p-12 flex flex-col items-center justify-center text-center animate-in zoom-in-95">
                    <div className="bg-slate-50 p-4 rounded-full mb-3">
                        <Inbox size={36} className="text-slate-400" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 mb-1">No documents here</h3>
                    <p className="text-base font-medium text-slate-600 max-w-sm">You currently have no {activeTab} documents in your system feed.</p>
                </div>
            )}

        </div>
      </div>

      {trailDoc && <DigitalTrailModal doc={trailDoc} onBack={() => setTrailDoc(null)} />}
    </div>
  );
}

// --- Helper Components --- //
function StatCard({ title, value, icon, color }: any) {
    return (
        <div className={`p-4 sm:p-5 rounded-2xl border-2 flex flex-col justify-between ${color} transition-transform hover:scale-[1.02]`}>
            <div className="flex justify-between items-start mb-2">
                <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100">
                    {icon}
                </div>
            </div>
            <div>
                <h4 className="text-2xl sm:text-3xl font-black text-slate-900 leading-none mb-1">{value}</h4>
                <p className="text-xs sm:text-sm font-bold text-slate-600 uppercase tracking-wide">{title}</p>
            </div>
        </div>
    );
}

function TabButton({ label, count, isActive, onClick }: any) {
    return (
        <button 
            onClick={onClick}
            className={`flex-1 sm:flex-none shrink-0 flex items-center justify-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2.5 rounded-xl font-bold transition-all active:scale-95 text-xs sm:text-sm whitespace-nowrap ${
                isActive 
                ? 'bg-slate-900 text-white shadow-md' 
                : 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
        >
            {label} 
            <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs border ${
                isActive ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-200 border-slate-300 text-slate-700'
            }`}>
                {count}
            </span>
        </button>
    )
}

function DigitalTrailModal({ doc, onBack }: any) {
    const [isClosing, setIsClosing] = useState(false);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            onBack();
        }, 400); 
    };

    return (
        <div className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50 backdrop-blur-sm ${isClosing ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
            <div className={`bg-white w-full max-w-2xl max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden shadow-2xl rounded-t-2xl sm:rounded-2xl ${isClosing ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
                
                <div className="bg-slate-900 text-white relative flex flex-col shrink-0">
                    <div className="w-16 h-1.5 bg-white/30 rounded-full mx-auto mt-3 sm:hidden shrink-0"></div>
                    <div className="p-5 pt-3 sm:pt-6 flex items-center justify-between">
                        <button onClick={handleClose} className="p-2 -ml-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors active:scale-90">
                            <ArrowLeft size={24} />
                        </button>
                        <h3 className="font-black text-xl">Track Document</h3>
                        <div className="w-10"></div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-white">
                    <div className="mb-8 border-b-2 border-slate-100 pb-6">
                        <p className="text-sm font-bold text-slate-500 mb-1 font-mono">{doc.reference_no || doc.id}</p>
                        <p className="font-black text-xl text-slate-900 leading-tight">
                            {doc.title || doc.subject}
                        </p>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-slate-50 p-5 rounded-2xl border-2 border-slate-200 space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-slate-500 uppercase">Current Status</span>
                                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-lg font-bold text-sm">{doc.status || 'Processing'}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-slate-500 uppercase">Date Logged</span>
                                <span className="font-bold text-slate-900">{new Date(doc.created_at).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-50 p-4 sm:p-6 pb-8 sm:pb-6 border-t-2 border-slate-200 flex shrink-0">
                    <button onClick={handleClose} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all active:scale-95 text-base border-2 border-slate-900">
                        Close Tracker
                    </button>
                </div>
            </div>
        </div>
    );
}