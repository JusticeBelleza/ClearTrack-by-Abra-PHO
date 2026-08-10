import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  FileText, Activity, History, Settings, LogOut, Shield, AlertCircle, X, Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import { useUiStore } from '../../store/uiStore';
import CreateDocumentModal from '../system/CreateDocumentModal';
import { supabase } from '../../lib/supabase';

import clearTrackLogo from '../../assets/clear_track_logo.png';

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

    /* Hide scrollbar for the scrollable areas */
    .scrollbar-hide::-webkit-scrollbar { display: none; }
    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
`;

// --- TypeScript Interfaces ---
interface NavItemProps {
    icon: React.ReactElement<{ size?: number | string; strokeWidth?: number | string }>;
    label: string;
    to: string;
    isActive: boolean;
}

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = location.pathname.replace('/', '') || 'dashboard';

  const isCreateModalOpen = useUiStore((state) => state.isCreateModalOpen);

  // --- DYNAMIC AUTHENTICATION ROLE ---
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'pho_staff' | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // --- LOGOUT MODAL STATES ---
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isClosingLogout, setIsClosingLogout] = useState(false);

  // --- PHT DATE STATE ---
  const [dateInfo, setDateInfo] = useState({ long: '', short: '' });

  // Handle live date formatting for PHT
  useEffect(() => {
      const updateDate = () => {
          const now = new Date();
          setDateInfo({
              long: now.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
              short: now.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })
          });
      };
      updateDate();
      const interval = setInterval(updateDate, 60000);
      return () => clearInterval(interval);
  }, []);

  // Fetch the real user role and Global Settings from Supabase on load
  useEffect(() => {
    const fetchUserAndSettings = async () => {
      try {
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        
        if (authError || !session) {
          navigate('/login', { replace: true });
          return;
        }

        const [profileRes, settingsRes] = await Promise.all([
            supabase.from('profiles').select('role').eq('id', session.user.id).single(),
            supabase.from('global_settings').select('maintenance_mode').eq('id', 1).single()
        ]);

        const role = profileRes.data?.role || 'pho_staff';
        const isMaintenance = settingsRes.data?.maintenance_mode || false;

        if (isMaintenance && role !== 'admin') {
            await supabase.auth.signOut(); 
            toast.error('System Maintenance', { description: 'The system is currently undergoing maintenance. Please try again later.' });
            navigate('/login', { replace: true });
            return;
        }

        setCurrentUserRole(role as 'admin' | 'pho_staff');
      } catch (err) {
        console.error("Error fetching user role:", err);
        setCurrentUserRole('pho_staff'); 
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserAndSettings();
  }, [navigate]);

  // --- ROLE-BASED ROUTING ENFORCEMENT ---
  useEffect(() => {
    if (!currentUserRole) return; 

    if (currentUserRole === 'admin') {
      if (['dashboard', 'processing', 'history'].includes(activeTab)) {
        navigate('/admin', { replace: true });
      }
    } else if (currentUserRole === 'pho_staff') {
      if (activeTab === 'admin') {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [activeTab, currentUserRole, navigate]);

  // --- LOGOUT ACTIONS ---
  const openLogoutModal = () => setIsLogoutModalOpen(true);
  
  const closeLogoutModal = () => {
      setIsClosingLogout(true);
      setTimeout(() => { setIsLogoutModalOpen(false); setIsClosingLogout(false); }, 400);
  };

  const confirmLogout = async () => {
      await supabase.auth.signOut();
      navigate('/login', { replace: true });
  };

  if (isLoading || !currentUserRole) {
      return (
          <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
              <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
              <p className="mt-4 text-slate-500 font-bold">Authenticating...</p>
          </div>
      );
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800 selection:bg-blue-200">
      <style>{modalAnimationStyles}</style>

      {/* Sidebar Navigation (Desktop) */}
      <nav className="hidden md:flex flex-col w-64 bg-slate-900 text-slate-300 shadow-xl z-20">
        
        {/* BRANDING: Desktop Sidebar */}
        <div className="p-6 flex items-start gap-4 border-b border-slate-800 bg-gradient-to-b from-slate-800/50 to-slate-900 relative overflow-hidden">
          <div className="absolute top-0 left-0 -ml-8 -mt-8 w-32 h-32 bg-blue-500 rounded-full mix-blend-screen filter blur-[40px] opacity-20 animate-pulse"></div>
          
          {/* Logo as a white button-like container */}
          <div className="flex items-center justify-center w-12 h-12 shrink-0 bg-white rounded-xl p-1.5 border border-slate-200 shadow-[0_4px_12px_rgba(0,0,0,0.5)] relative z-10">
            <img 
              src={clearTrackLogo} 
              alt="filetrackr logo" 
              className="w-full h-full object-contain"
            />
          </div>
          
          <div className="flex flex-col relative z-10">
            <h1 className="text-2xl font-black text-white tracking-tight leading-none mt-1">filetrackr<span className="text-blue-500">.</span></h1>
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mt-1.5">
              {currentUserRole === 'admin' ? 'Admin Portal' : 'by Abra PHO'}
            </p>
            <div className="flex items-center gap-1.5 mt-3 text-slate-300 bg-slate-800/50 py-1.5 px-2.5 rounded-lg border border-slate-700/50 w-fit">
              <Calendar size={12} className="text-blue-400 shrink-0" />
              <span className="text-[10px] font-bold leading-none">{dateInfo.long}</span>
            </div>
          </div>
        </div>
        
        <div className="flex-1 py-6 px-4 space-y-2">
          {currentUserRole === 'pho_staff' && (
            <>
              <NavItem icon={<Activity />} label="Dashboard" to="/dashboard" isActive={activeTab === 'dashboard'} />
              <NavItem icon={<FileText />} label="Processing" to="/processing" isActive={activeTab === 'processing'} />
              <NavItem icon={<History />} label="History" to="/history" isActive={activeTab === 'history'} />
            </>
          )}
          {currentUserRole === 'admin' && (
            <NavItem icon={<Shield />} label="System Admin" to="/admin" isActive={activeTab === 'admin'} />
          )}
          <NavItem icon={<Settings />} label="Settings" to="/settings" isActive={activeTab === 'settings'} />
        </div>

        <div className="p-4 border-t border-slate-800">
          <button onClick={openLogoutModal} className="flex items-center gap-3 px-4 py-3 w-full text-left text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors">
            <LogOut size={20} />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* BRANDING: Mobile Header - Dark colorful gradient with white logo button */}
        <header className="md:hidden flex items-center justify-between p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-lg z-20 relative shrink-0 overflow-hidden border-b border-slate-800">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-blue-500 rounded-full mix-blend-screen filter blur-3xl opacity-30 animate-pulse"></div>

          <div className="flex items-center gap-3 relative z-10">
            {/* Logo as a white button-like container */}
            <div className="flex items-center justify-center w-12 h-12 shrink-0 bg-white rounded-xl p-1.5 border-2 border-slate-200 shadow-md">
              <img 
                src={clearTrackLogo} 
                alt="filetrackr logo" 
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-black leading-none text-white tracking-tight">filetrackr<span className="text-blue-400">.</span></h1>
              <span className="text-[10px] font-black text-blue-300 uppercase tracking-widest mt-1">
                {currentUserRole === 'admin' ? 'Admin Portal' : 'by Abra PHO'}
              </span>
            </div>
          </div>

          <div className="relative z-10 flex flex-col items-end text-right">
             <span className="text-[9px] font-black text-blue-300 uppercase tracking-widest flex items-center gap-1 mb-0.5">
                <Calendar size={10} strokeWidth={3} /> PHT
             </span>
             <span className="text-[11px] font-bold text-slate-200">
                {dateInfo.short}
             </span>
          </div>
        </header>

        {/* Scrollable Content Routing Outlet */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-28 md:pb-8">
          <Outlet />
        </div>
      </main>

      {/* 
        NEW CATCHY MOBILE NAVIGATION 
        Floating Pill + Glassmorphism + Expanding Active States + Pronounced Outline & Shadow
      */}
      <div className="md:hidden fixed bottom-5 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none pb-safe">
          <nav className="flex items-center justify-between w-full max-w-md bg-white/95 backdrop-blur-2xl border-[1.5px] border-slate-300 shadow-[0_15px_40px_-10px_rgba(0,0,0,0.3)] p-2 rounded-[2rem] pointer-events-auto">
            
            {/* STAFF NAVIGATION */}
            {currentUserRole === 'pho_staff' && (
              <>
                <MobileBottomNavItem icon={<Activity />} label="Dashboard" to="/dashboard" isActive={activeTab === 'dashboard'} />
                <MobileBottomNavItem icon={<FileText />} label="Processing" to="/processing" isActive={activeTab === 'processing'} />
                <MobileBottomNavItem icon={<History />} label="History" to="/history" isActive={activeTab === 'history'} />
              </>
            )}

            {/* ADMIN NAVIGATION */}
            {currentUserRole === 'admin' && (
              <MobileBottomNavItem icon={<Shield />} label="Admin" to="/admin" isActive={activeTab === 'admin'} />
            )}

            {/* SHARED NAVIGATION & LOGOUT */}
            <MobileBottomNavItem icon={<Settings />} label="Settings" to="/settings" isActive={activeTab === 'settings'} />
            
            {/* Divider Dot */}
            <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mx-1"></div>

            {/* Logout Button */}
            <button 
              onClick={openLogoutModal}
              title="Logout"
              className="relative flex items-center justify-center w-12 h-12 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all duration-300 active:scale-90"
            >
              <LogOut size={22} strokeWidth={2.5} />
            </button>
          </nav>
      </div>

      {/* GLOBAL LOGOUT CONFIRMATION MODAL */}
      {isLogoutModalOpen && (
        <div className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50 backdrop-blur-sm ${isClosingLogout ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
          <div className={`bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden ${isClosingLogout ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
            <div className="bg-red-700 text-white p-5 flex items-center justify-between">
              <h3 className="font-black text-xl flex items-center gap-2"><AlertCircle size={22} /> Confirm Logout</h3>
              <button onClick={closeLogoutModal} className="p-2 bg-white/10 hover:bg-white/20 rounded-full"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-base text-slate-700 font-medium">
                Are you sure you want to securely log out of your account?
              </p>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={closeLogoutModal} className="flex-1 py-3.5 bg-white border-2 border-slate-300 text-slate-700 font-bold rounded-xl active:scale-95 transition-transform text-base">Cancel</button>
                <button type="button" onClick={confirmLogout} className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl border-2 border-red-700 active:scale-95 transition-transform text-base shadow-md">Yes, Logout</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Create Document Modal */}
      {isCreateModalOpen && <CreateDocumentModal />}
    </div>
  );
}

