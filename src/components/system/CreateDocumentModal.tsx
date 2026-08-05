import { useState, useRef, useEffect } from 'react';
import { X, AlertCircle, UploadCloud, Check, ChevronDown } from 'lucide-react';
import { useUiStore } from '../../store/uiStore';

// --- Shared Data ---
const destinationOffices = [
  "Provincial Budget Office",
  "Provincial Accounting Office",
  "Provincial Treasurer's Office",
  "Governor's Office",
  "Provincial Administrator's Office",
  "Sangguniang Panlalawigan",
  "HRMO"
];

const categoryOptions = [
  "Voucher / Financial",
  "Official Memo",
  "Budget Request",
  "HR / Personnel File",
  "General Letter"
];

const liaisonOptions = [
  { label: "Assign to Myself (Process directly)", value: "self" },
  { label: "Juan Dela Cruz", value: "liaison-1" },
  { label: "Maria Santos", value: "liaison-2" }
];

// --- Custom Senior-Friendly Dropdown Component ---
function CustomSelect({ options, value, onChange, placeholder }: any) {
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
          {options.find((opt: any) => opt.value === value)?.label || value || placeholder}
        </span>
        <ChevronDown 
          size={20} 
          className={`text-slate-600 transition-transform duration-300 ease-in-out ${isOpen ? 'rotate-180 text-slate-900' : ''}`} 
        />
      </button>

      {isOpen && (
        <div className="absolute z-20 w-full mt-2 bg-white border-2 border-slate-400 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="max-h-60 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
            {options.map((option: any, idx: number) => {
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

// --- Main Modal Component ---
export default function CreateDocumentModal() {
  const [isUrgent, setIsUrgent] = useState(false);
  const [category, setCategory] = useState('');
  const [destination, setDestination] = useState('');
  const [liaison, setLiaison] = useState('');
  
  const [isClosing, setIsClosing] = useState(false);
  const closeCreateModal = useUiStore((state) => state.closeCreateModal);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      closeCreateModal();
    }, 400); 
  };

  return (
    <>
      <style>{`
        /* Entrance Keyframes */
        @keyframes customFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes iosSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes desktopZoomIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        
        /* Exit Keyframes */
        @keyframes customFadeOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes iosSlideDown { from { transform: translateY(0); } to { transform: translateY(100%); } }
        @keyframes desktopZoomOut { from { transform: scale(1); opacity: 1; } to { transform: scale(0.95); opacity: 0; } }
        
        /* Apply Animation Classes */
        .animate-overlay-fade { animation: customFadeIn 0.5s ease-out forwards; }
        .animate-overlay-fade-out { animation: customFadeOut 0.4s ease-in forwards; }
        .animate-responsive-modal { animation: iosSlideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-responsive-modal-close { animation: iosSlideDown 0.4s cubic-bezier(0.3, 0, 0.8, 0.15) forwards; }
        
        @media (min-width: 640px) {
          .animate-responsive-modal { animation: desktopZoomIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
          .animate-responsive-modal-close { animation: desktopZoomOut 0.3s cubic-bezier(0.3, 0, 0.8, 0.15) forwards; }
        }
      `}</style>

      {/* Overlay */}
      <div className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50 backdrop-blur-sm ${isClosing ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
        
        {/* Modal Container */}
        <div className={`bg-white w-full max-w-2xl max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden shadow-2xl rounded-t-2xl sm:rounded-2xl ${isClosing ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
          
          <div className="w-16 h-1.5 bg-slate-300 rounded-full mx-auto mt-3 sm:hidden shrink-0"></div>

          {/* Header */}
          <div className="px-6 sm:px-8 pt-4 sm:pt-6 pb-4 flex justify-between items-center shrink-0">
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">New Document</h3>
              <p className="text-base text-slate-600 mt-1">Enter the details to initiate tracking.</p>
            </div>
            <button 
              onClick={handleClose} 
              className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-full transition-all active:scale-90 border border-slate-200"
              aria-label="Close modal"
            >
              <X size={24} strokeWidth={2.5} />
            </button>
          </div>

          {/* Scrollable Form Body */}
          <div className="flex-1 overflow-y-auto px-6 sm:px-8 pb-8 space-y-7">
            
            <div className="flex flex-col sm:flex-row gap-5">
              <div className="flex-1">
                <label className="block text-base font-bold text-slate-900 mb-2">Reference ID <span className="text-slate-500 font-medium">(Optional)</span></label>
                <input 
                  type="text" 
                  placeholder="PR-2026-001" 
                  className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-400 rounded-xl focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 focus:bg-white outline-none transition-all font-mono text-base placeholder:text-slate-500 font-bold text-slate-900" 
                />
              </div>
              
              <div className="flex items-end">
                <button 
                  onClick={() => setIsUrgent(!isUrgent)}
                  className={`h-[54px] w-full sm:w-auto px-6 rounded-xl font-bold border-2 transition-all active:scale-95 flex items-center justify-center gap-2 text-base ${
                    isUrgent 
                      ? 'bg-red-600 border-red-700 text-white shadow-lg shadow-red-200' 
                      : 'bg-white border-slate-400 text-slate-800 hover:bg-slate-50 hover:border-slate-600'
                  }`}
                >
                  <AlertCircle size={20} strokeWidth={isUrgent ? 2.5 : 2} />
                  Priority / RUSH
                </button>
              </div>
            </div>

            <div>
              <label className="block text-base font-bold text-slate-900 mb-2">Document Subject *</label>
              <input 
                type="text" 
                placeholder="E.g., Budget Request for Q3..." 
                className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-400 rounded-xl focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 focus:bg-white outline-none transition-all placeholder:text-slate-500 text-slate-900 font-bold text-base" 
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 relative z-20">
              <div>
                <label className="block text-base font-bold text-slate-900 mb-2">Category *</label>
                <CustomSelect 
                  options={categoryOptions} 
                  value={category} 
                  onChange={setCategory} 
                  placeholder="Select category..." 
                />
              </div>
              <div>
                <label className="block text-base font-bold text-slate-900 mb-2">Final Destination *</label>
                <CustomSelect 
                  options={destinationOffices} 
                  value={destination} 
                  onChange={setDestination} 
                  placeholder="Select office..." 
                />
              </div>
            </div>

            <div className="relative z-10">
              <label className="block text-base font-bold text-slate-900 mb-2">Assign Liaison *</label>
              <CustomSelect 
                  options={liaisonOptions} 
                  value={liaison} 
                  onChange={setLiaison} 
                  placeholder="Select liaison..." 
                />
            </div>

            <div>
              <label className="block text-base font-bold text-slate-900 mb-2">Notes <span className="text-slate-500 font-medium">(Optional)</span></label>
              <textarea 
                placeholder="Add any routing instructions here..." 
                className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-400 rounded-xl focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 focus:bg-white outline-none transition-all placeholder:text-slate-500 min-h-[100px] resize-y text-base font-medium text-slate-900" 
              ></textarea>
            </div>

            <div>
              <label className="block text-base font-bold text-slate-900 mb-2">Attachment <span className="text-slate-500 font-medium">(Optional)</span></label>
              <div className="border-2 border-dashed border-slate-400 rounded-2xl bg-slate-50 p-6 flex flex-col items-center justify-center text-center hover:bg-slate-100 hover:border-slate-600 transition-all cursor-pointer group active:scale-[0.98]">
                <UploadCloud size={32} className="text-slate-500 group-hover:text-slate-700 transition-colors mb-3" strokeWidth={2} />
                <p className="text-base font-bold text-slate-900">Click to upload document</p>
                <p className="text-sm text-slate-600 mt-1 font-medium">PDF, JPG, or PNG up to 10MB</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 sm:px-8 py-5 pb-8 sm:pb-5 border-t-2 border-slate-200 bg-slate-50 flex justify-end gap-3 shrink-0 sm:rounded-b-2xl">
            <button 
              onClick={handleClose}
              className="px-6 py-3 rounded-xl font-bold text-base text-slate-700 hover:text-slate-900 hover:bg-slate-200 transition-all active:scale-95 border-2 border-transparent hover:border-slate-300"
            >
              Cancel
            </button>
            <button 
              onClick={() => {
                console.log({ category, destination, liaison, isUrgent });
                handleClose();
              }}
              className="px-6 py-3 rounded-xl font-bold text-base text-white bg-slate-900 hover:bg-slate-800 shadow-md shadow-slate-900/20 transition-all active:scale-95 flex items-center gap-2 border-2 border-slate-900"
            >
              <Check size={20} strokeWidth={2.5} /> 
              Create Profile
            </button>
          </div>
        </div>
      </div>
    </>
  );
}