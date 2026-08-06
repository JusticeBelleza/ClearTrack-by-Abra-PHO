import React, { useState, useEffect, useRef } from 'react';
import { X, FileText, AlertCircle, MapPin, Send, ChevronDown, Hash } from 'lucide-react';
import { toast } from 'sonner';
import { useUiStore } from '../../store/uiStore';
import { supabase } from '../../lib/supabase';

// --- Shared Modal Animation Styles ---
const modalAnimationStyles = `
    @keyframes iosSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    @keyframes desktopZoomIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    @keyframes iosSlideDown { from { transform: translateY(0); } to { transform: translateY(100%); } }
    @keyframes desktopZoomOut { from { transform: scale(1); opacity: 1; } to { transform: scale(0.95); opacity: 0; } }
    @keyframes customFadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes customFadeOut { from { opacity: 1; } to { opacity: 0; } }
    
    .animate-overlay-fade { animation: customFadeIn 0.4s ease-out forwards; }
    .animate-overlay-fade-out { animation: customFadeOut 0.3s ease-in forwards; }
    .animate-responsive-modal { animation: iosSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    .animate-responsive-modal-close { animation: iosSlideDown 0.4s cubic-bezier(0.3, 0, 0.8, 0.15) forwards; }

    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 20px; }

    @media (min-width: 640px) {
        .animate-responsive-modal { animation: desktopZoomIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-responsive-modal-close { animation: desktopZoomOut 0.3s cubic-bezier(0.3, 0, 0.8, 0.15) forwards; }
    }
`;

