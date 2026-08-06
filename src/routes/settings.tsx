import React, { useState } from 'react';
import { 
  User, Briefcase, Phone, Building, Hash, 
  Save, Bell, Shield, Key
} from 'lucide-react';
import { toast } from 'sonner';

export default function Settings() {
  // Mock User Profile State
  const [profile, setProfile] = useState({
    employeeId: 'EMP-2024-089',
    fullName: 'Sarah Lee',
    designation: 'Program Coordinator',
    contactNumber: '+63 917 123 4567',
    department: 'Provincial Health Office'
  });

  // System Notification Toggles
  const [systemRouteAlerts, setSystemRouteAlerts] = useState(true);
  const [systemRushAlerts, setSystemRushAlerts] = useState(true);

  const handleSaveProfile = () => {
    // In a real app, this would be an API call
    toast.success('Profile updated successfully!', {
      description: 'Your account information has been saved.'
    });
  };

  const handleSavePreferences = () => {
    toast.success('Preferences saved!', {
      description: 'Your system notification settings have been updated.'
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
      
      {/* Header */}
      <div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Settings</h2>
        <p className="text-base text-slate-600 mt-1">Manage your account information and system preferences.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Profile */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Account Information Card */}
          <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-sm overflow-hidden">
            <div className="bg-slate-900 px-6 py-4 flex items-center gap-3">
              <User className="text-blue-400" size={24} />
              <h3 className="text-xl font-black text-white tracking-wide">Account Information</h3>
            </div>
            
            <div className="p-6 sm:p-8 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
                    <Hash size={18} className="text-slate-500"/> Employee ID
                  </label>
                  <input 
                    type="text" 
                    value={profile.employeeId}
                    onChange={(e) => setProfile({...profile, employeeId: e.target.value})}
                    className="w-full p-4 bg-slate-50 border-2 border-slate-400 rounded-xl focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 outline-none text-base font-bold text-slate-900 transition-all font-mono" 
                  />
                </div>
                <div>
                  <label className="block text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
                    <User size={18} className="text-slate-500"/> Full Name
                  </label>
                  <input 
                    type="text" 
                    value={profile.fullName}
                    onChange={(e) => setProfile({...profile, fullName: e.target.value})}
                    className="w-full p-4 bg-slate-50 border-2 border-slate-400 rounded-xl focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 outline-none text-base font-bold text-slate-900 transition-all" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
                  <Briefcase size={18} className="text-slate-500"/> Designation <span className="text-slate-500 font-medium text-sm">(Shows on routing labels)</span>
                </label>
                <input 
                  type="text" 
                  value={profile.designation}
                  onChange={(e) => setProfile({...profile, designation: e.target.value})}
                  placeholder="E.g., Program Coordinator"
                  className="w-full p-4 bg-slate-50 border-2 border-slate-400 rounded-xl focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 outline-none text-base font-bold text-slate-900 transition-all" 
                />
              </div>

              <div>
                <label className="block text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
                  <Building size={18} className="text-slate-500"/> Department / Agency
                </label>
                <input 
                  type="text" 
                  value={profile.department}
                  onChange={(e) => setProfile({...profile, department: e.target.value})}
                  placeholder="E.g., Provincial Health Office"
                  className="w-full p-4 bg-slate-50 border-2 border-slate-400 rounded-xl focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 outline-none text-base font-bold text-slate-900 transition-all" 
                />
              </div>

              <div>
                <label className="block text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
                  <Phone size={18} className="text-slate-500"/> Contact #
                </label>
                <input 
                  type="tel" 
                  value={profile.contactNumber}
                  onChange={(e) => setProfile({...profile, contactNumber: e.target.value})}
                  placeholder="0917 123 4567"
                  className="w-full p-4 bg-slate-50 border-2 border-slate-400 rounded-xl focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 outline-none text-base font-bold text-slate-900 transition-all" 
                />
              </div>
            </div>
            
            <div className="bg-slate-50 p-6 border-t-2 border-slate-200 flex justify-end">
              <button 
                onClick={handleSaveProfile}
                className="w-full sm:w-auto px-8 py-4 bg-slate-900 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 text-base border-2 border-slate-900 hover:border-blue-700 shadow-md"
              >
                <Save size={20} /> Save Profile
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Preferences & Security */}
        <div className="space-y-8">
          
          {/* Notifications Card */}
          <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-sm overflow-hidden">
            <div className="bg-slate-900 px-6 py-4 flex items-center gap-3">
              <Bell className="text-blue-400" size={24} />
              <h3 className="text-xl font-black text-white tracking-wide">System Alerts</h3>
            </div>
            <div className="p-6 space-y-6">
              
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-slate-900 text-lg">Direct Routing</h4>
                  <p className="text-sm text-slate-600 font-medium">Get notified within the system when a document is assigned directly to you.</p>
                </div>
                <button 
                  onClick={() => setSystemRouteAlerts(!systemRouteAlerts)}
                  className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-4 focus:ring-slate-900/10 ${systemRouteAlerts ? 'bg-emerald-500 border-emerald-600' : 'bg-slate-200 border-slate-300'}`}
                >
                  <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out mt-0.5 ml-0.5 ${systemRouteAlerts ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-slate-900 text-lg">Priority / RUSH</h4>
                  <p className="text-sm text-slate-600 font-medium">Receive urgent in-app pings for priority documents tagged to your department.</p>
                </div>
                <button 
                  onClick={() => setSystemRushAlerts(!systemRushAlerts)}
                  className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-4 focus:ring-slate-900/10 ${systemRushAlerts ? 'bg-emerald-500 border-emerald-600' : 'bg-slate-200 border-slate-300'}`}
                >
                  <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out mt-0.5 ml-0.5 ${systemRushAlerts ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              <button 
                onClick={handleSavePreferences}
                className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl transition-all active:scale-95 text-base border-2 border-slate-300 flex justify-center items-center gap-2"
              >
                Update Preferences
              </button>
            </div>
          </div>

          {/* Security Card */}
          <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-sm overflow-hidden">
            <div className="bg-slate-900 px-6 py-4 flex items-center gap-3">
              <Shield className="text-blue-400" size={24} />
              <h3 className="text-xl font-black text-white tracking-wide">Security</h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-base text-slate-600 font-medium mb-4">Ensure your account is using a strong, secure password.</p>
              
              <button className="w-full py-4 bg-white border-2 border-slate-400 text-slate-800 hover:bg-slate-100 font-bold rounded-xl transition-all active:scale-95 text-base flex justify-center items-center gap-2">
                <Key size={20} /> Change Password
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}