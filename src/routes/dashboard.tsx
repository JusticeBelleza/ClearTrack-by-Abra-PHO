import React from 'react';
import { Plus, Activity, Briefcase, CheckCircle, FileText, AlertCircle, MapPin, User } from 'lucide-react';
import { Link } from 'react-router-dom';

// Import the Zustand store
import { useUiStore } from '../store/uiStore';

const mockActiveDocs = [
  { 
    id: 'DOC-2026-084', 
    subject: 'Budget Request for Q3 Medical Supplies', 
    isUrgent: true,
    originator: 'Sarah Lee', 
    currentLocation: 'Provincial Budget Office', 
    status: 'In Transit', 
  },
  { 
    id: 'DOC-2026-085', 
    subject: 'PhilHealth Accreditation Renewal',
    isUrgent: false,
    originator: 'Dr. Santos', 
    currentLocation: 'Governor\'s Office', 
    status: 'Awaiting Signature', 
  }
];

export default function Dashboard() {
  // Grab the open function from the store
  const openCreateModal = useUiStore((state) => state.openCreateModal);

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500">
      
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Good Morning, Maria</h2>
          <p className="text-slate-500 mt-1">Here is the status of your assigned documents.</p>
        </div>
        <button 
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold shadow-lg shadow-blue-200 transition-all active:scale-95"
            onClick={openCreateModal} // Wired to Zustand instead of alert
        >
          <Plus size={20} />
          Create New Document
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Total In Transit" value="12" icon={<Activity className="text-blue-500" />} color="bg-blue-50 border-blue-100" />
        <StatCard title="Assigned to Me" value="4" icon={<Briefcase className="text-purple-500" />} color="bg-purple-50 border-purple-100" />
        <StatCard title="Completed Today" value="7" icon={<CheckCircle className="text-emerald-500" />} color="bg-emerald-50 border-emerald-100" />
      </div>

      <div className="mt-10">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-slate-800">My Priority Tasks</h3>
            <Link to="/processing" className="text-blue-600 font-medium text-sm hover:underline">View All Active</Link>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {mockActiveDocs.map((doc, idx) => (
            <div key={doc.id} className={`p-4 flex items-center justify-between ${idx !== mockActiveDocs.length -1 ? 'border-b border-slate-100' : ''} hover:bg-slate-50 transition-colors cursor-pointer ${doc.isUrgent ? 'border-l-4 border-l-red-500 bg-red-50/30' : ''}`}>
              <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-md mt-1 hidden sm:block ${doc.isUrgent ? 'bg-red-100' : 'bg-amber-100'}`}>
                      <FileText size={20} className={doc.isUrgent ? 'text-red-600' : 'text-amber-600'} />
                  </div>
                  <div>
                      <div className="flex items-center gap-2">
                          {doc.isUrgent && <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase flex items-center gap-1 animate-pulse"><AlertCircle size={10}/> Rush</span>}
                          <p className="font-bold text-slate-900">{doc.subject}</p>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3 text-sm text-slate-500 mt-1">
                          <span className="flex items-center gap-1 font-medium text-slate-700"><MapPin size={14} className="text-slate-400"/> {doc.currentLocation}</span>
                          <span className="hidden sm:inline text-slate-300">|</span>
                          <span className="flex items-center gap-1 mt-1 sm:mt-0"><User size={14} className="text-slate-400"/> Assigned by: <span className="font-medium text-slate-700">{doc.originator}</span></span>
                          <span className="hidden sm:inline text-slate-300">|</span>
                          <span className="mt-1 sm:mt-0 font-mono text-xs">{doc.id}</span>
                      </div>
                  </div>
              </div>
              <div className="hidden md:flex">
                  <span className="px-3 py-1 bg-amber-50 text-amber-700 text-xs font-bold uppercase rounded-full border border-amber-200">
                      {doc.status}
                  </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }: any) {
  return (
    <div className={`p-6 rounded-2xl border ${color} shadow-sm flex items-center justify-between`}>
      <div>
        <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
        <p className="text-4xl font-bold text-slate-900">{value}</p>
      </div>
      <div className="p-3 bg-white rounded-xl shadow-sm">
        {React.cloneElement(icon, { size: 28 })}
      </div>
    </div>
  );
}