import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, Filter, MapPin, Calendar, Clock, 
  ArrowLeft, X, CheckCircle, XCircle, Check, FileText, ChevronLeft, ChevronRight, ArrowRight
} from 'lucide-react';

// --- Shared Animation Styles for Modals ---
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
    
    @media (min-width: 640px) {
        .animate-responsive-modal { animation: desktopZoomIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-responsive-modal-close { animation: desktopZoomOut 0.3s cubic-bezier(0.3, 0, 0.8, 0.15) forwards; }
    }
`;

// --- Expanded Mock History Data for Pagination Testing ---
const mockHistoryDocs = Array.from({ length: 15 }, (_, i) => {
    // Inject our specific scenarios at the beginning
    if (i === 0) return { id: 'DOC-2026-042', subject: 'Annual Procurement Plan 2026', originator: 'Procurement Office', finalDestination: "Provincial Administrator's Office", completedBy: 'Juan Dela Cruz', completedDate: 'Aug 2, 2026', status: 'Completed', isUrgent: false, step: 4, totalSteps: 4 };
    if (i === 1) return { id: 'DOC-2026-055', subject: 'Travel Order - Regional Health Summit', originator: 'Dr. Santos', finalDestination: "Governor's Office", completedBy: 'Maria Santos', completedDate: 'Aug 4, 2026', status: 'Completed', isUrgent: true, step: 4, totalSteps: 4 };
    if (i === 2) return { id: 'DOC-2026-071', subject: 'Leave Application - July 2026', originator: 'Sarah Lee', finalDestination: 'HRMO', completedBy: 'System Admin', completedDate: 'Aug 5, 2026', status: 'Returned', isUrgent: false, reason: 'Missing department head signature.', step: 2, totalSteps: 4 };
    
    // Generate filler data for the rest
    return {
        id: `DOC-2026-${(100 + i).toString()}`,
        subject: `Routine Financial Clearance ${i + 1}`,
        originator: ['Accounting Dept', 'HRMO', 'Health Office', 'Budget Office'][i % 4],
        finalDestination: ["Treasurer's Office", "Governor's Office", 'HRMO'][i % 3],
        completedBy: ['Juan Dela Cruz', 'Maria Santos', 'System Admin'][i % 3],
        completedDate: `Aug ${Math.max(1, i % 6)}, 2026`,
        status: i % 4 === 0 ? 'Returned' : 'Completed',
        isUrgent: i % 3 === 0,
        reason: i % 4 === 0 ? 'Missing attachments.' : undefined,
        step: i % 4 === 0 ? 2 : 4,
        totalSteps: 4
    };
});

export default function History() {
  const [trailDoc, setTrailDoc] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // --- Pagination State ---
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Track window resize to toggle between 4 (mobile) and 12 (desktop)
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const itemsPerPage = isMobile ? 4 : 12;

  // Reset to page 1 whenever the user types a new search
  useEffect(() => {
      setCurrentPage(1);
  }, [searchQuery, itemsPerPage]);

  // --- Enterprise Auto-Filter Logic ---
  const filteredDocs = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return mockHistoryDocs;
    
    return mockHistoryDocs.filter(doc => 
        doc.subject.toLowerCase().includes(query) ||
        doc.id.toLowerCase().includes(query) ||
        doc.finalDestination.toLowerCase().includes(query) ||
        doc.completedBy.toLowerCase().includes(query) ||
        doc.status.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // --- Pagination Calculation ---
  const totalPages = Math.ceil(filteredDocs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedDocs = filteredDocs.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500">
      <style>{modalAnimationStyles}</style>

      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Document History</h2>
          <p className="text-base text-slate-600 mt-1">Search and view fully processed or returned documents.</p>
        </div>
      </div>

      {/* Enterprise Grade Auto-Filter */}
      <div className="flex flex-col gap-2 mb-8">
          <div className="relative w-full">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" size={24} />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Subject, ID, Office, or Status..." 
                className="w-full pl-14 pr-14 py-4 rounded-xl border-2 border-slate-400 focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 outline-none font-bold text-slate-900 placeholder:text-slate-500 transition-all text-lg shadow-sm" 
              />
              {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery("")}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-full transition-all active:scale-90"
                    title="Clear search"
                  >
                      <X size={20} strokeWidth={3} />
                  </button>
              )}
          </div>
          <p className="text-sm font-bold text-slate-500 px-2 animate-in fade-in">
              {filteredDocs.length} {filteredDocs.length === 1 ? 'record' : 'records'} found
          </p>
      </div>

      {/* Empty State */}
      {filteredDocs.length === 0 && (
          <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-10 flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-300">
              <div className="bg-slate-100 p-4 rounded-full mb-4">
                <FileText size={32} className="text-slate-400" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">No records found</h3>
              <p className="text-base font-medium text-slate-600 max-w-md">
                  We couldn't find any historical documents matching "<span className="text-slate-900 font-bold">{searchQuery}</span>". 
              </p>
              <button 
                onClick={() => setSearchQuery("")}
                className="mt-6 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all active:scale-95 border-2 border-slate-900"
              >
                  Clear Search
              </button>
          </div>
      )}

      {/* Document Cards Grid (Paginated) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {paginatedDocs.map(doc => {
            const isCompleted = doc.status === 'Completed';
            
            return (
            <div key={doc.id} className={`bg-white rounded-2xl border-2 ${isCompleted ? 'border-emerald-300' : 'border-red-300'} shadow-sm p-5 flex flex-col hover:border-slate-500 transition-colors relative overflow-hidden animate-in fade-in zoom-in-95 duration-200`}>
                
                {/* Top color bar indicator */}
                <div className={`absolute top-0 left-0 w-full h-1.5 ${isCompleted ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                
                <div className="flex justify-between items-start mb-3 mt-1">
                    <span className="text-sm font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md font-mono border border-slate-200">{doc.id}</span>
                    {isCompleted ? (
                        <span className="flex items-center gap-1 text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full border-2 border-emerald-200 uppercase tracking-wider"><CheckCircle size={14} strokeWidth={3}/> Completed</span>
                    ) : (
                        <span className="flex items-center gap-1 text-xs font-black text-red-700 bg-red-50 px-2 py-1 rounded-full border-2 border-red-200 uppercase tracking-wider"><XCircle size={14} strokeWidth={3}/> Returned</span>
                    )}
                </div>
                
                <h4 className="font-black text-xl text-slate-900 mb-4 leading-tight">{doc.subject}</h4>
                
                <div className={`bg-slate-50 p-4 rounded-xl border-2 ${isCompleted ? 'border-slate-200' : 'border-red-200 bg-red-50'} mb-5 flex-1 space-y-3`}>
                    {!isCompleted && doc.reason && (
                        <div className="mb-2 border-b border-red-200 pb-2">
                             <p className="text-xs font-bold text-red-900 uppercase tracking-wider mb-0.5">Return Reason</p>
                             <p className="text-sm text-red-800 font-medium">{doc.reason}</p>
                        </div>
                    )}
                    <div className="flex items-start gap-3">
                        <MapPin size={18} className="text-slate-500 mt-0.5 shrink-0" />
                        <p className="text-sm text-slate-900 font-bold leading-snug"><span className="text-slate-500 text-xs block font-bold uppercase tracking-wider mb-0.5">Final Location</span>{doc.finalDestination}</p>
                    </div>
                    <div className="flex items-start gap-3">
                        <Calendar size={18} className="text-slate-500 mt-0.5 shrink-0" />
                        <p className="text-sm text-slate-900 font-bold leading-snug"><span className="text-slate-500 text-xs block font-bold uppercase tracking-wider mb-0.5">Closed On</span>{doc.completedDate}</p>
                    </div>
                </div>

                <div className="mt-auto mb-4">
                    <div className="flex justify-between text-xs font-bold text-slate-600 mb-2 uppercase tracking-wider">
                        <span>{isCompleted ? 'Routing Progress' : 'Stopped At'}</span>
                        <span>{isCompleted ? '100% Complete' : `Step ${doc.step} of ${doc.totalSteps}`}</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 border border-slate-300 overflow-hidden">
                        <div className={`${isCompleted ? 'bg-emerald-500' : 'bg-red-500'} h-2 rounded-full`} style={{ width: `${(doc.step / doc.totalSteps) * 100}%` }}></div>
                    </div>
                </div>
                
                {/* Smaller Button */}
                <button 
                    onClick={() => setTrailDoc(doc)}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 text-sm border-2 border-slate-900"
                >
                    Track Record <ArrowRight size={16} />
                </button>
            </div>
        )})}
      </div>

      {/* Senior-Friendly Pagination Controls */}
      {totalPages > 1 && (
          <div className="flex items-center justify-between bg-white p-4 sm:p-5 rounded-2xl border-2 border-slate-300 shadow-sm mt-8 animate-in fade-in">
              <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center justify-center gap-2 px-4 py-3 sm:px-6 sm:py-3.5 font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-slate-100 disabled:cursor-not-allowed rounded-xl transition-all active:scale-95 border-2 border-slate-300"
                  aria-label="Previous Page"
              >
                  <ChevronLeft size={20} strokeWidth={3} />
                  <span className="hidden sm:inline">Previous</span>
              </button>
              
              <div className="text-center">
                  <span className="block text-sm font-bold text-slate-500 uppercase tracking-wider mb-0.5">Page</span>
                  <span className="text-lg font-black text-slate-900">{currentPage} of {totalPages}</span>
              </div>
              
              <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="flex items-center justify-center gap-2 px-4 py-3 sm:px-6 sm:py-3.5 font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-slate-100 disabled:cursor-not-allowed rounded-xl transition-all active:scale-95 border-2 border-slate-300"
                  aria-label="Next Page"
              >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight size={20} strokeWidth={3} />
              </button>
          </div>
      )}

      {/* Digital Trail Modal Overlay */}
      {trailDoc && <DigitalTrailModal doc={trailDoc} onBack={() => setTrailDoc(null)} />}
    </div>
  );
}

