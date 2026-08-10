import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, FolderTree, Users, Shield, Plus, 
  Trash2, X, Activity, AlertTriangle, 
  ClipboardList, Settings, Clock, Search,
  Save, ChevronDown, Phone, Zap, MapPin, Hash, AlertCircle, Mail
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase'; 
import { createClient } from '@supabase/supabase-js'; 

// --- ADMIN BYPASS CLIENT ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  serviceRoleKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.dummy_key', 
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false 
    }
  }
);

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
    
    .scrollbar-hide::-webkit-scrollbar { display: none; }
    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }

    @media (min-width: 640px) {
        .animate-responsive-modal { animation: desktopZoomIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-responsive-modal-close { animation: desktopZoomOut 0.3s cubic-bezier(0.3, 0, 0.8, 0.15) forwards; }
    }
`;

// --- TypeScript Interfaces ---
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

interface Department {
    id: string;
    name: string;
    office_id: string;
    office_address: string;
}

interface Category {
    id: string;
    name: string;
    category_id: string;
}

interface Employee {
    id: string;
    emp_id: string;
    name: string;
    email: string;
    designation: string;
    department: string;
    contact_number: string;
}

interface AuditLog {
    id: string;
    created_at: string;
    user_name: string;
    action: string;
    ip_address: string;
}

interface NavButtonProps {
    label: string;
    icon: React.ReactNode;
    isActive: boolean;
    onClick: () => void;
}

interface StatCardProps {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color: string;
}

// --- Custom Senior-Friendly Dropdown Component ---
function CustomSelect({ options, value, onChange, placeholder }: CustomSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
  
    useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
  
    return (
      <div className="relative w-full" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full px-4 py-3.5 bg-slate-50 border-2 rounded-xl flex justify-between items-center transition-all text-base outline-none active:scale-[0.99] ${
            isOpen
              ? 'border-slate-900 ring-4 ring-slate-900/10 bg-white'
              : 'border-slate-400 hover:bg-slate-100 hover:border-slate-600'
          } ${!value ? 'text-slate-500' : 'text-slate-900 font-bold'}`}
        >
          <span className="truncate">
            {options.find((opt: OptionType) => (typeof opt === 'string' ? opt : opt.value) === value)
              ? (typeof options.find((opt: OptionType) => (typeof opt === 'string' ? opt : opt.value) === value) === 'string' 
                  ? options.find((opt: OptionType) => (typeof opt === 'string' ? opt : opt.value) === value) as string
                  : (options.find((opt: OptionType) => (typeof opt === 'string' ? opt : opt.value) === value) as SelectOption).label)
              : value || placeholder}
          </span>
          <ChevronDown 
            size={20} 
            className={`text-slate-600 transition-transform duration-300 ease-in-out ${isOpen ? 'rotate-180 text-slate-900' : ''}`} 
          />
        </button>
  
        {isOpen && (
          <div className="absolute z-20 w-full mt-2 bg-white border-2 border-slate-400 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="max-h-60 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
              {options.map((option: OptionType, idx: number) => {
                const optValue = typeof option === 'string' ? option : option.value;
                const optLabel = typeof option === 'string' ? option : option.label;
                const isSelected = optValue === value;
  
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      onChange(optValue);
                      setIsOpen(false);
                    }}
                    className={`px-4 py-3 text-base rounded-lg cursor-pointer transition-colors flex items-center active:scale-95 ${
                      isSelected
                        ? 'bg-slate-900 text-white font-bold'
                        : 'text-slate-800 hover:bg-slate-100 font-medium'
                    }`}
                  >
                    {optLabel}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
}

export default function SystemAdmin() {
  const [mainTab, setMainTab] = useState<'dashboard' | 'directory' | 'audit' | 'settings'>('dashboard');
  const [dirTab, setDirTab] = useState<'departments' | 'categories' | 'employees'>('departments');

  // --- Data States ---
  const [isLoading, setIsLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [globalSettings, setGlobalSettings] = useState({ maintenanceMode: false, sessionTimeout: '30' });

  // --- Modal Open/Close States ---
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [isClosingDept, setIsClosingDept] = useState(false);
  
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [isClosingCat, setIsClosingCat] = useState(false);
  
  const [isEmpModalOpen, setIsEmpModalOpen] = useState(false);
  const [isClosingEmp, setIsClosingEmp] = useState(false);

  // Delete Confirmation States
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [isClosingDelete, setIsClosingDelete] = useState(false);

  const [deleteCatConfirm, setDeleteCatConfirm] = useState<{ id: string; name: string } | null>(null);
  const [isClosingCatDelete, setIsClosingCatDelete] = useState(false);

  const [deleteEmpConfirm, setDeleteEmpConfirm] = useState<{ id: string; name: string; emp_id: string } | null>(null);
  const [isClosingEmpDelete, setIsClosingEmpDelete] = useState(false);

  const closeDeptModal = () => { setIsClosingDept(true); setTimeout(() => { setIsDeptModalOpen(false); setIsClosingDept(false); }, 400); };
  const closeCatModal = () => { setIsClosingCat(true); setTimeout(() => { setIsCatModalOpen(false); setIsClosingCat(false); }, 400); };
  const closeEmpModal = () => { setIsClosingEmp(true); setTimeout(() => { setIsEmpModalOpen(false); setIsClosingEmp(false); }, 400); };
  
  const closeDeleteModal = () => { 
      setIsClosingDelete(true); 
      setTimeout(() => { setDeleteConfirm(null); setIsClosingDelete(false); }, 400); 
  };
  const closeCatDeleteModal = () => { 
      setIsClosingCatDelete(true); 
      setTimeout(() => { setDeleteCatConfirm(null); setIsClosingCatDelete(false); }, 400); 
  };
  const closeEmpDeleteModal = () => { 
      setIsClosingEmpDelete(true); 
      setTimeout(() => { setDeleteEmpConfirm(null); setIsClosingEmpDelete(false); }, 400); 
  };

  // --- Form States ---
  const [newOffice, setNewOffice] = useState({ office_id: '', office_name: '', office_address: '' });
  const [newCat, setNewCat] = useState({ category_id: '', name: '' });
  
  const [newEmp, setNewEmp] = useState({ 
    emp_id: '', name: '', email: '', designation: '', 
    department: '', contactNumber: '', password: '', confirmPassword: '' 
  });

  // --- Data Fetching ---
  const fetchAdminData = async () => {
    setIsLoading(true);
    try {
      const [deptRes, catRes, empRes, logRes, settingsRes] = await Promise.all([
        supabase.from('departments').select('*').order('name'),
        supabase.from('categories').select('*').order('name'),
        supabase.from('employees').select('*').order('created_at', { ascending: false }),
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('global_settings').select('*').eq('id', 1).single()
      ]);

      if (deptRes.data) setDepartments(deptRes.data);
      if (catRes.data) setCategories(catRes.data);
      if (empRes.data) setEmployees(empRes.data);
      if (logRes.data) setAuditLogs(logRes.data);
      if (settingsRes.data) {
        setGlobalSettings({
            maintenanceMode: settingsRes.data.maintenance_mode,
            sessionTimeout: settingsRes.data.session_timeout
        });
      }
    } catch (error) {
      toast.error('Failed to load system data.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  // --- Action Handlers ---
  const openOfficeModal = () => {
      const generatedId = 'OFC-' + Math.floor(1000 + Math.random() * 9000);
      setNewOffice({ office_id: generatedId, office_name: '', office_address: '' });
      setIsDeptModalOpen(true);
  };

  const openCatModal = () => {
      const generatedId = 'CAT-' + Math.floor(1000 + Math.random() * 9000);
      setNewCat({ category_id: generatedId, name: '' });
      setIsCatModalOpen(true);
  };

  const openEmployeeModal = () => {
      setNewEmp({ 
          emp_id: '', name: '', email: '', designation: '', 
          department: departments[0]?.name || '', contactNumber: '', 
          password: '', confirmPassword: '' 
      });
      setIsEmpModalOpen(true);
  }

  const handleGeneratePassword = () => {
      const pass = 'User@' + Math.floor(1000 + Math.random() * 9000);
      setNewEmp({...newEmp, password: pass, confirmPassword: pass});
  };

  // Departments Handlers
  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOffice.office_name.trim() || !newOffice.office_address.trim()) {
        toast.error('Please fill in all required office fields.');
        return;
    }
    
    const { data, error } = await supabase.from('departments').insert([{ 
        name: newOffice.office_name.trim(),
        office_id: newOffice.office_id,
        office_address: newOffice.office_address.trim()
    }]).select();

    if (error) {
        toast.error('Failed to add office', { description: error.message });
        return;
    }
    if (data) setDepartments([...departments, data[0]]);
    
    closeDeptModal(); 
    toast.success('Office added successfully');
    logAuditAction(`Added new office: ${newOffice.office_name.trim()} (${newOffice.office_id})`);
  };

  const confirmDeleteDepartment = async () => {
      if (!deleteConfirm) return;
      const { id, name } = deleteConfirm;

      const { error } = await supabase.from('departments').delete().eq('id', id);
      if (error) {
          toast.error('Failed to delete office');
      } else {
          setDepartments(departments.filter(d => d.id !== id));
          toast.success('Office removed successfully');
          logAuditAction(`Deleted office: ${name}`);
      }
      closeDeleteModal();
  };

  // Categories Handlers
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCat.name.trim()) {
        toast.error('Please provide a category name.');
        return;
    }
    
    const { data, error } = await supabase.from('categories').insert([{ 
        name: newCat.name.trim(),
        category_id: newCat.category_id 
    }]).select();

    if (error) {
        toast.error('Failed to add category', { description: error.message });
        return;
    }
    if (data) setCategories([...categories, data[0]]);
    
    closeCatModal(); 
    toast.success('Document category added successfully');
    logAuditAction(`Added new category: ${newCat.name.trim()} (${newCat.category_id})`);
  };

  const confirmDeleteCategory = async () => {
      if (!deleteCatConfirm) return;
      const { id, name } = deleteCatConfirm;

      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) {
          toast.error('Failed to delete category');
      } else {
          setCategories(categories.filter(c => c.id !== id));
          toast.success('Category removed successfully');
          logAuditAction(`Deleted category: ${name}`);
      }
      closeCatDeleteModal();
  };

  // Employee Handlers
  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmp.emp_id || !newEmp.name || !newEmp.email || !newEmp.designation || !newEmp.contactNumber || !newEmp.password) { 
        toast.error('Please fill all required fields.'); 
        return; 
    }
    if (newEmp.password !== newEmp.confirmPassword) {
        toast.error('Passwords do not match.');
        return;
    }

    if (!serviceRoleKey) {
        toast.error('Configuration Error', { description: 'Missing VITE_SUPABASE_SERVICE_ROLE_KEY in environment variables.' });
        return;
    }
    
    // 1. Create the user in Supabase Authentication via Admin bypass
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: newEmp.email.trim(),
        password: newEmp.password,
        email_confirm: true, // Auto-confirm so the user can log in instantly
        user_metadata: { full_name: newEmp.name }
    });

    if (authError) {
        toast.error('Auth Creation Failed', { description: authError.message });
        return;
    }

    const userId = authData.user.id;

    // 2. Insert into the public employees directory
    const { data, error } = await supabase.from('employees').insert([{ 
        emp_id: newEmp.emp_id, 
        name: newEmp.name, 
        email: newEmp.email.trim(),
        designation: newEmp.designation, 
        department: newEmp.department, 
        contact_number: newEmp.contactNumber 
    }]).select();

    if (error) {
        toast.error('Directory Error', { description: error.message });
        return;
    }

    // 3. Guarantee the profile is created and fully synced via UPSERT
    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
        id: userId,
        full_name: newEmp.name,
        emp_id: newEmp.emp_id,
        department: newEmp.department,
        designation: newEmp.designation,
        contact_number: newEmp.contactNumber,
        role: 'pho_staff'               // <-- Explicitly locks them into the Staff role
    });

    if (profileError) {
        console.error("Profile Sync Error:", profileError);
        toast.error('Profile warning', { description: 'Login created, but profile sync failed.' });
    }

    if (data) setEmployees([data[0], ...employees]);
    closeEmpModal(); 
    toast.success('Employee registered successfully', { description: 'The new user can log in immediately.' });
    logAuditAction(`Registered new employee: ${newEmp.emp_id}`);
  };

  const confirmDeleteEmployee = async () => {
      if (!deleteEmpConfirm) return;
      const { id, name, emp_id } = deleteEmpConfirm;

      const { error } = await supabase.from('employees').delete().eq('id', id);
      if (error) {
          toast.error('Failed to permanently delete employee');
      } else {
          setEmployees(employees.filter(e => e.id !== id));
          toast.success('Employee permanently deleted');
          logAuditAction(`Deleted employee: ${emp_id} (${name})`);
      }
      closeEmpDeleteModal();
  };

  const saveGlobalSettings = async () => {
    const { error } = await supabase.from('global_settings').update({
        maintenance_mode: globalSettings.maintenanceMode,
        session_timeout: globalSettings.sessionTimeout
    }).eq('id', 1);

    if (error) toast.error('Failed to update settings');
    else {
        toast.success('System Settings Updated', { description: 'Global configurations have been applied.'});
        logAuditAction(`Updated global settings (Maintenance: ${globalSettings.maintenanceMode})`);
    }
  };

  const logAuditAction = async (action: string) => {
      try {
          await supabase.from('audit_logs').insert([{
              user_name: 'System Admin', 
              action: action,
              ip_address: 'Internal'
          }]);
          const { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50);
          if (data) setAuditLogs(data);
      } catch (err) {
          console.error("Audit log error:", err);
      }
  };

  const sessionOptions = [
    { value: '30', label: '30 Minutes' },
    { value: '60', label: '1 Hour' },
    { value: '480', label: '8 Hours' },
    { value: '1440', label: '24 Hours' },
    { value: 'never', label: 'Never' }
  ];

  if (isLoading) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[50vh]">
              <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
              <p className="mt-4 text-slate-500 font-bold">Loading System Data...</p>
          </div>
      );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      <style>{modalAnimationStyles}</style>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Shield className="text-blue-600" size={32} /> Admin Portal
          </h2>
          <p className="text-base text-slate-600 mt-1">Global system overview, security, and directory management.</p>
        </div>
      </div>

      {/* Main Admin Navigation */}
      <div className="flex flex-nowrap overflow-x-auto scrollbar-hide gap-2 sm:gap-3 bg-slate-900 p-2 rounded-2xl shadow-lg w-full sm:inline-flex sm:w-auto mb-6">
        <MainNavButton label="Overview" icon={<Activity size={18} />} isActive={mainTab === 'dashboard'} onClick={() => setMainTab('dashboard')} />
        <MainNavButton label="Directory" icon={<Users size={18} />} isActive={mainTab === 'directory'} onClick={() => setMainTab('directory')} />
        <MainNavButton label="Audit Logs" icon={<ClipboardList size={18} />} isActive={mainTab === 'audit'} onClick={() => setMainTab('audit')} />
        <MainNavButton label="System Config" icon={<Settings size={18} />} isActive={mainTab === 'settings'} onClick={() => setMainTab('settings')} />
      </div>

      {/* =========================================
          VIEW 1: SYSTEM DASHBOARD (OVERVIEW)
      ========================================= */}
      {mainTab === 'dashboard' && (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-5">
            <StatCard title="Registered Offices" value={departments.length} icon={<Building2 className="text-emerald-600" />} color="bg-emerald-50 border-emerald-200" />
            <StatCard title="Active Employees" value={employees.length} icon={<Users className="text-blue-600" />} color="bg-blue-50 border-blue-200" />
            <StatCard title="Doc Categories" value={categories.length} icon={<FolderTree className="text-indigo-600" />} color="bg-indigo-50 border-indigo-200" />
            <StatCard title="Audit Logs" value={auditLogs.length} icon={<ClipboardList className="text-orange-600" />} color="bg-orange-50 border-orange-200" />
          </div>
        </div>
      )}

      {/* =========================================
          VIEW 2: DIRECTORY MANAGEMENT
      ========================================= */}
      {mainTab === 'directory' && (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex flex-nowrap overflow-x-auto scrollbar-hide gap-2 sm:gap-3 bg-white p-2 rounded-2xl border-2 border-slate-300 shadow-sm w-full sm:inline-flex sm:w-auto">
                <SubTabButton label="Departments" icon={<Building2 size={16} />} isActive={dirTab === 'departments'} onClick={() => setDirTab('departments')} />
                <SubTabButton label="Categories" icon={<FolderTree size={16} />} isActive={dirTab === 'categories'} onClick={() => setDirTab('categories')} />
                <SubTabButton label="Employees" icon={<Users size={16} />} isActive={dirTab === 'employees'} onClick={() => setDirTab('employees')} />
            </div>

            {/* DEPARTMENTS */}
            {dirTab === 'departments' && (
                <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-sm overflow-hidden animate-in fade-in">
                    <div className="bg-slate-50 px-6 py-4 border-b-2 border-slate-200 flex justify-between items-center">
                        <h3 className="text-lg font-black text-slate-900">Registered Offices</h3>
                        <button onClick={openOfficeModal} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm flex items-center gap-1.5 transition-all active:scale-95 shadow-md">
                            <Plus size={16} strokeWidth={3} /> Add Office
                        </button>
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {departments.map((dept) => (
                                <div key={dept.id} className="flex items-start justify-between p-5 bg-white rounded-2xl border-2 border-slate-200 shadow-sm">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <span className="text-xs font-bold font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-600">{dept.office_id || 'OFC-LEGACY'}</span>
                                            <h4 className="font-black text-slate-900 text-lg leading-tight">{dept.name}</h4>
                                        </div>
                                        <p className="text-sm font-bold text-slate-500 flex items-start gap-1.5 mt-2">
                                            <MapPin size={16} className="shrink-0 mt-0.5 text-slate-400" />
                                            {dept.office_address || 'No address provided'}
                                        </p>
                                    </div>
                                    <button onClick={() => setDeleteConfirm({ id: dept.id, name: dept.name })} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors shrink-0"><Trash2 size={18} /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* CATEGORIES */}
            {dirTab === 'categories' && (
                <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-sm overflow-hidden animate-in fade-in">
                    <div className="bg-slate-50 px-6 py-4 border-b-2 border-slate-200 flex justify-between items-center">
                        <h3 className="text-lg font-black text-slate-900">Document Categories</h3>
                        <button onClick={openCatModal} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm flex items-center gap-1.5 transition-all active:scale-95 shadow-md">
                            <Plus size={16} strokeWidth={3} /> Add Category
                        </button>
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {categories.map((cat) => (
                                <div key={cat.id} className="flex items-start justify-between p-5 bg-white rounded-2xl border-2 border-slate-200 shadow-sm">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <span className="text-xs font-bold font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-600">{cat.category_id || 'CAT-LEGACY'}</span>
                                            <h4 className="font-black text-slate-900 text-lg leading-tight">{cat.name}</h4>
                                        </div>
                                    </div>
                                    <button onClick={() => setDeleteCatConfirm({ id: cat.id, name: cat.name })} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors shrink-0"><Trash2 size={18} /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* EMPLOYEES */}
            {dirTab === 'employees' && (
                <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-sm overflow-hidden animate-in fade-in">
                    <div className="bg-slate-50 px-6 py-4 border-b-2 border-slate-200 flex justify-between items-center">
                        <h3 className="text-lg font-black text-slate-900">Employee Directory</h3>
                        <button onClick={openEmployeeModal} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm flex items-center gap-1.5 transition-all active:scale-95 shadow-md">
                            <Plus size={16} strokeWidth={3} /> Register Employee
                        </button>
                    </div>
                    <div className="p-6 space-y-4">
                        {employees.map((emp) => (
                            <div key={emp.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-white rounded-2xl border-2 border-slate-200 shadow-sm gap-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-bold font-mono bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 text-slate-700">{emp.emp_id}</span>
                                        <h4 className="font-black text-lg text-slate-900">{emp.name}</h4>
                                    </div>
                                    <p className="text-sm font-bold text-slate-600">{emp.designation} <span className="mx-2 text-slate-300">|</span> <span className="text-blue-600">{emp.department}</span></p>
                                    {emp.email && <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5"><Mail size={14}/>{emp.email}</p>}
                                </div>
                                <button onClick={() => setDeleteEmpConfirm({ id: emp.id, name: emp.name, emp_id: emp.emp_id })} className="p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors shrink-0 self-end sm:self-center">
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
      )}

      {/* =========================================
          VIEW 3: AUDIT LOGS
      ========================================= */}
      {mainTab === 'audit' && (
        <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-slate-900 px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-white">
                <div className="flex items-center gap-3">
                    <ClipboardList className="text-blue-400" size={24} />
                    <h3 className="text-xl font-black tracking-wide">System Security Audit Logs</h3>
                </div>
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input type="text" placeholder="Search logs..." className="w-full pl-9 pr-4 py-2 bg-slate-800 border-2 border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-400 focus:border-blue-500 outline-none transition-colors" />
                </div>
            </div>
            
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b-2 border-slate-200">
                            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Log ID</th>
                            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Timestamp</th>
                            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">User</th>
                            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Action Performed</th>
                            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">IP Address</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {auditLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4 text-sm font-mono text-slate-500">#{log.id}</td>
                                <td className="p-4 text-sm font-bold text-slate-700 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                                <td className="p-4 text-sm font-bold text-slate-900 whitespace-nowrap">{log.user_name}</td>
                                <td className="p-4 text-sm font-medium text-slate-700">{log.action}</td>
                                <td className="p-4 text-sm font-mono text-slate-500">{log.ip_address || 'Internal'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {auditLogs.length === 0 && (
                    <div className="p-8 text-center text-slate-500 font-bold">No audit logs found.</div>
                )}
            </div>
            <div className="bg-slate-50 p-4 border-t-2 border-slate-200 text-center">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Showing latest 50 logs. Logs are immutable.</p>
            </div>
        </div>
      )}

      {/* =========================================
          VIEW 4: GLOBAL SYSTEM SETTINGS
      ========================================= */}
      {mainTab === 'settings' && (
        <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-sm animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-slate-900 px-6 py-5 flex items-center gap-3 text-white rounded-t-[22px]">
                <Settings className="text-blue-400" size={24} />
                <h3 className="text-xl font-black tracking-wide">Global System Configuration</h3>
            </div>
            <div className="p-6 sm:p-8 space-y-8 relative z-10">
                
                {/* Maintenance Mode */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-red-50 border-2 border-red-200 rounded-2xl">
                    <div>
                        <h4 className="font-black text-red-900 text-lg flex items-center gap-2">
                            <AlertTriangle size={20} className="text-red-600"/> Maintenance Mode
                        </h4>
                        <p className="text-sm text-red-800 font-medium mt-1">Prevents non-admin users from logging in during system updates.</p>
                    </div>
                    <button 
                        onClick={() => setGlobalSettings({...globalSettings, maintenanceMode: !globalSettings.maintenanceMode})}
                        className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none ${globalSettings.maintenanceMode ? 'bg-red-600 border-red-700' : 'bg-slate-300 border-slate-400'}`}
                    >
                        <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out mt-0.5 ml-0.5 ${globalSettings.maintenanceMode ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Session Timeout */}
                    <div className="max-w-md">
                        <label className="block text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
                            <Clock size={18} className="text-slate-500"/> Auto-Logout Session Timeout
                        </label>
                        <CustomSelect 
                            options={sessionOptions}
                            value={globalSettings.sessionTimeout}
                            onChange={(val: string) => setGlobalSettings({...globalSettings, sessionTimeout: val})}
                            placeholder="Select Timeout..."
                        />
                        <p className="text-xs font-bold text-slate-500 mt-2">Logs users out after inactivity.</p>
                    </div>
                </div>

            </div>
            <div className="bg-slate-50 p-6 border-t-2 border-slate-200 flex justify-end rounded-b-[22px]">
                <button onClick={saveGlobalSettings} className="w-full sm:w-auto px-8 py-4 bg-slate-900 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 text-base border-2 border-slate-900 hover:border-blue-700 shadow-md">
                    <Save size={20} /> Apply Global Settings
                </button>
            </div>
        </div>
      )}

      {/* =========================================
          MODALS WITH ANIMATIONS
      ========================================= */}
      
      {/* MODAL 1: ADD DEPARTMENT / OFFICE */}
      {isDeptModalOpen && (
        <div className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50 backdrop-blur-sm ${isClosingDept ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
          <div className={`bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden ${isClosingDept ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <h3 className="font-black text-xl">Add New Office</h3>
              <button onClick={closeDeptModal} className="p-2 bg-white/10 hover:bg-white/20 rounded-full"><X size={20} /></button>
            </div>
            <form onSubmit={handleAddDepartment} className="p-6 space-y-5">
              
              <div className="bg-blue-50 border-2 border-blue-200 p-4 rounded-xl flex items-center justify-between">
                 <div>
                    <p className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-0.5">Auto-Generated Office ID</p>
                    <p className="font-mono text-lg font-black text-slate-900 tracking-widest">{newOffice.office_id}</p>
                 </div>
                 <Hash className="text-blue-500" size={24} />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1.5">Office Name *</label>
                <input 
                  type="text" 
                  value={newOffice.office_name} 
                  onChange={(e) => setNewOffice({...newOffice, office_name: e.target.value})} 
                  placeholder="e.g. Provincial Engineering Office" 
                  className="w-full p-3.5 bg-slate-50 border-2 border-slate-400 rounded-xl focus:border-slate-900 outline-none font-bold text-slate-900 text-base" 
                  autoFocus 
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1.5 flex items-center gap-1.5"><MapPin size={16} /> Office Address *</label>
                <textarea 
                  value={newOffice.office_address} 
                  onChange={(e) => setNewOffice({...newOffice, office_address: e.target.value})} 
                  placeholder="e.g. 2nd Floor, Capitol Building, Bangued, Abra" 
                  className="w-full p-3.5 bg-slate-50 border-2 border-slate-400 rounded-xl focus:border-slate-900 outline-none font-bold text-slate-900 text-base min-h-[100px] resize-y" 
                ></textarea>
              </div>

              <div className="pt-4 flex gap-3 shrink-0">
                <button type="button" onClick={closeDeptModal} className="flex-1 py-3.5 bg-white border-2 border-slate-300 text-slate-700 font-bold rounded-xl active:scale-95 transition-transform text-base">Cancel</button>
                <button type="submit" className="flex-[1.5] py-3.5 bg-slate-900 text-white font-bold rounded-xl border-2 border-slate-900 active:scale-95 transition-transform text-base">Register Office</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL - OFFICES */}
      {deleteConfirm && (
        <div className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50 backdrop-blur-sm ${isClosingDelete ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
          <div className={`bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden ${isClosingDelete ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
            <div className="bg-red-700 text-white p-5 flex items-center justify-between">
              <h3 className="font-black text-xl flex items-center gap-2"><AlertCircle size={22} /> Confirm Deletion</h3>
              <button onClick={closeDeleteModal} className="p-2 bg-white/10 hover:bg-white/20 rounded-full"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-base text-slate-700 font-medium">
                Are you sure you want to delete <strong className="text-slate-900">{deleteConfirm.name}</strong>? This action cannot be undone.
              </p>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={closeDeleteModal} className="flex-1 py-3.5 bg-white border-2 border-slate-300 text-slate-700 font-bold rounded-xl active:scale-95 transition-transform text-base">Cancel</button>
                <button type="button" onClick={confirmDeleteDepartment} className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl border-2 border-red-700 active:scale-95 transition-transform text-base shadow-md">Yes, Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD CATEGORY */}
      {isCatModalOpen && (
        <div className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50 backdrop-blur-sm ${isClosingCat ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
          <div className={`bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden ${isClosingCat ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <h3 className="font-black text-xl">Add Document Category</h3>
              <button onClick={closeCatModal} className="p-2 bg-white/10 hover:bg-white/20 rounded-full"><X size={20} /></button>
            </div>
            <form onSubmit={handleAddCategory} className="p-6 space-y-5">
              
              <div className="bg-blue-50 border-2 border-blue-200 p-4 rounded-xl flex items-center justify-between">
                 <div>
                    <p className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-0.5">Auto-Generated Category ID</p>
                    <p className="font-mono text-lg font-black text-slate-900 tracking-widest">{newCat.category_id}</p>
                 </div>
                 <FolderTree className="text-blue-500" size={24} />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1.5">Category Name *</label>
                <input 
                  type="text" 
                  value={newCat.name} 
                  onChange={(e) => setNewCat({...newCat, name: e.target.value})} 
                  placeholder="e.g. Purchase Request" 
                  className="w-full p-3.5 bg-slate-50 border-2 border-slate-400 rounded-xl focus:border-slate-900 outline-none font-bold text-slate-900 text-base" 
                  autoFocus 
                />
              </div>

              <div className="pt-4 flex gap-3 shrink-0">
                <button type="button" onClick={closeCatModal} className="flex-1 py-3.5 bg-white border-2 border-slate-300 text-slate-700 font-bold rounded-xl active:scale-95 transition-transform text-base">Cancel</button>
                <button type="submit" className="flex-[1.5] py-3.5 bg-slate-900 text-white font-bold rounded-xl border-2 border-slate-900 active:scale-95 transition-transform text-base">Save Category</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL - CATEGORIES */}
      {deleteCatConfirm && (
        <div className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50 backdrop-blur-sm ${isClosingCatDelete ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
          <div className={`bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden ${isClosingCatDelete ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
            <div className="bg-red-700 text-white p-5 flex items-center justify-between">
              <h3 className="font-black text-xl flex items-center gap-2"><AlertCircle size={22} /> Confirm Deletion</h3>
              <button onClick={closeCatDeleteModal} className="p-2 bg-white/10 hover:bg-white/20 rounded-full"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-base text-slate-700 font-medium">
                Are you sure you want to delete <strong className="text-slate-900">{deleteCatConfirm.name}</strong>? This action cannot be undone.
              </p>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={closeCatDeleteModal} className="flex-1 py-3.5 bg-white border-2 border-slate-300 text-slate-700 font-bold rounded-xl active:scale-95 transition-transform text-base">Cancel</button>
                <button type="button" onClick={confirmDeleteCategory} className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl border-2 border-red-700 active:scale-95 transition-transform text-base shadow-md">Yes, Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL - EMPLOYEES */}
      {deleteEmpConfirm && (
        <div className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50 backdrop-blur-sm ${isClosingEmpDelete ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
          <div className={`bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden ${isClosingEmpDelete ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
            <div className="bg-red-700 text-white p-5 flex items-center justify-between">
              <h3 className="font-black text-xl flex items-center gap-2"><AlertCircle size={22} /> Confirm Deletion</h3>
              <button onClick={closeEmpDeleteModal} className="p-2 bg-white/10 hover:bg-white/20 rounded-full"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-base text-slate-700 font-medium">
                Are you sure you want to permanently delete <strong className="text-slate-900">{deleteEmpConfirm.name}</strong>? This action cannot be undone.
              </p>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={closeEmpDeleteModal} className="flex-1 py-3.5 bg-white border-2 border-slate-300 text-slate-700 font-bold rounded-xl active:scale-95 transition-transform text-base">Cancel</button>
                <button type="button" onClick={confirmDeleteEmployee} className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl border-2 border-red-700 active:scale-95 transition-transform text-base shadow-md">Yes, Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: REGISTER EMPLOYEE */}
      {isEmpModalOpen && (
        <div className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50 backdrop-blur-sm ${isClosingEmp ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
          <div className={`bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] ${isClosingEmp ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between shrink-0">
              <h3 className="font-black text-xl">Register New Employee</h3>
              <button onClick={closeEmpModal} className="p-2 bg-white/10 hover:bg-white/20 rounded-full"><X size={20} /></button>
            </div>
            <form onSubmit={handleAddEmployee} className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
              
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1.5">Employee ID *</label>
                <input type="text" value={newEmp.emp_id} onChange={(e) => setNewEmp({...newEmp, emp_id: e.target.value})} placeholder="EMP-2026-105" className="w-full p-3.5 bg-slate-50 border-2 border-slate-400 rounded-xl focus:border-slate-900 outline-none font-bold text-slate-900 font-mono text-base" />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1.5">Full Name *</label>
                <input type="text" value={newEmp.name} onChange={(e) => setNewEmp({...newEmp, name: e.target.value})} placeholder="Juan Dela Cruz" className="w-full p-3.5 bg-slate-50 border-2 border-slate-400 rounded-xl focus:border-slate-900 outline-none font-bold text-slate-900 text-base" />
              </div>

              {/* NEW EMAIL FIELD */}
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1.5 flex items-center gap-1.5"><Mail size={16} /> Email Address *</label>
                <input type="email" value={newEmp.email} onChange={(e) => setNewEmp({...newEmp, email: e.target.value})} placeholder="employee@abrapho.gov.ph" className="w-full p-3.5 bg-slate-50 border-2 border-slate-400 rounded-xl focus:border-slate-900 outline-none font-bold text-slate-900 text-base" />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1.5">Designation *</label>
                <input type="text" value={newEmp.designation} onChange={(e) => setNewEmp({...newEmp, designation: e.target.value})} placeholder="Administrative Officer II" className="w-full p-3.5 bg-slate-50 border-2 border-slate-400 rounded-xl focus:border-slate-900 outline-none font-bold text-slate-900 text-base" />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1.5 flex items-center gap-1.5"><Phone size={16} /> Contact Number *</label>
                <input type="tel" value={newEmp.contactNumber} onChange={(e) => setNewEmp({...newEmp, contactNumber: e.target.value})} placeholder="0917 123 4567" className="w-full p-3.5 bg-slate-50 border-2 border-slate-400 rounded-xl focus:border-slate-900 outline-none font-bold text-slate-900 text-base" />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1.5">Department / Agency *</label>
                <CustomSelect 
                    options={departments.map(d => ({ value: d.name, label: d.name }))} 
                    value={newEmp.department} 
                    onChange={(val: string) => setNewEmp({...newEmp, department: val})} 
                    placeholder="Select Department..." 
                />
              </div>

              <div className="pt-2 border-t-2 border-slate-100">
                  <div className="flex justify-between items-end mb-1.5">
                    <label className="block text-sm font-bold text-slate-900">Password *</label>
                    <button type="button" onClick={handleGeneratePassword} className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-md border border-blue-200 active:scale-95">
                        <Zap size={14} /> Auto-Generate
                    </button>
                  </div>
                  <input type="text" value={newEmp.password} onChange={(e) => setNewEmp({...newEmp, password: e.target.value})} placeholder="Enter temporary password" className="w-full p-3.5 bg-slate-50 border-2 border-slate-400 rounded-xl focus:border-slate-900 outline-none font-bold text-slate-900 text-base" />
              </div>

              <div>
                  <label className="block text-sm font-bold text-slate-900 mb-1.5">Confirm Password *</label>
                  <input type="text" value={newEmp.confirmPassword} onChange={(e) => setNewEmp({...newEmp, confirmPassword: e.target.value})} placeholder="Re-enter temporary password" className="w-full p-3.5 bg-slate-50 border-2 border-slate-400 rounded-xl focus:border-slate-900 outline-none font-bold text-slate-900 text-base" />
              </div>

              <div className="pt-4 flex gap-3 shrink-0">
                <button type="button" onClick={closeEmpModal} className="flex-1 py-3.5 bg-white border-2 border-slate-300 text-slate-700 font-bold rounded-xl active:scale-95 transition-transform text-base">Cancel</button>
                <button type="submit" className="flex-[1.5] py-3.5 bg-slate-900 text-white font-bold rounded-xl border-2 border-slate-900 active:scale-95 transition-transform text-base">Register Account</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

// --- Helper Components --- //

function MainNavButton({ label, icon, isActive, onClick }: NavButtonProps) {
    return (
      <button 
        onClick={onClick}
        title={label}
        className={`flex-none shrink-0 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-black transition-all active:scale-95 text-sm whitespace-nowrap overflow-hidden border-2 ${
          isActive 
          ? 'bg-blue-600 text-white shadow-md border-blue-500' 
          : 'bg-transparent text-slate-400 hover:bg-slate-800 hover:text-white border-transparent'
        }`}
      >
        {icon}
        {isActive && <span className="animate-in fade-in slide-in-from-left-2 duration-200">{label}</span>}
      </button>
    );
}

function SubTabButton({ label, icon, isActive, onClick }: NavButtonProps) {
  return (
    <button 
      onClick={onClick}
      title={label}
      className={`flex-none shrink-0 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold transition-all active:scale-95 text-sm whitespace-nowrap overflow-hidden border-2 ${
        isActive 
        ? 'bg-slate-900 text-white shadow-md border-slate-800' 
        : 'bg-transparent text-slate-500 border-transparent hover:border-slate-200 hover:bg-slate-50'
      }`}
    >
      {icon}
      {isActive && <span className="animate-in fade-in slide-in-from-left-2 duration-200">{label}</span>}
    </button>
  );
}

function StatCard({ title, value, icon, color }: StatCardProps) {
    return (
        <div className={`p-4 sm:p-5 rounded-2xl border-2 flex flex-col justify-between ${color} transition-transform hover:scale-[1.02]`}>
            <div className="flex justify-between items-start mb-2">
                <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100">{icon}</div>
            </div>
            <div>
                <h4 className="text-2xl sm:text-3xl font-black text-slate-900 leading-none mb-1">{value}</h4>
                <p className="text-xs sm:text-sm font-bold text-slate-600 uppercase tracking-wide">{title}</p>
            </div>
        </div>
    );
}