// --- Custom Dropdown Component ---
function CustomSelect({ options, value, onChange, placeholder, disabled = false }: any) {
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
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={`w-full px-4 py-3.5 border-2 rounded-xl flex justify-between items-center transition-all text-base outline-none ${
            disabled ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' :
            isOpen
              ? 'border-blue-600 ring-4 ring-blue-600/10 bg-white'
              : 'bg-slate-50 border-slate-300 hover:bg-slate-100 hover:border-slate-400 active:scale-[0.99]'
          } ${!value && !disabled ? 'text-slate-500' : 'text-slate-900 font-bold'}`}
        >
          <span className="truncate">
            {options.find((opt: any) => (opt.value || opt) === value)?.label || value || placeholder}
          </span>
          {!disabled && (
              <ChevronDown 
                size={20} 
                className={`text-slate-600 transition-transform duration-300 ease-in-out ${isOpen ? 'rotate-180 text-slate-900' : ''}`} 
              />
          )}
        </button>
  
        {isOpen && !disabled && (
          <div className="absolute z-20 w-full mt-2 bg-white border-2 border-slate-300 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="max-h-60 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
              {options.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-slate-500 text-center italic">Loading options...</div>
              ) : (
                  options.map((option: any, idx: number) => {
                    const optValue = option.value || option;
                    const optLabel = option.label || option;
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
                            ? 'bg-blue-600 text-white font-bold'
                            : 'text-slate-800 hover:bg-slate-100 font-medium'
                        }`}
                      >
                        {optLabel}
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        )}
      </div>
    );
}

export default function CreateDocumentModal() {
    const closeCreateModal = useUiStore((state) => state.closeCreateModal);
    
    const [isClosing, setIsClosing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Dynamic Options States
    const [categories, setCategories] = useState<{label: string, value: string}[]>([]);
    const [departments, setDepartments] = useState<{label: string, value: string}[]>([]);

    // Form Data State
    const [formData, setFormData] = useState({
        trackingNumber: `DOC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        title: '',
        category: '',
        destination: '',
        isUrgent: false,
        remarks: ''
    });

    useEffect(() => {
        fetchDropdownOptions();
    }, []);

    const fetchDropdownOptions = async () => {
        try {
            const [catRes, deptRes] = await Promise.all([
                supabase.from('categories').select('name').order('name'),
                supabase.from('departments').select('name').order('name')
            ]);

            if (catRes.data) {
                setCategories(catRes.data.map(c => ({ label: c.name, value: c.name })));
            }
            if (deptRes.data) {
                setDepartments(deptRes.data.map(d => ({ label: d.name, value: d.name })));
            }
        } catch (error) {
            console.error("Error fetching options:", error);
            toast.error("Failed to load categories and offices.");
        }
    };

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            closeCreateModal();
        }, 350); 
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.title.trim() || !formData.category || !formData.destination) {
            toast.error('Please fill in all required fields.');
            return;
        }

        setIsSubmitting(true);

        try {
            // 1. Get the user's active session to log who created it
            const { data: { session } } = await supabase.auth.getSession();

            // 2. Insert the document into Supabase (Matched to your specific table columns)
            const { error } = await supabase.from('documents').insert([{
                reference_no: formData.trackingNumber,
                title: formData.title.trim(),
                category: formData.category,
                final_destination: formData.destination,
                is_urgent: formData.isUrgent,
                remarks: formData.remarks.trim(),
                created_by: session?.user?.id || null
                // REMOVED the status line entirely so the DB uses its default!
            }]);

            if (error) throw error;

            toast.success('Document Routed Successfully!', {
                description: `Tracking No: ${formData.trackingNumber}`
            });
            
            handleClose();

            // Refresh the dashboard immediately
            setTimeout(() => {
                window.location.reload(); 
            }, 800);

        } catch (error: any) {
            console.error("Submit Error:", error);
            toast.error('Failed to route document', { description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm ${isClosing ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
            <style>{modalAnimationStyles}</style>
            <div className={`bg-white w-full max-w-xl max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden shadow-2xl rounded-t-2xl sm:rounded-3xl ${isClosing ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
                
                {/* Header */}
                <div className="bg-slate-900 text-white relative flex flex-col shrink-0">
                    <div className="w-16 h-1.5 bg-white/30 rounded-full mx-auto mt-3 sm:hidden shrink-0"></div>
                    <div className="p-5 pt-3 sm:p-6 flex items-center justify-between">
                        <div>
                            <h3 className="font-black text-xl flex items-center gap-2 mt-2 sm:mt-0">
                                <FileText size={22} className="text-blue-400" /> Route Document
                            </h3>
                        </div>
                        <button onClick={handleClose} disabled={isSubmitting} className="p-2 -mr-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors active:scale-90 disabled:opacity-50">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Scrollable Form */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-8 custom-scrollbar">
                    <div className="space-y-6">

                        {/* Tracking Number Generator */}
                        <div className="bg-blue-50 border-2 border-blue-200 p-4 rounded-xl flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-0.5">System Generated Tracking #</p>
                                <p className="font-mono text-xl font-black text-slate-900 tracking-widest">{formData.trackingNumber}</p>
                            </div>
                            <Hash className="text-blue-500" size={28} />
                        </div>

                        {/* Document Title */}
                        <div>
                            <label className="block text-sm font-bold text-slate-900 mb-1.5">Document Subject / Title *</label>
                            <input 
                                type="text" 
                                value={formData.title}
                                onChange={(e) => setFormData({...formData, title: e.target.value})}
                                placeholder="e.g. Budget Request for Q3" 
                                className="w-full p-3.5 bg-slate-50 border-2 border-slate-300 focus:border-blue-600 rounded-xl outline-none font-bold text-slate-900 text-base transition-colors" 
                                autoFocus
                            />
                        </div>

                        {/* Category & Destination Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-900 mb-1.5 flex items-center gap-1.5">
                                    <FileText size={16} className="text-slate-500"/> Document Category *
                                </label>
                                <CustomSelect 
                                    options={categories}
                                    value={formData.category}
                                    onChange={(val: string) => setFormData({...formData, category: val})}
                                    placeholder="Select Category..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-900 mb-1.5 flex items-center gap-1.5">
                                    <MapPin size={16} className="text-slate-500"/> Final Destination *
                                </label>
                                <CustomSelect 
                                    options={departments}
                                    value={formData.destination}
                                    onChange={(val: string) => setFormData({...formData, destination: val})}
                                    placeholder="Select Office..."
                                />
                            </div>
                        </div>

                        {/* Urgent Toggle */}
                        <div className={`p-4 border-2 rounded-xl flex items-center justify-between transition-colors cursor-pointer active:scale-[0.99] ${formData.isUrgent ? 'bg-red-50 border-red-300' : 'bg-slate-50 border-slate-200'}`} onClick={() => setFormData({...formData, isUrgent: !formData.isUrgent})}>
                            <div>
                                <h4 className={`font-black text-base flex items-center gap-2 ${formData.isUrgent ? 'text-red-700' : 'text-slate-700'}`}>
                                    <AlertCircle size={18} /> Mark as Priority / RUSH
                                </h4>
                                <p className={`text-xs font-medium mt-1 ${formData.isUrgent ? 'text-red-600' : 'text-slate-500'}`}>Flags this document in red for all receiving offices.</p>
                            </div>
                            <div className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none ${formData.isUrgent ? 'bg-red-600 border-red-700' : 'bg-slate-300 border-slate-400'}`}>
                                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out mt-[1px] ml-[1px] ${formData.isUrgent ? 'translate-x-5' : 'translate-x-0'}`} />
                            </div>
                        </div>

                        {/* Remarks */}
                        <div>
                            <label className="block text-sm font-bold text-slate-900 mb-1.5">Initial Remarks / Notes (Optional)</label>
                            <textarea 
                                value={formData.remarks}
                                onChange={(e) => setFormData({...formData, remarks: e.target.value})}
                                placeholder="Add any instructions for the receiving office..." 
                                className="w-full p-3.5 bg-slate-50 border-2 border-slate-300 focus:border-blue-600 rounded-xl outline-none font-bold text-slate-900 text-base min-h-[100px] resize-y transition-colors" 
                            ></textarea>
                        </div>
                    </div>
                </form>

                {/* Footer Actions */}
                <div className="bg-slate-50 p-5 sm:p-6 border-t-2 border-slate-200 flex gap-3 shrink-0 pb-8 sm:pb-6">
                    <button type="button" disabled={isSubmitting} onClick={handleClose} className="flex-1 py-3.5 bg-white border-2 border-slate-300 text-slate-700 font-bold rounded-xl active:scale-95 transition-transform text-base disabled:opacity-50">
                        Cancel
                    </button>
                    <button type="submit" disabled={isSubmitting} onClick={handleSubmit} className="flex-[1.5] py-3.5 bg-blue-600 text-white font-bold rounded-xl border-2 border-blue-700 active:scale-95 transition-all text-base flex justify-center items-center gap-2 disabled:opacity-50 shadow-md hover:bg-blue-700">
                        {isSubmitting ? (
                             <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        ) : (
                             <><Send size={18} /> Route Document</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}