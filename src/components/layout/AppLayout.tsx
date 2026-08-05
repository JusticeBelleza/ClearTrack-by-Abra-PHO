import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  FileText, Activity, History, Settings, LogOut, FileCheck 
} from 'lucide-react';

import { useUiStore } from '../../store/uiStore';
import CreateDocumentModal from '../system/CreateDocumentModal';

export default function AppLayout() {
  const location = useLocation();
  const activeTab = location.pathname.replace('/', '') || 'dashboard';

  const isCreateModalOpen = useUiStore((state) => state.isCreateModalOpen);

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800">
      
      {/* Sidebar Navigation (Desktop) */}
      <nav className="hidden md:flex flex-col w-64 bg-slate-900 text-slate-300 shadow-xl z-20">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <FileCheck size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-wide">ClearTrack</h1>
            <p className="text-xs text-slate-400">by Abra PHO</p>
          </div>
        </div>
        
        <div className="flex-1 py-6 px-4 space-y-2">
          <NavItem icon={<Activity />} label="Dashboard" to="/dashboard" isActive={activeTab === 'dashboard'} />
          <NavItem icon={<FileText />} label="Processing" to="/processing" isActive={activeTab === 'processing'} />
          <NavItem icon={<History />} label="History" to="/history" isActive={activeTab === 'history'} />
          <NavItem icon={<Settings />} label="Settings" to="/settings" isActive={activeTab === 'settings'} />
        </div>

        <div className="p-4 border-t border-slate-800">
          <button className="flex items-center gap-3 px-4 py-3 w-full text-left text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors">
            <LogOut size={20} />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* Mobile Header (Branding only) */}
        <header className="md:hidden flex items-center justify-center p-4 bg-slate-900 text-white shadow-md z-20 relative shrink-0">
          <div className="flex items-center gap-2">
            <FileCheck size={20} className="text-blue-400" />
            <h1 className="text-lg font-bold">ClearTrack PHO</h1>
          </div>
        </header>

        {/* Scrollable Content Routing Outlet 
            Added pb-20 on mobile to account for the bottom nav height 
        */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-20 md:pb-8">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation (Icons Only) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around items-center h-16 z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] pb-safe">
         <MobileBottomNavItem icon={<Activity />} to="/dashboard" isActive={activeTab === 'dashboard'} />
         <MobileBottomNavItem icon={<FileText />} to="/processing" isActive={activeTab === 'processing'} />
         <MobileBottomNavItem icon={<History />} to="/history" isActive={activeTab === 'history'} />
         <MobileBottomNavItem icon={<Settings />} to="/settings" isActive={activeTab === 'settings'} />
      </nav>

      {/* Global Modals */}
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
        {/* Dynamic styling for the icon based on active state */}
        <div className={`p-2 rounded-full ${isActive ? 'bg-blue-50' : ''}`}>
           {React.cloneElement(icon, { 
             size: 24, 
             strokeWidth: isActive ? 2.5 : 2 
           })}
        </div>
      </Link>
    );
}