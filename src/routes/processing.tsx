import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Search, Activity, AlertCircle, MapPin, Briefcase, 
  User, Clock, ChevronRight, ArrowLeft, PenTool, X, CheckCircle, ChevronDown, Save, FileText, Check
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

// --- Shared Animation Styles for Modals ---
const modalAnimationStyles = `
    /* Entrance Keyframes */
    @keyframes customFadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes iosSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    @keyframes desktopZoomIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    
    /* Exit Keyframes */
    @keyframes customFadeOut { from { opacity: 1; } to { opacity: 0; } }
    @keyframes iosSlideDown { from { transform: translateY(0); } to { transform: translateY(100%); } }
    @keyframes desktopZoomOut { from { transform: scale(1); opacity: 1; } to { transform: scale(0.95); opacity: 0; } }
    
    /* Apply Animation Classes */
    .animate-overlay-fade { animation: customFadeIn 0.4s ease-out forwards; }
    .animate-overlay-fade-out { animation: customFadeOut 0.3s ease-in forwards; }
    .animate-responsive-modal { animation: iosSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    .animate-responsive-modal-close { animation: iosSlideDown 0.4s cubic-bezier(0.3, 0, 0.8, 0.15) forwards; }

    .custom-scrollbar::-webkit-scrollbar { display: none; }
    .custom-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    
    @media (min-width: 640px) {
        .animate-responsive-modal { animation: desktopZoomIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-responsive-modal-close { animation: desktopZoomOut 0.3s cubic-bezier(0.3, 0, 0.8, 0.15) forwards; }
    }
`;

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
              ? 'border-blue-600 ring-4 ring-blue-600/10 bg-white'
              : 'border-slate-300 hover:bg-slate-100 hover:border-slate-400'
          } ${!value ? 'text-slate-500' : 'text-slate-900 font-bold'}`}
        >
          <span className="truncate">
            {options.find((opt: any) => (opt.value || opt) === value)?.label || value || placeholder}
          </span>
          <ChevronDown 
            size={20} 
            className={`text-slate-600 transition-transform duration-300 ease-in-out ${isOpen ? 'rotate-180 text-slate-900' : ''}`} 
          />
        </button>
  
        {isOpen && (
          <div className="absolute z-20 w-full mt-2 bg-white border-2 border-slate-300 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="max-h-60 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
              {options.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-slate-500 text-center italic">Loading...</div>
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

// --- Main Processing View ---
export default function Processing() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [departments, setDepartments] = useState<{label: string, value: string}[]>([]);
  const [clerks, setClerks] = useState<{label: string, value: string}[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [trailDoc, setTrailDoc] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
      fetchData();
  }, []);

  const fetchData = async () => {
      setIsLoading(true);
      try {
          const [docsRes, deptRes, empRes] = await Promise.all([
              supabase.from('documents').select('*').order('created_at', { ascending: false }),
              supabase.from('departments').select('name').order('name'),
              supabase.from('employees').select('name, department').order('name')
          ]);

          if (docsRes.data) {
              // Filter out 'sealed' (completed) documents from the active processing feed
              const activeDocs = docsRes.data.filter((d: any) => d.status !== 'sealed');
              setDocuments(activeDocs);
          }
          
          if (deptRes.data) setDepartments(deptRes.data.map(d => ({ label: d.name, value: d.name })));
          if (empRes.data) setClerks(empRes.data.map(e => ({ label: `${e.name} (${e.department})`, value: e.name })));
      } catch (err) {
          console.error("Fetch Error:", err);
          toast.error("Failed to load active documents.");
      } finally {
          setIsLoading(false);
      }
  };

  // Enterprise Auto-Filter Logic against Real DB Columns
  const filteredDocs = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return documents;
    
    return documents.filter(doc => 
        (doc.title || '').toLowerCase().includes(query) ||
        (doc.reference_no || '').toLowerCase().includes(query) ||
        (doc.current_location || '').toLowerCase().includes(query)
    );
  }, [searchQuery, documents]);

  if (isLoading) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[50vh]">
              <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
              <p className="mt-4 text-slate-500 font-bold">Loading Active Documents...</p>
          </div>
      );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500 pb-12">
      <style>{modalAnimationStyles}</style>

      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Active Processing</h2>
          <p className="text-base text-slate-600 mt-1">Manage documents currently in transit.</p>
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
                placeholder="Search by Title, ID, or Location..." 
                className="w-full pl-14 pr-14 py-4 rounded-xl border-2 border-slate-300 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 outline-none font-bold text-slate-900 placeholder:text-slate-500 transition-all text-lg shadow-sm" 
              />
              {/* Clear Search Button */}
              {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery("")}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-full transition-all active:scale-90"
                  >
                      <X size={20} strokeWidth={3} />
                  </button>
              )}
          </div>
          <p className="text-sm font-bold text-slate-500 px-2 animate-in fade-in">
              {filteredDocs.length} {filteredDocs.length === 1 ? 'document' : 'documents'} found
          </p>
      </div>

      {/* Empty State */}
      {filteredDocs.length === 0 && (
          <div className="bg-white border-2 border-dashed border-slate-300 rounded-3xl p-10 flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-300">
              <div className="bg-slate-50 p-4 rounded-full mb-4">
                <Search size={36} className="text-slate-400" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">No documents found</h3>
              <p className="text-base font-medium text-slate-600 max-w-md">
                 We couldn't find any active documents matching your criteria. Try adjusting your search terms or routing a new document.
              </p>
              <button onClick={() => setSearchQuery("")} className="mt-6 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all active:scale-95 border-2 border-slate-900">
                  Clear Search
              </button>
          </div>
      )}

      {/* Document Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredDocs.map(doc => (
            <div key={doc.id} className={`bg-white rounded-3xl border-2 ${doc.is_urgent ? 'border-red-400 shadow-md shadow-red-100' : 'border-slate-300'} shadow-sm p-5 flex flex-col hover:border-slate-500 transition-colors relative overflow-hidden animate-in fade-in zoom-in-95 duration-200`}>
                
                {doc.is_urgent && <div className="absolute top-0 left-0 w-full h-1.5 bg-red-600"></div>}
                
                <div className="flex justify-between items-start mb-4 mt-1">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md font-mono border border-slate-200">{doc.reference_no || doc.id}</span>
                        {doc.is_urgent && <span className="flex items-center gap-1 text-xs font-black text-red-700 bg-red-50 px-2.5 py-1 rounded-full border-2 border-red-200 uppercase tracking-wider animate-pulse"><AlertCircle size={14} strokeWidth={3}/> Rush</span>}
                    </div>
                </div>
                
                <h4 className="font-black text-xl text-slate-900 mb-4 leading-tight">{doc.title || doc.subject}</h4>
                
                <div className="bg-slate-50 p-4 rounded-xl border-2 border-slate-200 mb-5 flex-1 space-y-3">
                    <div className="flex items-start gap-3">
                        <MapPin size={18} className="text-slate-500 mt-0.5 shrink-0" />
                        <p className="text-sm text-slate-900 font-bold leading-snug"><span className="text-slate-500 text-xs block font-bold uppercase tracking-wider mb-0.5">Current Location</span>{doc.current_location || 'Processing'}</p>
                    </div>
                    <div className="flex items-start gap-3">
                        <Clock size={18} className="text-slate-500 mt-0.5 shrink-0" />
                        <p className="text-sm text-slate-900 font-bold leading-snug"><span className="text-slate-500 text-xs block font-bold uppercase tracking-wider mb-0.5">Logged On</span>{new Date(doc.created_at).toLocaleDateString()}</p>
                    </div>
                </div>
                
                <div className="flex gap-2 mt-auto">
                    <button 
                        onClick={() => setTrailDoc(doc)}
                        className="flex-1 py-2.5 px-2 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 border-2 border-slate-300 text-sm"
                    >
                        <Clock size={16} /> Track
                    </button>
                    <button 
                        onClick={() => setSelectedDoc(doc)}
                        className="flex-[1.5] py-2.5 px-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 text-sm border-2 border-blue-700"
                    >
                        Action <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        ))}
      </div>

      {/* Overlays */}
      {selectedDoc && <HandoverScreen doc={selectedDoc} departments={departments} clerks={clerks} onBack={() => setSelectedDoc(null)} onSuccess={fetchData} />}
      {trailDoc && <DigitalTrailModal doc={trailDoc} onBack={() => setTrailDoc(null)} />}
    </div>
  );
}

// --- Digital Trail Modal (Package Tracker Style) ---
function DigitalTrailModal({ doc, onBack }: any) {
    const [isClosing, setIsClosing] = useState(false);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => { onBack(); }, 400); 
    };

    return (
        <div className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm ${isClosing ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
            <div className={`bg-white w-full max-w-2xl max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden shadow-2xl rounded-t-2xl sm:rounded-3xl ${isClosing ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
                
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

                <div className="flex-1 overflow-y-auto p-5 sm:p-8 bg-white">
                    <div className="mb-8 border-b-2 border-slate-100 pb-6">
                        <p className="text-sm font-bold text-slate-500 mb-1 font-mono">{doc.reference_no}</p>
                        <p className="font-black text-xl text-slate-900 leading-tight">{doc.title}</p>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-slate-50 p-5 rounded-2xl border-2 border-slate-200 space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-slate-500 uppercase">Current Status</span>
                                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-lg font-bold text-sm">{doc.status || 'Processing'}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-slate-500 uppercase">Current Location</span>
                                <span className="font-bold text-slate-900">{doc.current_location || 'Originating Office'}</span>
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

// --- Handover & Signature Modal ---
function HandoverScreen({ doc, departments, clerks, onBack, onSuccess }: any) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isRejecting, setIsRejecting] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Form States
    const [destination, setDestination] = useState('');
    const [receivingClerk, setReceivingClerk] = useState('');
    const [rejectOffice, setRejectOffice] = useState('');
    const [rejectReason, setRejectReason] = useState('');

    const [isClosing, setIsClosing] = useState(false);

    const handleClose = () => {
      setIsClosing(true);
      setTimeout(() => { onBack(); }, 400); 
    };

    // Signature Canvas Logic
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        const getCoordinates = (e: MouseEvent | TouchEvent) => {
            const rect = canvas.getBoundingClientRect();
            if (e.type.includes('touch')) {
                const touch = (e as TouchEvent).touches[0];
                return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
            }
            const mouse = e as MouseEvent;
            return { x: mouse.clientX - rect.left, y: mouse.clientY - rect.top };
        };

        const startDrawing = (e: MouseEvent | TouchEvent) => {
            e.preventDefault(); 
            setIsDrawing(true);
            const { x, y } = getCoordinates(e);
            ctx.beginPath();
            ctx.moveTo(x, y);
        };

        const draw = (e: MouseEvent | TouchEvent) => {
            if (!isDrawing) return;
            e.preventDefault();
            const { x, y } = getCoordinates(e);
            ctx.lineTo(x, y);
            ctx.stroke();
        };

        const stopDrawing = () => {
            setIsDrawing(false);
            ctx.closePath();
        };

        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseout', stopDrawing);
        
        canvas.addEventListener('touchstart', startDrawing, { passive: false });
        canvas.addEventListener('touchmove', draw, { passive: false });
        canvas.addEventListener('touchend', stopDrawing);

        return () => {
            canvas.removeEventListener('mousedown', startDrawing);
            canvas.removeEventListener('mousemove', draw);
            canvas.removeEventListener('mouseup', stopDrawing);
            canvas.removeEventListener('mouseout', stopDrawing);
            canvas.removeEventListener('touchstart', startDrawing);
            canvas.removeEventListener('touchmove', draw);
            canvas.removeEventListener('touchend', stopDrawing);
        };
    }, [isDrawing, isRejecting]); 

    const clearSignature = () => {
        const canvas = canvasRef.current;
        if(canvas) {
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
        }
    };

    // --- Action Handlers --- //
    const handleSaveRouting = async () => {
        if (!destination || !receivingClerk) {
            toast.error("Validation Error", { description: "Please select a destination and receiving clerk." });
            return;
        }
        setIsSubmitting(true);
        try {
            const { error } = await supabase.from('documents').update({
                current_location: destination,
                status: 'routing' // Matches ENUM exactly
            }).eq('id', doc.id);

            if (error) throw error;
            toast.success("Document Routed Successfully!", { description: `Forwarded to ${destination}.`});
            onSuccess();
            handleClose();
        } catch (e: any) {
            toast.error("Failed to route document", { description: e.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleComplete = async () => {
        setIsSubmitting(true);
        try {
            const { error } = await supabase.from('documents').update({
                status: 'sealed' // Matches ENUM exactly
            }).eq('id', doc.id);

            if (error) throw error;
            toast.success("Document Completed!", { description: "It has been sealed and moved to history." });
            onSuccess();
            handleClose();
        } catch (e: any) {
            toast.error("Failed to complete document", { description: e.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReject = async () => {
        if (!rejectOffice || !rejectReason.trim()) {
            toast.error("Validation Error", { description: "Please provide the returning office and the reason for rejection." });
            return;
        }
        setIsSubmitting(true);
        try {
            const { error } = await supabase.from('documents').update({
                status: 'pending', // Fallback for rejected since 'returned' doesn't exist
                current_location: rejectOffice,
                remarks: rejectReason.trim()
            }).eq('id', doc.id);

            if (error) throw error;
            toast.success("Document Returned", { description: "The originator has been notified." });
            onSuccess();
            handleClose();
        } catch (e: any) {
            toast.error("Failed to reject document", { description: e.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm ${isClosing ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
            
            <div className={`bg-white w-full max-w-2xl max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden shadow-2xl rounded-t-2xl sm:rounded-3xl ${isClosing ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
                
                <div className={`text-white relative flex flex-col shrink-0 ${isRejecting ? 'bg-red-700' : 'bg-slate-900'}`}>
                    <div className="w-16 h-1.5 bg-white/30 rounded-full mx-auto mt-3 sm:hidden shrink-0"></div>
                    <div className="p-5 pt-3 sm:pt-6 flex items-center justify-between">
                        <button onClick={handleClose} disabled={isSubmitting} className="p-2 -ml-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors active:scale-90 disabled:opacity-50">
                            <ArrowLeft size={24} />
                        </button>
                        <h3 className="font-black text-xl">{isRejecting ? 'Reject & Return' : 'Record Handover'}</h3>
                        <div className="w-10"></div> 
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-8 custom-scrollbar">
                    
                    <div className="bg-slate-50 p-5 rounded-2xl border-2 border-slate-200">
                        <p className="text-sm font-bold text-slate-500 mb-2 font-mono">{doc.reference_no}</p>
                        <p className="font-black text-xl text-slate-900 leading-tight mb-3 flex items-start gap-2">
                            {doc.is_urgent && <AlertCircle size={24} className="text-red-600 shrink-0 mt-0.5" />}
                            {doc.title}
                        </p>
                    </div>

                    {!isRejecting ? (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div>
                                <label className="block text-base font-bold text-slate-900 mb-2">Destination Office *</label>
                                <CustomSelect 
                                    options={departments} 
                                    value={destination} 
                                    onChange={setDestination} 
                                    placeholder="Select receiving office..." 
                                />
                            </div>

                            <div>
                                <label className="block text-base font-bold text-slate-900 mb-2">Receiving Clerk / Liaison *</label>
                                <CustomSelect 
                                    options={clerks} 
                                    value={receivingClerk} 
                                    onChange={setReceivingClerk} 
                                    placeholder="Select employee..." 
                                />
                            </div>

                            <div>
                                <div className="flex justify-between items-end mb-2">
                                    <label className="block text-base font-bold text-slate-900 flex items-center gap-2"><PenTool size={20}/> Signature *</label>
                                    <button onClick={clearSignature} type="button" className="text-sm text-slate-600 font-bold hover:text-slate-900 transition-colors bg-slate-100 px-3 py-1.5 rounded-lg border-2 border-slate-300 active:scale-95">Clear Pad</button>
                                </div>
                                <div className="border-4 border-slate-300 rounded-2xl bg-slate-50 overflow-hidden touch-none relative">
                                    <div className="absolute top-1/2 left-4 right-4 h-0 border-b-2 border-dashed border-slate-300 pointer-events-none"></div>
                                    <canvas 
                                        ref={canvasRef} 
                                        width={600} 
                                        height={200} 
                                        className="w-full h-[200px] cursor-crosshair bg-transparent relative z-10"
                                        style={{ touchAction: 'none' }}
                                    />
                                </div>
                                <p className="text-center text-sm text-slate-500 mt-3 font-bold">Sign clearly within the box above</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                            <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-5 flex items-start gap-4">
                                <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={28} />
                                <div>
                                    <h4 className="font-black text-xl text-red-900 mb-1">Return Document</h4>
                                    <p className="text-base text-red-700 font-medium leading-snug">This document will be returned to a previous office. Please provide the exact reason for refusal.</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-base font-bold text-slate-900 mb-2">Returning To Office *</label>
                                <CustomSelect 
                                    options={departments} 
                                    value={rejectOffice} 
                                    onChange={setRejectOffice} 
                                    placeholder="Select office..." 
                                />
                            </div>

                            <div>
                                <label className="block text-base font-bold text-slate-900 mb-2">Reason for Rejection *</label>
                                <textarea 
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    placeholder="E.g., Missing signature, incorrect attachments..." 
                                    className="w-full p-4 bg-slate-50 border-2 border-slate-300 rounded-xl focus:border-red-600 focus:ring-4 focus:ring-red-600/10 outline-none text-base font-bold text-slate-900 placeholder:text-slate-500 min-h-[140px] resize-y transition-colors" 
                                ></textarea>
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-slate-50 p-4 sm:p-6 pb-8 sm:pb-6 border-t-2 border-slate-200 flex flex-row gap-3 shrink-0">
                    {!isRejecting ? (
                        <>
                            <button 
                                onClick={() => setIsRejecting(true)}
                                disabled={isSubmitting}
                                className="flex-1 sm:flex-none px-0 sm:px-6 py-4 bg-white border-2 border-red-300 text-red-700 hover:bg-red-50 font-bold rounded-xl transition-all active:scale-95 text-base flex justify-center items-center gap-2 disabled:opacity-50"
                            >
                                <X size={24} strokeWidth={3} />
                                <span className="hidden sm:block">Reject</span>
                            </button>
                            <button 
                                onClick={handleSaveRouting}
                                disabled={isSubmitting}
                                className="flex-[2] sm:flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-0 sm:px-6 rounded-xl shadow-lg transition-all active:scale-95 text-base flex justify-center items-center gap-2 border-2 border-blue-700 disabled:opacity-50"
                            >
                                {isSubmitting ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <><Save size={24} strokeWidth={2.5} /><span className="hidden sm:block">Save Routing</span></>}
                            </button>
                            <button 
                                onClick={handleComplete}
                                disabled={isSubmitting}
                                className="flex-1 sm:flex-none px-0 sm:px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 text-base border-2 border-emerald-700 disabled:opacity-50"
                                title="Mark as Completed"
                            >
                                <CheckCircle size={24} strokeWidth={2.5} />
                                <span className="hidden sm:block">Complete</span>
                            </button>
                        </>
                    ) : (
                        <>
                            <button 
                                onClick={() => setIsRejecting(false)}
                                disabled={isSubmitting}
                                className="flex-1 bg-white border-2 border-slate-300 text-slate-800 hover:bg-slate-100 font-bold py-4 rounded-xl transition-all active:scale-95 text-base flex justify-center items-center gap-2 disabled:opacity-50"
                            >
                                <ArrowLeft size={24} strokeWidth={3} />
                                <span className="hidden sm:block">Cancel</span>
                            </button>
                            <button 
                                onClick={handleReject}
                                disabled={isSubmitting}
                                className="flex-[2] bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-95 text-base flex items-center justify-center gap-2 border-2 border-red-700 disabled:opacity-50"
                            >
                                {isSubmitting ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <><AlertCircle size={24} strokeWidth={3} /><span className="hidden sm:block">Confirm Rejection</span></>}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}