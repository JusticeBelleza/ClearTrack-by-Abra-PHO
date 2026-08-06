import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  FileText, Activity, History, Settings, LogOut, FileCheck, Shield, AlertCircle, X 
} from 'lucide-react';
import { toast } from 'sonner';
import { useUiStore } from '../../store/uiStore';
import CreateDocumentModal from '../system/CreateDocumentModal';
import { supabase } from '../../lib/supabase';

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

  // Fetch the real user role and Global Settings from Supabase on load
  useEffect(() => {
    const fetchUserAndSettings = async () => {
      try {
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        
        if (authError || !session) {
          navigate('/login', { replace: true });
          return;
        }

        // Fetch both the user profile AND the global settings simultaneously
        const [profileRes, settingsRes] = await Promise.all([
            supabase.from('profiles').select('role').eq('id', session.user.id).single(),
            supabase.from('global_settings').select('maintenance_mode').eq('id', 1).single()
        ]);

        const role = profileRes.data?.role || 'pho_staff';
        const isMaintenance = settingsRes.data?.maintenance_mode || false;

        // --- MAINTENANCE MODE ENFORCEMENT ---
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
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800">
      <style>{modalAnimationStyles}</style>

      {/* Sidebar Navigation (Desktop) */}
      <nav className="hidden md:flex flex-col w-64 bg-slate-900 text-slate-300 shadow-xl z-20">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <FileCheck size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-wide">ClearTrack</h1>
            <p className="text-xs text-slate-400">
              {currentUserRole === 'admin' ? 'Admin Portal' : 'by Abra PHO'}
            </p>
          </div>
        </div>
        
        <div className="flex-1 py-6 px-4 space-y-2">
          {/* STAFF NAVIGATION */}
          {currentUserRole === 'pho_staff' && (
            <>
              <NavItem icon={<Activity />} label="Dashboard" to="/dashboard" isActive={activeTab === 'dashboard'} />
              <NavItem icon={<FileText />} label="Processing" to="/processing" isActive={activeTab === 'processing'} />
              <NavItem icon={<History />} label="History" to="/history" isActive={activeTab === 'history'} />
            </>
          )}

          {/* ADMIN NAVIGATION */}
          {currentUserRole === 'admin' && (
            <NavItem icon={<Shield />} label="System Admin" to="/admin" isActive={activeTab === 'admin'} />
          )}

          {/* SHARED NAVIGATION */}
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
        
        {/* Mobile Header (Branding only - Logout moved to bottom) */}
        <header className="md:hidden flex items-center justify-between p-4 bg-slate-900 text-white shadow-md z-20 relative shrink-0">
          <div className="flex items-center gap-2">
            <FileCheck size={20} className="text-blue-400" />
            <h1 className="text-lg font-bold">
              {currentUserRole === 'admin' ? 'ClearTrack Admin' : 'ClearTrack PHO'}
            </h1>
          </div>
        </header>

        {/* Scrollable Content Routing Outlet */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-20 md:pb-8">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation (Icons Only) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around items-center h-16 z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] pb-safe">
        
        {/* STAFF NAVIGATION */}
        {currentUserRole === 'pho_staff' && (
          <>
            <MobileBottomNavItem icon={<Activity />} to="/dashboard" isActive={activeTab === 'dashboard'} />
            <MobileBottomNavItem icon={<FileText />} to="/processing" isActive={activeTab === 'processing'} />
            <MobileBottomNavItem icon={<History />} to="/history" isActive={activeTab === 'history'} />
          </>
        )}

        {/* ADMIN NAVIGATION */}
        {currentUserRole === 'admin' && (
          <MobileBottomNavItem icon={<Shield />} to="/admin" isActive={activeTab === 'admin'} />
        )}

        {/* SHARED NAVIGATION & LOGOUT */}
        <MobileBottomNavItem icon={<Settings />} to="/settings" isActive={activeTab === 'settings'} />
        
        <button 
          onClick={openLogoutModal}
          className="flex items-center justify-center flex-1 h-full transition-colors active:scale-90 text-slate-400 hover:text-red-500"
        >
          <div className="p-2 rounded-full">
             <LogOut size={24} strokeWidth={2} />
          </div>
        </button>
      </nav>

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

function NavItem({ icon, label, to, isActive }: any) {
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

function MobileBottomNavItem({ icon, to, isActive }: any) {
    return (
      <Link 
        to={to} 
        className={`flex items-center justify-center flex-1 h-full transition-colors active:scale-90 ${
          isActive ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
        }`}
      >
        <div className={`p-2 rounded-full ${isActive ? 'bg-blue-50' : ''}`}>
           {React.cloneElement(icon, { 
             size: 24, 
             strokeWidth: isActive ? 2.5 : 2 
           })}
        </div>
      </Link>
    );
}