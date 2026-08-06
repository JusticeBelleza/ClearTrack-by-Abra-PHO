import React, { useState, useEffect } from 'react';
import { 
  User, Briefcase, Phone, Building, Hash, 
  Save, Bell, Shield, Key, Mail
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

export default function Settings() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'pho_staff'>('pho_staff');
  const [originalEmail, setOriginalEmail] = useState('');

  // Profile State
  const [profile, setProfile] = useState({
    employeeId: '',
    fullName: '',
    designation: '',
    contactNumber: '',
    department: '',
    email: ''
  });

  // System Notification Toggles (Local UI state for now)
  const [systemRouteAlerts, setSystemRouteAlerts] = useState(true);
  const [systemRushAlerts, setSystemRushAlerts] = useState(true);

  // Fetch Logged-In User Data from Supabase
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        
        if (authError || !session) {
          toast.error("Authentication error. Please log in again.");
          return;
        }

        setUserId(session.user.id);
        const userEmail = session.user.email || '';
        setOriginalEmail(userEmail);

        // Fetch user profile from the database
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profileError && profileError.code !== 'PGRST116') {
          console.error(profileError);
          toast.error("Failed to load profile data.");
        }

        if (profileData) {
          setUserRole(profileData.role || 'pho_staff');
          setProfile({
            employeeId: profileData.emp_id || '',
            fullName: profileData.full_name || '',
            designation: profileData.designation || '',
            contactNumber: profileData.contact_number || '',
            department: profileData.department || '',
            email: userEmail
          });
        }

      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    
    setIsSaving(true);
    
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: profile.fullName,
          designation: profile.designation,
          contact_number: profile.contactNumber,
          emp_id: profile.employeeId
        })
        .eq('id', userId);

      if (profileError) throw profileError;

      if (profile.email !== originalEmail) {
          const { error: authError } = await supabase.auth.updateUser({
              email: profile.email
          });

          if (authError) throw authError;

          toast.success('Profile updated successfully!', {
            description: 'Please check your inbox to confirm the email address change.'
          });
          setOriginalEmail(profile.email);
      } else {
          toast.success('Profile updated successfully!', {
            description: 'Your account information has been saved.'
          });
      }

    } catch (err: any) {
      toast.error('Failed to update profile', { description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePreferences = () => {
    toast.success('Preferences saved!', {
      description: 'Your system notification settings have been updated.'
    });
  };

  const handlePasswordReset = async () => {
    if (!profile.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(profile.email);
    if (error) {
      toast.error('Failed to send reset link', { description: error.message });
    } else {
      toast.success('Password Reset Email Sent', { description: 'Check your inbox for instructions.' });
    }
  };

  if (isLoading) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="mt-4 text-slate-500 font-bold">Loading Profile Data...</p>
        </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
      
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Account Settings</h2>
          {userRole === 'admin' && (
             <span className="bg-slate-900 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest flex items-center gap-1">
               <Shield size={12} /> Admin
             </span>
          )}
        </div>
        <p className="text-base text-slate-600 mt-1">Manage your personal information and system preferences.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Profile */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Account Information Card */}
          <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-sm overflow-hidden">
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <User className="text-blue-400" size={24} />
                <h3 className="text-xl font-black text-white tracking-wide">Personal Information</h3>
              </div>
            </div>
            
            <form onSubmit={handleSaveProfile}>
              <div className="p-6 sm:p-8 space-y-6">
                
                {/* Email (Editable) */}
                <div>
                  <label className="block text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
                    <Mail size={18} className="text-slate-500"/> Email Address
                  </label>
                  <input 
                    type="email" 
                    value={profile.email}
                    onChange={(e) => setProfile({...profile, email: e.target.value})}
                    placeholder="e.g. user@abrapho.gov.ph"
                    className="w-full p-4 bg-slate-50 border-2 border-slate-400 rounded-xl focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 outline-none text-base font-bold text-slate-900 transition-all" 
                  />
                  {profile.email !== originalEmail && (
                      <p className="text-xs font-bold text-orange-600 mt-2">Saving a new email will require verification.</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
                      <Hash size={18} className="text-slate-500"/> Employee ID
                    </label>
                    <input 
                      type="text" 
                      value={profile.employeeId}
                      onChange={(e) => setProfile({...profile, employeeId: e.target.value})}
                      placeholder="e.g. EMP-2026-001"
                      className="w-full p-4 bg-slate-50 border-2 border-slate-400 rounded-xl focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 outline-none text-base font-bold text-slate-900 font-mono transition-all" 
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
                      placeholder="e.g. Juan Dela Cruz"
                      className="w-full p-4 bg-slate-50 border-2 border-slate-400 rounded-xl focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 outline-none text-base font-bold text-slate-900 transition-all" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
                    <Building size={18} className="text-slate-500"/> Department / Agency
                  </label>
                  <input 
                    type="text" 
                    value={profile.department}
                    disabled
                    placeholder="Not assigned"
                    className="w-full p-4 bg-slate-100 border-2 border-slate-300 rounded-xl outline-none text-base font-bold text-slate-500 cursor-not-allowed" 
                  />
                  <p className="text-xs font-bold text-slate-400 mt-2">Contact System Admin for office transfers.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
                      <Briefcase size={18} className="text-slate-500"/> Designation
                    </label>
                    <input 
                      type="text" 
                      value={profile.designation}
                      onChange={(e) => setProfile({...profile, designation: e.target.value})}
                      placeholder="e.g. Program Coordinator"
                      className="w-full p-4 bg-slate-50 border-2 border-slate-400 rounded-xl focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 outline-none text-base font-bold text-slate-900 transition-all" 
                    />
                  </div>
                  <div>
                    <label className="block text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
                      <Phone size={18} className="text-slate-500"/> Contact Number
                    </label>
                    <input 
                      type="tel" 
                      value={profile.contactNumber}
                      onChange={(e) => setProfile({...profile, contactNumber: e.target.value})}
                      placeholder="e.g. 0917 123 4567"
                      className="w-full p-4 bg-slate-50 border-2 border-slate-400 rounded-xl focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 outline-none text-base font-bold text-slate-900 transition-all" 
                    />
                  </div>
                </div>
              </div>
              
              <div className="bg-slate-50 p-6 border-t-2 border-slate-200 flex justify-end">
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="w-full sm:w-auto px-8 py-4 bg-slate-900 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 text-base border-2 border-slate-900 hover:border-blue-700 shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <><Save size={20} /> Save Profile</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Preferences & Security */}
        <div className="space-y-8">
          
          {/* Notifications Card - ONLY VISIBLE TO PHO STAFF */}
          {userRole === 'pho_staff' && (
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
          )}

          {/* Security Card */}
          <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-sm overflow-hidden">
            <div className="bg-slate-900 px-6 py-4 flex items-center gap-3">
              <Shield className="text-blue-400" size={24} />
              <h3 className="text-xl font-black text-white tracking-wide">Security</h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-base text-slate-600 font-medium mb-4">Keep your account secure by updating your password regularly.</p>
              
              <button 
                onClick={handlePasswordReset}
                className="w-full py-4 bg-white border-2 border-slate-400 text-slate-800 hover:bg-slate-100 font-bold rounded-xl transition-all active:scale-95 text-base flex justify-center items-center gap-2"
              >
                <Key size={20} /> Change Password
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}