// --- Digital Trail Modal (Package Tracker Style) ---
function DigitalTrailModal({ doc, onBack }: any) {
    const [isClosing, setIsClosing] = useState(false);
    const isCompleted = doc.status === 'Completed';

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            onBack();
        }, 400); 
    };

    // Generate mock timeline based on document status
    const timeline = isCompleted ? [
        {
            id: 1,
            date: doc.completedDate,
            time: "02:30 PM",
            title: "Process Completed",
            description: `Document was successfully finalized at the ${doc.finalDestination}.`,
            status: "current",
            color: "bg-emerald-500"
        },
        {
            id: 2,
            date: doc.completedDate,
            time: "11:15 AM",
            title: "Received & Signed",
            description: `Document received by authorized personnel at ${doc.finalDestination}.`,
            status: "completed",
            color: "bg-slate-300"
        },
        {
            id: 3,
            date: "Aug 1",
            time: "09:00 AM",
            title: "In Transit",
            description: `Handed over to Liaison heading to ${doc.finalDestination}.`,
            status: "completed",
            color: "bg-slate-300"
        },
        {
            id: 4,
            date: "Jul 30",
            time: "08:45 AM",
            title: "Document Created",
            description: `Initiated and logged into the system by ${doc.originator}.`,
            status: "completed",
            color: "bg-slate-300"
        }
    ] : [
        {
            id: 1,
            date: doc.completedDate,
            time: "10:05 AM",
            title: "Returned to Originator",
            description: `Document rejected at ${doc.finalDestination}. Reason: ${doc.reason}`,
            status: "current",
            color: "bg-red-500",
            icon: <X size={14} className="text-white" strokeWidth={4} />
        },
        {
            id: 2,
            date: "Aug 3",
            time: "03:20 PM",
            title: "Received for Review",
            description: `Document arrived at ${doc.finalDestination} for evaluation.`,
            status: "completed",
            color: "bg-slate-300"
        },
        {
            id: 3,
            date: "Aug 1",
            time: "11:00 AM",
            title: "Document Created",
            description: `Initiated and logged into the system by ${doc.originator}.`,
            status: "completed",
            color: "bg-slate-300"
        }
    ];

    return (
        <div className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50 backdrop-blur-sm ${isClosing ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
            <div className={`bg-white w-full max-w-2xl max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden shadow-2xl rounded-t-2xl sm:rounded-2xl ${isClosing ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
                
                {/* Header Container */}
                <div className="bg-slate-900 text-white relative flex flex-col shrink-0">
                    <div className="w-16 h-1.5 bg-white/30 rounded-full mx-auto mt-3 sm:hidden shrink-0"></div>
                    <div className="p-5 pt-3 sm:pt-6 flex items-center justify-between">
                        <button onClick={handleClose} className="p-2 -ml-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors active:scale-90">
                            <ArrowLeft size={24} />
                        </button>
                        <h3 className="font-black text-xl">Historical Record</h3>
                        <div className="w-10"></div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-white">
                    
                    {/* Document Header Info */}
                    <div className="mb-8 border-b-2 border-slate-100 pb-6">
                        <p className="text-sm font-bold text-slate-500 mb-1 font-mono">{doc.id}</p>
                        <p className="font-black text-xl text-slate-900 leading-tight flex items-start gap-2">
                            {doc.status === 'Returned' && <XCircle size={24} className="text-red-600 shrink-0 mt-0.5" />}
                            {doc.subject}
                        </p>
                    </div>

                    {/* Tracker Timeline (E-Commerce Style) */}
                    <div className="flex flex-col">
                        {timeline.map((step, idx) => {
                            const isLast = idx === timeline.length - 1;
                            return (
                                <div key={step.id} className="flex group">
                                    
                                    {/* Left: Date & Time */}
                                    <div className="w-20 sm:w-24 shrink-0 text-left pt-1">
                                        <p className="text-sm sm:text-base font-bold text-slate-700">{step.date}</p>
                                        <p className="text-xs sm:text-sm font-bold text-slate-500">{step.time}</p>
                                    </div>

                                    {/* Middle: Timeline Graphic */}
                                    <div className="relative flex flex-col items-center px-3 sm:px-5">
                                        {/* Node */}
                                        <div className={`z-10 w-6 h-6 rounded-full ${step.color} flex items-center justify-center shrink-0 border-2 border-white shadow-sm mt-0.5`}>
                                            {step.icon ? step.icon : <Check size={14} className="text-white" strokeWidth={4} />}
                                        </div>
                                        {/* Continuous Line */}
                                        {!isLast && (
                                            <div className="absolute top-6 bottom-[-0.5rem] w-[2px] bg-slate-200"></div>
                                        )}
                                    </div>

                                    {/* Right: Content */}
                                    <div className="flex-1 pb-10">
                                        <h4 className="text-base sm:text-lg font-black text-slate-900">{step.title}</h4>
                                        <p className="text-sm sm:text-base font-medium text-slate-700 mt-1 leading-snug">{step.description}</p>
                                    </div>

                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-50 p-4 sm:p-6 pb-8 sm:pb-6 border-t-2 border-slate-200 flex shrink-0">
                    <button 
                        onClick={handleClose}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-95 text-base border-2 border-slate-900"
                    >
                        Close Record
                    </button>
                </div>
            </div>
        </div>
    );
}