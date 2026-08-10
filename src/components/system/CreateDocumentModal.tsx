import React, { useState, useEffect, useRef } from 'react';
import { X, FileText, AlertCircle, MapPin, Send, ChevronDown, Hash, Camera, Paperclip, CheckCircle, User } from 'lucide-react';
import { toast } from 'sonner';
import { useUiStore } from '../../store/uiStore';
import { supabase } from '../../lib/supabase';
import { jsPDF } from 'jspdf';

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
    disabled?: boolean;
    emptyText?: string;
}

interface Employee {
    name: string;
    department: string;
}

// --- Custom Dropdown Component ---
function CustomSelect({ options, value, onChange, placeholder, disabled = false, emptyText = "Loading options..." }: CustomSelectProps) {
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
            {options.find((opt: OptionType) => (typeof opt === 'string' ? opt : opt.value) === value)
              ? (typeof options.find((opt: OptionType) => (typeof opt === 'string' ? opt : opt.value) === value) === 'string' 
                  ? options.find((opt: OptionType) => (typeof opt === 'string' ? opt : opt.value) === value) as string
                  : (options.find((opt: OptionType) => (typeof opt === 'string' ? opt : opt.value) === value) as SelectOption).label)
              : value || placeholder}
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
                  <div className="px-4 py-3 text-sm text-slate-500 text-center font-medium">{emptyText}</div>
              ) : (
                  options.map((option: OptionType, idx: number) => {
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
    // Note: useUiStore state typing assumed to be handled at the store level or inferred
    const closeCreateModal = useUiStore((state: { closeCreateModal: () => void }) => state.closeCreateModal);
    
    const [isClosing, setIsClosing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isProcessingFile, setIsProcessingFile] = useState(false);

    const [categories, setCategories] = useState<SelectOption[]>([]);
    const [departments, setDepartments] = useState<SelectOption[]>([]);
    
    const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
    const [currentUserDept, setCurrentUserDept] = useState<string>("");

    const [attachment, setAttachment] = useState<File | Blob | null>(null);
    const [attachmentName, setAttachmentName] = useState<string>('');

    // FIX: Lazy initialization to satisfy React's purity rules
    const [formData, setFormData] = useState(() => ({
        trackingNumber: `DOC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        title: '',
        category: '',
        destination: '',
        assignedClerk: '',
        isUrgent: false,
        remarks: ''
    }));

    // FIX: Hoist function definition above the useEffect that calls it
    const fetchDropdownOptions = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            
            const [catRes, deptRes, empRes] = await Promise.all([
                supabase.from('categories').select('name').order('name'),
                supabase.from('departments').select('name').order('name'),
                supabase.from('employees').select('name, department').order('name')
            ]);
            
            if (catRes.data) setCategories(catRes.data.map(c => ({ label: c.name, value: c.name })));
            if (deptRes.data) setDepartments(deptRes.data.map(d => ({ label: d.name, value: d.name })));
            if (empRes.data) setAllEmployees(empRes.data);

            if (session && empRes.data) {
                const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', session.user.id).single();
                if (profile?.full_name) {
                    const matchedEmployee = empRes.data.find((e: Employee) => e.name === profile.full_name);
                    if (matchedEmployee) {
                        setCurrentUserDept(matchedEmployee.department);
                    }
                }
            }
        } catch (error) {
            console.error("Error fetching options:", error);
        }
    };

    useEffect(() => {
        fetchDropdownOptions();
    }, []);

    const availableClerks = allEmployees
        .filter(emp => currentUserDept ? emp.department === currentUserDept : true)
        .map(emp => ({ label: emp.name, value: emp.name }));

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => closeCreateModal(), 350); 
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsProcessingFile(true);
        setAttachmentName("Processing file...");

        try {
            if (file.type === 'application/pdf') {
                setAttachment(file);
                setAttachmentName(file.name);
            } else if (file.type.startsWith('image/')) {
                const pdfBlob = await processImageToScannedPDF(file);
                setAttachment(pdfBlob);
                setAttachmentName(`Scanned_Doc_${formData.trackingNumber}.pdf`);
            } else {
                toast.error("Unsupported file type. Please upload an image or PDF.");
                setAttachmentName("");
            }
        } catch (err) {
            console.error("File processing error:", err);
            toast.error("Failed to process the document.");
            setAttachmentName("");
        } finally {
            setIsProcessingFile(false);
        }
    };

    const processImageToScannedPDF = (file: File): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return reject("Canvas not supported");

                    canvas.width = img.width;
                    canvas.height = img.height;

                    ctx.filter = 'grayscale(100%) contrast(150%) brightness(110%)';
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                    const processedDataUrl = canvas.toDataURL('image/jpeg', 0.8);

                    const pdf = new jsPDF({
                        orientation: img.width > img.height ? 'landscape' : 'portrait',
                        unit: 'px',
                        format: [img.width, img.height]
                    });

                    pdf.addImage(processedDataUrl, 'JPEG', 0, 0, img.width, img.height);
                    resolve(pdf.output('blob'));
                };
                img.onerror = reject;
                img.src = event.target?.result as string;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.title.trim() || !formData.category || !formData.destination) {
            toast.error('Please fill in all required fields.');
            return;
        }

        if (availableClerks.length > 0 && !formData.assignedClerk) {
            toast.error('Please select an internal clerk to assign this to.');
            return;
        }

        setIsSubmitting(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            let attachmentUrl = null;

            if (attachment) {
                const fileExt = 'pdf';
                const fileName = `${formData.trackingNumber}-${Math.random()}.${fileExt}`;
                
                const { error: uploadError } = await supabase.storage
                    .from('attachments')
                    .upload(fileName, attachment, { contentType: 'application/pdf' });

                if (uploadError) throw uploadError;

                const { data } = supabase.storage.from('attachments').getPublicUrl(fileName);
                attachmentUrl = data.publicUrl;
            }

            // 1. Insert Document and get its returned ID (.select().single())
            const { data: newDoc, error } = await supabase.from('documents').insert([{
                reference_no: formData.trackingNumber,
                title: formData.title.trim(),
                category: formData.category,
                final_destination: formData.destination,
                assigned_clerk: formData.assignedClerk || null,
                is_urgent: formData.isUrgent,
                remarks: formData.remarks.trim(),
                created_by: session?.user?.id || null,
                attachment_url: attachmentUrl,
                status: 'routing' 
            }]).select().single();

            if (error) throw error;

            // 2. Automatically log the creation event!
            await supabase.from('document_logs').insert([{
                document_id: newDoc.id,
                action: 'Document Logged',
                location: currentUserDept || 'Originating Office',
                attachment_url: attachmentUrl,
                created_by: session?.user?.id || null
            }]);

            toast.success('Document Routed Successfully!', { description: `Tracking No: ${formData.trackingNumber}` });
            handleClose();

            setTimeout(() => { window.location.reload(); }, 800);

        } catch (error: unknown) {
            console.error("Submit Error:", error);
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            toast.error('Failed to route document', { description: errorMessage });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm ${isClosing ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
            <style>{modalAnimationStyles}</style>
            <div className={`bg-white w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden shadow-2xl rounded-t-2xl sm:rounded-3xl ${isClosing ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
                
                <div className="bg-slate-900 text-white relative flex flex-col shrink-0">
                    <div className="w-16 h-1.5 bg-white/30 rounded-full mx-auto mt-3 sm:hidden shrink-0"></div>
                    <div className="p-5 pt-3 sm:p-6 flex items-center justify-between">
                        <h3 className="font-black text-xl flex items-center gap-2 mt-2 sm:mt-0">
                            <FileText size={22} className="text-blue-400" /> Route Document
                        </h3>
                        <button onClick={handleClose} disabled={isSubmitting} className="p-2 -mr-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors active:scale-90 disabled:opacity-50">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-8 custom-scrollbar">
                    <div className="space-y-6">

                        <div className="bg-blue-50 border-2 border-blue-200 p-4 rounded-xl flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-0.5">Tracking Number</p>
                                <p className="font-mono text-xl font-black text-slate-900 tracking-widest">{formData.trackingNumber}</p>
                            </div>
                            <Hash className="text-blue-500" size={28} />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-900 mb-1.5">Document Subject / Title *</label>
                            <input 
                                type="text" 
                                value={formData.title}
                                onChange={(e) => setFormData({...formData, title: e.target.value})}
                                placeholder="e.g. Budget Request for Q3" 
                                className="w-full p-3.5 bg-slate-50 border-2 border-slate-300 focus:border-blue-600 rounded-xl outline-none font-bold text-slate-900 text-base transition-colors" 
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-900 mb-1.5">Scanned Attachment (Optional)</label>
                            <div className="flex items-center gap-3">
                                <label className={`hidden sm:flex flex-1 items-center justify-center gap-2 p-3.5 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${attachment ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-slate-50 border-slate-300 text-slate-600 hover:bg-slate-100'}`}>
                                    <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} disabled={isProcessingFile} />
                                    {isProcessingFile ? <span className="animate-pulse font-bold">Processing PDF...</span> : attachment ? <><CheckCircle size={18}/> <span className="font-bold truncate max-w-[200px]">{attachmentName}</span></> : <><Paperclip size={18}/> <span className="font-bold">Attach File / PDF</span></>}
                                </label>

                                <label className={`flex sm:hidden flex-1 items-center justify-center gap-2 p-3.5 border-2 border-dashed rounded-xl cursor-pointer transition-colors active:scale-95 ${attachment ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-slate-50 border-slate-300 text-slate-600 hover:bg-slate-100'}`}>
                                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} disabled={isProcessingFile} />
                                    {isProcessingFile ? <span className="animate-pulse font-bold">Processing PDF...</span> : attachment ? <><CheckCircle size={18}/> <span className="font-bold truncate max-w-[150px]">{attachmentName}</span></> : <><Camera size={18}/> <span className="font-bold">Scan Document</span></>}
                                </label>

                                {attachment && !isProcessingFile && (
                                    <button type="button" onClick={() => { setAttachment(null); setAttachmentName(''); }} className="p-3.5 bg-red-50 text-red-600 rounded-xl border-2 border-red-200 hover:bg-red-100 active:scale-95 transition-all">
                                        <X size={18} />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-900 mb-1.5 flex items-center gap-1.5">Document Category *</label>
                            <CustomSelect options={categories} value={formData.category} onChange={(val: string) => setFormData({...formData, category: val})} placeholder="Select Category..." />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 rounded-xl border-2 border-blue-100 bg-blue-50/50">
                            <div>
                                <label className="block text-sm font-bold text-slate-900 mb-1.5 flex items-center gap-1.5">
                                    <MapPin size={16} className="text-blue-600" /> Final Destination *
                                </label>
                                <CustomSelect 
                                    options={departments} 
                                    value={formData.destination} 
                                    onChange={(val: string) => setFormData({...formData, destination: val})} 
                                    placeholder="Select Office..." 
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-900 mb-1.5 flex items-center gap-1.5">
                                    <User size={16} className="text-blue-600" /> Assign To (Internal Clerk) *
                                </label>
                                <CustomSelect 
                                    options={availableClerks} 
                                    value={formData.assignedClerk} 
                                    onChange={(val: string) => setFormData({...formData, assignedClerk: val})} 
                                    placeholder="Select employee..." 
                                    emptyText={currentUserDept ? `No staff registered under ${currentUserDept}` : "No staff found"}
                                />
                            </div>
                        </div>

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

                <div className="bg-slate-50 p-5 sm:p-6 border-t-2 border-slate-200 flex gap-3 shrink-0 pb-8 sm:pb-6">
                    <button type="button" disabled={isSubmitting || isProcessingFile} onClick={handleClose} className="flex-1 py-3.5 bg-white border-2 border-slate-300 text-slate-700 font-bold rounded-xl active:scale-95 transition-transform text-base disabled:opacity-50">
                        Cancel
                    </button>
                    <button type="submit" disabled={isSubmitting || isProcessingFile} onClick={handleSubmit} className="flex-[1.5] py-3.5 bg-blue-600 text-white font-bold rounded-xl border-2 border-blue-700 active:scale-95 transition-all text-base flex justify-center items-center gap-2 disabled:opacity-50 shadow-md hover:bg-blue-700">
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