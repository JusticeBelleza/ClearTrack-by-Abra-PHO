import { useState, useEffect, useRef } from 'react';
import { Shield, Check, ArrowRight, LogOut, CheckCircle2, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { legalContents } from '../routes/legalDocs';

const legalTitles = {
    privacy: "Privacy Policy",
    terms: "Terms and Conditions of Use",
    aup: "Information Security & Acceptable Use Policy"
};

interface LegalAgreementProps {
  onAccept: () => void;
  onDecline: () => void;
  isSaving: boolean;
}

export default function LegalAgreement({ onAccept, onDecline, isSaving }: LegalAgreementProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  
  // Read Status Tracking
  const [readStatus, setReadStatus] = useState({
    privacy: false,
    terms: false,
    aup: false
  });
  
  const [hasAgreed, setHasAgreed] = useState(false);
  
  // --- NEW: Document Reader Animation States ---
  const [activeDoc, setActiveDoc] = useState<"privacy" | "terms" | "aup" | null>(null);
  const [isDocVisible, setIsDocVisible] = useState(false);
  
  // Ref for the scrollable container
  const scrollRef = useRef<HTMLDivElement>(null);

  // Check if all documents have been read
  const allDocumentsRead = readStatus.privacy && readStatus.terms && readStatus.aup;

  // Trigger the entrance animation for the main component
  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Check if document is short enough to not need scrolling
  useEffect(() => {
    if (activeDoc) {
      setTimeout(() => {
        if (scrollRef.current) {
          const { scrollHeight, clientHeight } = scrollRef.current;
          if (scrollHeight <= clientHeight + 10) {
            setReadStatus(prev => ({ ...prev, [activeDoc]: true }));
          }
        }
      }, 100);
    }
  }, [activeDoc]);

  // Scroll Handler to mark as read
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!activeDoc || readStatus[activeDoc]) return; 

    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 10) {
      setReadStatus(prev => ({ ...prev, [activeDoc]: true }));
    }
  };

  const handleDeclineClick = () => {
    setIsClosing(true);
    setTimeout(() => {
      onDecline();
    }, 600); 
  };

  // --- NEW: Document Open & Close Animators ---
  const handleOpenDoc = (docKey: "privacy" | "terms" | "aup") => {
    setActiveDoc(docKey);
    // Allow the DOM to render the modal instantly hidden, then trigger the slide up!
    setTimeout(() => setIsDocVisible(true), 10); 
  };

  const handleCloseDoc = () => {
    setIsDocVisible(false); // Trigger the slide down animation
    setTimeout(() => {
      setActiveDoc(null); // Unmount after the animation finishes
    }, 600); 
  };

  const getDocButtonStyle = (docKey: "privacy" | "terms" | "aup") => {
    if (readStatus[docKey]) {
      return "border-emerald-500 bg-emerald-50/30 hover:border-emerald-600 hover:ring-emerald-500/20";
    }
    return "border-red-400 bg-red-50/10 hover:border-red-500 hover:ring-red-400/20";
  };

  return (
    <>
      {/* MAIN LEGAL AGREEMENT MODAL */}
      <div className={`fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 sm:p-6 transition-opacity duration-500 ${isMounted && !isClosing ? 'opacity-100' : 'opacity-0'}`}>
        
        <div 
          className={`relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col transition-all duration-[600ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
            isMounted && !isClosing 
              ? 'opacity-100 translate-y-0 scale-100' 
              : 'opacity-0 translate-y-[100vh] scale-95' 
          }`}
        >
          
          <div className="bg-slate-900 p-6 sm:p-8 text-center relative overflow-hidden shrink-0">
             <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full blur-2xl"></div>
             <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/20 rounded-full blur-2xl"></div>
             
             <div className="w-16 h-16 bg-white/10 text-white rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-white/20 relative z-10">
                <Shield size={32} />
             </div>
             <h2 className="text-2xl font-black text-white mb-2 relative z-10">Legal Agreements</h2>
             <p className="text-slate-300 text-sm font-medium relative z-10">
               Before accessing FileTrackr, you must acknowledge our official system policies.
             </p>
          </div>

          <div className="p-6 sm:p-8 space-y-4 bg-slate-50 flex-1">
             <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Please review the following:</p>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-200 px-2 py-0.5 rounded-full">
                  {Object.values(readStatus).filter(Boolean).length} / 3 Read
                </span>
             </div>
             
             <div className="space-y-3">
                <button onClick={() => handleOpenDoc('privacy')} className={`w-full flex items-center justify-between p-4 border-2 rounded-xl transition-all text-left group ${getDocButtonStyle('privacy')}`}>
                  <div className="flex items-center gap-3">
                    {readStatus.privacy ? <CheckCircle2 className="text-emerald-500" size={20} /> : <AlertCircle className="text-red-400" size={20} />}
                    <span className={`font-bold transition-colors ${readStatus.privacy ? 'text-emerald-900' : 'text-slate-700 group-hover:text-slate-900'}`}>Privacy Policy</span>
                  </div>
                  <ArrowRight size={16} className={readStatus.privacy ? 'text-emerald-500' : 'text-red-300 group-hover:text-red-500'} />
                </button>

                <button onClick={() => handleOpenDoc('terms')} className={`w-full flex items-center justify-between p-4 border-2 rounded-xl transition-all text-left group ${getDocButtonStyle('terms')}`}>
                  <div className="flex items-center gap-3">
                    {readStatus.terms ? <CheckCircle2 className="text-emerald-500" size={20} /> : <AlertCircle className="text-red-400" size={20} />}
                    <span className={`font-bold transition-colors ${readStatus.terms ? 'text-emerald-900' : 'text-slate-700 group-hover:text-slate-900'}`}>Terms of Use</span>
                  </div>
                  <ArrowRight size={16} className={readStatus.terms ? 'text-emerald-500' : 'text-red-300 group-hover:text-red-500'} />
                </button>

                <button onClick={() => handleOpenDoc('aup')} className={`w-full flex items-center justify-between p-4 border-2 rounded-xl transition-all text-left group ${getDocButtonStyle('aup')}`}>
                  <div className="flex items-center gap-3">
                    {readStatus.aup ? <CheckCircle2 className="text-emerald-500" size={20} /> : <AlertCircle className="text-red-400" size={20} />}
                    <span className={`font-bold transition-colors ${readStatus.aup ? 'text-emerald-900' : 'text-slate-700 group-hover:text-slate-900'}`}>Acceptable Use Policy</span>
                  </div>
                  <ArrowRight size={16} className={readStatus.aup ? 'text-emerald-500' : 'text-red-300 group-hover:text-red-500'} />
                </button>
             </div>
          </div>

          <div className="p-6 bg-white border-t border-slate-100 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)] shrink-0">
             <label className={`flex items-start gap-3 mb-6 transition-opacity ${allDocumentsRead ? 'cursor-pointer group opacity-100' : 'cursor-not-allowed opacity-50 grayscale'}`}>
                <input 
                  type="checkbox" 
                  className="sr-only" 
                  checked={hasAgreed}
                  onChange={(e) => {
                    if (allDocumentsRead) setHasAgreed(e.target.checked);
                  }}
                  disabled={isSaving || !allDocumentsRead}
                />
                <div className={`mt-0.5 w-5 h-5 shrink-0 rounded flex items-center justify-center border-2 transition-colors ${hasAgreed ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300 group-hover:border-blue-400'}`}>
                   {hasAgreed && <Check size={14} strokeWidth={4} className="text-white" />}
                </div>
                <span className="text-sm font-medium text-slate-600 leading-snug select-none">
                  I acknowledge that I have read and agree to the <span className="font-bold text-slate-900">Privacy Policy</span>, <span className="font-bold text-slate-900">Terms of Use</span>, and <span className="font-bold text-slate-900">Acceptable Use Policy</span>.
                </span>
             </label>

             <div className="flex gap-3">
               <button
                 onClick={handleDeclineClick}
                 disabled={isSaving}
                 className="flex-1 py-3.5 font-bold rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
               >
                 <LogOut size={18} /> Decline
               </button>
               <button
                 onClick={onAccept}
                 disabled={!hasAgreed || isSaving || !allDocumentsRead}
                 className={`flex-[1.5] py-3.5 font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md ${
                   hasAgreed && allDocumentsRead
                    ? 'bg-blue-600 hover:bg-blue-700 text-white active:scale-[0.98]' 
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                 }`}
               >
                 {isSaving ? (
                   <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                 ) : (
                   <>Accept <ArrowRight size={18} /></>
                 )}
               </button>
             </div>
          </div>

        </div>
      </div>

      {/* --- SCROLLABLE DOCUMENT READER MODAL --- */}
      {activeDoc && (
        <div className={`fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-500 ${isDocVisible ? 'opacity-100' : 'opacity-0'}`}>
            <div 
              className={`relative flex w-full max-w-3xl flex-col max-h-[90vh] sm:max-h-[85vh] overflow-hidden rounded-2xl sm:rounded-3xl bg-white shadow-2xl transition-all duration-[600ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                isDocVisible 
                  ? 'opacity-100 translate-y-0 scale-100' 
                  : 'opacity-0 translate-y-[100vh] scale-95'
              }`}
            >
                
                <div className="flex items-center justify-between border-b border-slate-100 px-5 sm:px-6 py-4 sm:py-5 bg-slate-900 text-white shrink-0">
                    <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                        {readStatus[activeDoc] ? <CheckCircle2 className="text-emerald-400" size={20} /> : <AlertCircle className="text-red-400" size={20}/>}
                        {legalTitles[activeDoc]}
                    </h2>
                </div>
                
                <div 
                  ref={scrollRef}
                  onScroll={handleScroll}
                  className="flex-1 overflow-y-auto px-5 sm:px-8 py-6 sm:py-8 custom-scrollbar bg-slate-50/50 scroll-smooth"
                >
                    <article className="prose prose-slate prose-sm sm:prose-base max-w-none prose-headings:text-slate-900 prose-a:text-blue-600 prose-p:text-slate-700 pb-8">
                        <ReactMarkdown>
                            {legalContents[activeDoc]}
                        </ReactMarkdown>
                    </article>
                    
                    {!readStatus[activeDoc] ? (
                       <p className="text-center text-sm font-bold text-red-500 animate-pulse mt-8 border-t border-red-200 pt-4">
                         ↓ Please scroll to the very bottom to acknowledge ↓
                       </p>
                    ) : (
                       <p className="text-center text-sm font-bold text-emerald-600 mt-8 border-t border-emerald-200 pt-4 flex items-center justify-center gap-2">
                         <CheckCircle2 size={16} /> Document reading completed
                       </p>
                    )}
                </div>
                
                <div className="border-t border-slate-200 bg-white px-5 sm:px-6 py-4 flex justify-end shrink-0">
                    <button 
                        onClick={handleCloseDoc} 
                        disabled={!readStatus[activeDoc]}
                        className={`w-full sm:w-auto rounded-xl px-8 py-3 sm:py-2.5 text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2 ${
                          readStatus[activeDoc] 
                            ? 'bg-slate-900 text-white hover:bg-slate-800 active:scale-95' 
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                        }`}
                    >
                        {readStatus[activeDoc] ? 'Close Document' : 'Scroll to bottom to Close'}
                    </button>
                </div>
            </div>
        </div>
      )}
    </>
  );
}