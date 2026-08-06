import React, { useState } from 'react';
import { 
  Building2, FolderTree, Users, Shield, Plus, 
  Trash2, Edit, CheckCircle, X, AlertCircle, ArrowLeft, Save, FileText 
} from 'lucide-react';
import { toast } from 'sonner';

// --- Shared Modal Animation Styles ---
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

export default function SystemAdmin() {
  const [activeTab, setActiveTab] = useState<'departments' | 'categories' | 'employees'>('departments');

  // Modal States
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [isEmpModalOpen, setIsEmpModalOpen] = useState(false);

  // Mock Data States
  const [departments, setDepartments] = useState([
    'Provincial Health Office',
    'Provincial Budget Office',
    'Provincial Accounting Office',
    'Provincial Treasurer\'s Office',
    'Governor\'s Office',
    'HRMO'
  ]);

  const [categories, setCategories] = useState([
    'Payroll',
    'Executive Order (E.O.)',
    'Memorandum',
    'Budget Request',
    'Travel Order',
    'Financial Clearance'
  ]);

  const [employees, setEmployees] = useState([
    { id: 'EMP-2024-089', name: 'Sarah Lee', designation: 'Program Coordinator', department: 'Provincial Health Office' },
    { id: 'EMP-2024-092', name: 'Maria Santos', designation: 'Liaison Officer', department: 'Provincial Budget Office' },
    { id: 'EMP-2024-104', name: 'Dr. Santos', designation: 'Medical Officer V', department: 'Provincial Health Office' }
  ]);

  // Form inputs for modals
  const [newDept, setNewDept] = useState('');
  const [newCat, setNewCat] = useState('');
  const [newEmp, setNewEmp] = useState({ id: '', name: '', designation: '', department: 'Provincial Health Office' });

  const handleAddDepartment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDept.trim()) return;
    setDepartments([...departments, newDept.trim()]);
    setNewDept('');
    setIsDeptModalOpen(false);
    toast.success('Department added successfully');
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCat.trim()) return;
    setCategories([...categories, newCat.trim()]);
    setNewCat('');
    setIsCatModalOpen(false);
    toast.success('Document category added successfully');
  };

  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmp.id || !newEmp.name || !newEmp.designation) {
      toast.error('Please fill in all required employee fields.');
      return;
    }
    setEmployees([...employees, newEmp]);
    setNewEmp({ id: '', name: '', designation: '', department: 'Provincial Health Office' });
    setIsEmpModalOpen(false);
    toast.success('Employee registered successfully');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      <style>{modalAnimationStyles}</style>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">System Administration</h2>
          <p className="text-base text-slate-600 mt-1">Manage global drop-down options, document categories, and employee directory.</p>
        </div>
      </div>

      {/* Admin Navigation Tabs */}
      <div className="flex flex-nowrap overflow-x-auto gap-3 bg-white p-2 rounded-2xl border-2 border-slate-300 shadow-sm w-full">
        <TabButton 
          label="Departments / Offices" 
          icon={<Building2 size={18} />} 
          isActive={activeTab === 'departments'} 
          onClick={() => setActiveTab('departments')} 
        />
        <TabButton 
          label="Document Categories" 
          icon={<FolderTree size={18} />} 
          isActive={activeTab === 'categories'} 
          onClick={() => setActiveTab('categories')} 
        />
        <TabButton 
          label="Employee Directory" 
          icon={<Users size={18} />} 
          isActive={activeTab === 'employees'} 
          onClick={() => setActiveTab('employees')} 
        />
      </div>

      {/* --- TAB 1: DEPARTMENTS --- */}
      {activeTab === 'departments' && (
        <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-sm overflow-hidden animate-in fade-in duration-300">
          <div className="bg-slate-900 px-6 py-4 flex justify-between items-center text-white">
            <div className="flex items-center gap-3">
              <Building2 className="text-blue-400" size={24} />
              <h3 className="text-xl font-black tracking-wide">Registered Departments & Offices</h3>
            </div>
            <button 
              onClick={() => setIsDeptModalOpen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm flex items-center gap-1.5 transition-all active:scale-95 border-2 border-blue-700 shadow-md"
            >
              <Plus size={18} strokeWidth={3} /> Add Office
            </button>
          </div>

          <div className="p-6 sm:p-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {departments.map((dept, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border-2 border-slate-200">
                  <span className="font-bold text-slate-900 text-base">{dept}</span>
                  <button 
                    onClick={() => setDepartments(departments.filter((_, i) => i !== index))}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                    title="Remove Office"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 2: CATEGORIES --- */}
      {activeTab === 'categories' && (
        <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-sm overflow-hidden animate-in fade-in duration-300">
          <div className="bg-slate-900 px-6 py-4 flex justify-between items-center text-white">
            <div className="flex items-center gap-3">
              <FolderTree className="text-blue-400" size={24} />
              <h3 className="text-xl font-black tracking-wide">Document Categories</h3>
            </div>
            <button 
              onClick={() => setIsCatModalOpen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm flex items-center gap-1.5 transition-all active:scale-95 border-2 border-blue-700 shadow-md"
            >
              <Plus size={18} strokeWidth={3} /> Add Category
            </button>
          </div>

          <div className="p-6 sm:p-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {categories.map((cat, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border-2 border-slate-200">
                  <span className="font-bold text-slate-900 text-base">{cat}</span>
                  <button 
                    onClick={() => setCategories(categories.filter((_, i) => i !== index))}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                    title="Remove Category"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 3: EMPLOYEES --- */}
      {activeTab === 'employees' && (
        <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-sm overflow-hidden animate-in fade-in duration-300">
          <div className="bg-slate-900 px-6 py-4 flex justify-between items-center text-white">
            <div className="flex items-center gap-3">
              <Users className="text-blue-400" size={24} />
              <h3 className="text-xl font-black tracking-wide">Employee Directory</h3>
            </div>
            <button 
              onClick={() => setIsEmpModalOpen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm flex items-center gap-1.5 transition-all active:scale-95 border-2 border-blue-700 shadow-md"
            >
              <Plus size={18} strokeWidth={3} /> Register Employee
            </button>
          </div>

          <div className="p-6 sm:p-8">
            <div className="space-y-4">
              {employees.map((emp, index) => (
                <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-slate-50 rounded-2xl border-2 border-slate-200 gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold font-mono bg-slate-200 px-2 py-0.5 rounded text-slate-700">{emp.id}</span>
                      <h4 className="font-black text-lg text-slate-900">{emp.name}</h4>
                    </div>
                    <p className="text-sm font-bold text-slate-600">{emp.designation} • <span className="text-blue-600">{emp.department}</span></p>
                  </div>
                  <button 
                    onClick={() => setEmployees(employees.filter((_, i) => i !== index))}
                    className="self-end sm:self-center p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                    title="Remove Employee"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 1: ADD DEPARTMENT --- */}
      {isDeptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-overlay-fade">
          <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden animate-responsive-modal">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <h3 className="font-black text-xl">Add New Department / Office</h3>
              <button onClick={() => setIsDeptModalOpen(false)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full"><X size={20} /></button>
            </div>
            <form onSubmit={handleAddDepartment} className="p-6 space-y-4">
              <div>
                <label className="block text-base font-bold text-slate-900 mb-2">Office / Department Name *</label>
                <input 
                  type="text" 
                  value={newDept}
                  onChange={(e) => setNewDept(e.target.value)}
                  placeholder="e.g. Provincial Engineering Office" 
                  className="w-full p-4 bg-slate-50 border-2 border-slate-400 rounded-xl focus:border-slate-900 outline-none font-bold text-slate-900"
                  autoFocus
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsDeptModalOpen(false)} className="flex-1 py-3.5 bg-white border-2 border-slate-300 text-slate-700 font-bold rounded-xl">Cancel</button>
                <button type="submit" className="flex-1 py-3.5 bg-slate-900 text-white font-bold rounded-xl border-2 border-slate-900">Save Office</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: ADD CATEGORY --- */}
      {isCatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-overlay-fade">
          <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden animate-responsive-modal">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <h3 className="font-black text-xl">Add Document Category</h3>
              <button onClick={() => setIsCatModalOpen(false)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full"><X size={20} /></button>
            </div>
            <form onSubmit={handleAddCategory} className="p-6 space-y-4">
              <div>
                <label className="block text-base font-bold text-slate-900 mb-2">Category Name *</label>
                <input 
                  type="text" 
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  placeholder="e.g. Purchase Request" 
                  className="w-full p-4 bg-slate-50 border-2 border-slate-400 rounded-xl focus:border-slate-900 outline-none font-bold text-slate-900"
                  autoFocus
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsCatModalOpen(false)} className="flex-1 py-3.5 bg-white border-2 border-slate-300 text-slate-700 font-bold rounded-xl">Cancel</button>
                <button type="submit" className="flex-1 py-3.5 bg-slate-900 text-white font-bold rounded-xl border-2 border-slate-900">Save Category</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 3: REGISTER EMPLOYEE --- */}
      {isEmpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-overlay-fade">
          <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden animate-responsive-modal">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <h3 className="font-black text-xl">Register New Employee</h3>
              <button onClick={() => setIsEmpModalOpen(false)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full"><X size={20} /></button>
            </div>
            <form onSubmit={handleAddEmployee} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-base font-bold text-slate-900 mb-1">Employee ID *</label>
                <input 
                  type="text" 
                  value={newEmp.id}
                  onChange={(e) => setNewEmp({...newEmp, id: e.target.value})}
                  placeholder="EMP-2026-105" 
                  className="w-full p-3.5 bg-slate-50 border-2 border-slate-400 rounded-xl focus:border-slate-900 outline-none font-bold text-slate-900 font-mono"
                />
              </div>
              <div>
                <label className="block text-base font-bold text-slate-900 mb-1">Full Name *</label>
                <input 
                  type="text" 
                  value={newEmp.name}
                  onChange={(e) => setNewEmp({...newEmp, name: e.target.value})}
                  placeholder="Juan Dela Cruz" 
                  className="w-full p-3.5 bg-slate-50 border-2 border-slate-400 rounded-xl focus:border-slate-900 outline-none font-bold text-slate-900"
                />
              </div>
              <div>
                <label className="block text-base font-bold text-slate-900 mb-1">Designation *</label>
                <input 
                  type="text" 
                  value={newEmp.designation}
                  onChange={(e) => setNewEmp({...newEmp, designation: e.target.value})}
                  placeholder="Administrative Officer II" 
                  className="w-full p-3.5 bg-slate-50 border-2 border-slate-400 rounded-xl focus:border-slate-900 outline-none font-bold text-slate-900"
                />
              </div>
              <div>
                <label className="block text-base font-bold text-slate-900 mb-1">Department / Agency *</label>
                <select 
                  value={newEmp.department}
                  onChange={(e) => setNewEmp({...newEmp, department: e.target.value})}
                  className="w-full p-3.5 bg-slate-50 border-2 border-slate-400 rounded-xl focus:border-slate-900 outline-none font-bold text-slate-900"
                >
                  {departments.map((dept, idx) => (
                    <option key={idx} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsEmpModalOpen(false)} className="flex-1 py-3.5 bg-white border-2 border-slate-300 text-slate-700 font-bold rounded-xl">Cancel</button>
                <button type="submit" className="flex-1 py-3.5 bg-slate-900 text-white font-bold rounded-xl border-2 border-slate-900">Register Account</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

function TabButton({ label, icon, isActive, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={`flex-1 shrink-0 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold transition-all active:scale-95 text-sm whitespace-nowrap ${
        isActive 
        ? 'bg-slate-900 text-white shadow-md' 
        : 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}