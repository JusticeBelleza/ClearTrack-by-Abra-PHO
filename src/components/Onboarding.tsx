import { useState, useEffect } from 'react';
import { ShieldCheck, ClipboardCheck, ArrowRight, CheckCircle2 } from 'lucide-react';

// Import the official logos
import clearTrackLogo from '../assets/clear_track_logo.png';
import phoLogo from '../assets/pho_logo.png';

interface OnboardingProps {
  onComplete: () => void;
  onClosing: () => void; 
}

export default function Onboarding({ onComplete, onClosing }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Fade in on mount
  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      // 1. Trigger closing state for the modal
      setIsClosing(true);
      
      // 2. Immediately tell the login page to start its animation
      onClosing(); 
      
      // 3. Wait for the fade out to finish before unmounting
      setTimeout(() => {
        onComplete();
      }, 400); 
    }
  };

  const steps = [
    {
      title: "Welcome to FileTrackr",
      description: "The official electronic document routing and tracking system operated by the Abra Provincial Health Office.",
      icon: (
        <div className="flex gap-4 items-center justify-center pt-1">
          <img src={clearTrackLogo} alt="FileTrackr Logo" className="w-16 h-16 object-contain drop-shadow-md" />
          <img src={phoLogo} alt="Abra PHO Logo" className="w-16 h-16 object-contain drop-shadow-md" />
        </div>
      ),
      color: "" 
    },
    {
      title: "Absolute Accountability",
      description: "Say goodbye to lost files. Every document's location, custodian, and routing history is permanently logged and strictly verifiable.",
      // --- CHANGED: Now uses ClipboardCheck to represent auditing/accountability ---
      icon: <ClipboardCheck size={64} className="text-emerald-600" />,
      color: "bg-emerald-50 border-emerald-200"
    },
    {
      title: "Strictly Secure",
      description: "Protected by enterprise-grade security, role-based access, and biometric passkeys. Official government business only.",
      icon: <ShieldCheck size={64} className="text-slate-900" />,
      color: "bg-slate-100 border-slate-300"
    }
  ];

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 sm:p-6 transition-all duration-500 ${!isVisible || isClosing ? 'opacity-0' : 'opacity-100'}`}>
      
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[25%] -right-[10%] w-[70%] h-[70%] rounded-full bg-blue-900/20 blur-3xl"></div>
        <div className="absolute -bottom-[25%] -left-[10%] w-[70%] h-[70%] rounded-full bg-emerald-900/20 blur-3xl"></div>
      </div>

      <div className={`relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[500px] transition-transform duration-500 ${isClosing ? 'scale-95 translate-y-4' : 'scale-100 translate-y-0'}`}>
        
        {/* Dynamic Content Area */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in slide-in-from-right-4 duration-500" key={currentStep}>
          
          <div className={`w-32 h-32 flex items-center justify-center mb-8 transition-all duration-500 ${
            currentStep === 0 
              ? '' 
              : `rounded-full border-4 shadow-sm ${steps[currentStep].color}`
          }`}>
            {steps[currentStep].icon}
          </div>

          <h2 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">
            {steps[currentStep].title}
          </h2>
          <p className="text-slate-600 font-medium leading-relaxed">
            {steps[currentStep].description}
          </p>
        </div>

        {/* Footer Navigation */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col gap-6">
          
          {/* Progress Indicators */}
          <div className="flex justify-center gap-2">
            {steps.map((_, idx) => (
              <div 
                key={idx} 
                className={`h-2 rounded-full transition-all duration-300 ${idx === currentStep ? 'w-8 bg-slate-900' : 'w-2 bg-slate-300'}`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md"
          >
            {currentStep === steps.length - 1 ? (
              <><CheckCircle2 size={20} /> Get Started</>
            ) : (
              <>Next <ArrowRight size={20} /></>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}