// --- Helper Components --- //

function NavItem({ icon, label, to, isActive }: NavItemProps) {
  return (
    <Link to={to} className={`flex items-center gap-3 px-4 py-3 w-full text-left rounded-lg transition-all ${
        isActive ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white'
      }`}
    >
      {React.cloneElement(icon, { size: 20 })}
      <span className="font-medium">{label}</span>
    </Link>
  );
}

// THE NEW CATCHY MAGIC NAV ITEM
function MobileBottomNavItem({ icon, label, to, isActive }: NavItemProps) {
    return (
      <Link 
        to={to} 
        className={`relative flex items-center justify-center transition-all duration-500 ease-out overflow-hidden pointer-events-auto ${
          isActive 
            ? 'w-auto px-4 py-2.5 bg-blue-600 text-white rounded-[1.25rem] shadow-[0_0_20px_rgba(37,99,235,0.4)]' 
            : 'w-12 h-12 bg-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full'
        }`}
      >
        <div className="flex items-center gap-2 relative z-10">
           <div className={`transition-transform duration-500 ${isActive ? 'scale-110' : 'scale-100'}`}>
              {React.cloneElement(icon, { 
                size: 20, 
                strokeWidth: isActive ? 2.5 : 2 
              })}
           </div>
           {isActive && (
              <span className="text-sm font-bold tracking-wide whitespace-nowrap animate-in slide-in-from-right-2 fade-in duration-300">
                {label}
              </span>
           )}
        </div>
      </Link>
    );
}