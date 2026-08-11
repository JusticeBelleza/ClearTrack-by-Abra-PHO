import { useState, useEffect } from 'react';
import { X, Share, PlusSquare, Download } from 'lucide-react';
import clearTrackLogo from '../assets/clear_track_logo.png';

// Tell TypeScript about the BeforeInstallPromptEvent for Android
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function InstallPrompt() {
  const [isIos, setIsIos] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // 1. Check if the prompt was already dismissed previously
    const isDismissed = localStorage.getItem('filetrackr_install_dismissed');
    
    // 2. Check if the app is already installed / running in standalone mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         (window.navigator as any).standalone === true;

    if (isDismissed || isStandalone) {
      return; // Hide completely if already installed or dismissed
    }

    // 3. Detect iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    
    if (isIosDevice) {
      setIsIos(true);
      // Add a small delay so it doesn't pop up instantly on page load
      setTimeout(() => setShowPrompt(true), 2000);
    }

    // 4. Detect Android / Chrome (Listens for the native install prompt)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('filetrackr_install_dismissed', 'true');
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed inset-x-0 bottom-safe z-50 p-4 sm:p-6 md:hidden animate-in slide-in-from-bottom-10 fade-in duration-500">
      <div className="bg-white/95 backdrop-blur-2xl border-[1.5px] border-slate-200 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.3)] rounded-[1.5rem] p-5 relative overflow-hidden">
        
        {/* Close Button */}
        <button 
          onClick={handleDismiss} 
          className="absolute top-3 right-3 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
        >
          <X size={18} strokeWidth={2.5} />
        </button>

        <div className="flex items-start gap-4">
          <div className="w-14 h-14 shrink-0 bg-white rounded-xl p-2 border border-slate-200 shadow-sm flex items-center justify-center mt-1">
            <img src={clearTrackLogo} alt="filetrackr logo" className="w-full h-full object-contain" />
          </div>
          
          <div className="flex-1 pr-6">
            <h3 className="text-lg font-black text-slate-900 tracking-tight leading-none mb-1">
              Install filetrackr
            </h3>
            <p className="text-sm text-slate-500 font-medium leading-snug mb-4">
              Add this app to your home screen for quick access and a full-screen experience.
            </p>

            {isIos ? (
              // iOS Instructions
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 font-semibold space-y-2">
                <p className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 bg-white shadow-sm rounded-md border border-slate-200">1</span>
                  Tap the <Share size={14} className="text-blue-600 mx-0.5" /> Share icon below
                </p>
                <p className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 bg-white shadow-sm rounded-md border border-slate-200">2</span>
                  Select <strong>Add to Home Screen</strong> <PlusSquare size={14} className="text-slate-500 ml-0.5" />
                </p>
              </div>
            ) : (
              // Android/Chrome Button
              <button 
                onClick={handleInstallClick}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Download size={18} strokeWidth={2.5} />
                Install App Now
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}