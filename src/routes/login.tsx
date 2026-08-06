import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileCheck, Lock, User, Eye, EyeOff, ArrowRight, ShieldCheck, Check } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Missing Information', { description: 'Please enter both Email and Password.' });
      return;
    }

    setIsLoading(true);

    try {
      // 1. Authenticate with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (authError) {
        toast.error('Authentication Failed', { description: authError.message });
        setIsLoading(false);
        return;
      }

      if (!authData.user) {
        toast.error('Authentication Failed', { description: 'User account not found.' });
        setIsLoading(false);
        return;
      }

      // 2. Fetch User Profile to check role and active status
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (profileError || !profile) {
        toast.error('Profile Error', { description: 'User profile record is missing.' });
        await supabase.auth.signOut();
        setIsLoading(false);
        return;
      }

      if (!profile.is_active) {
        toast.error('Account Deactivated', { description: 'Your account has been disabled. Contact System Admin.' });
        await supabase.auth.signOut();
        setIsLoading(false);
        return;
      }

      toast.success('Login Successful', { description: `Welcome back, ${profile.full_name || 'User'}.` });

      // 3. Role-Based Redirect
      if (profile.role === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }

    } catch (err: any) {
      toast.error('Login Error', { description: err.message || 'An unexpected error occurred.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 sm:p-8 font-sans animate-in fade-in duration-500">
      
      {/* Main Login Card */}
      <div className="w-full max-w-md bg-white rounded-3xl border-2 border-slate-300 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">
        
        {/* Branding Header */}
        <div className="bg-slate-900 p-8 sm:p-10 flex flex-col items-center text-center relative overflow-hidden">
          <div className="absolute -top-12 -right-12 text-slate-800 opacity-50">
            <ShieldCheck size={120} />
          </div>
          
          <div className="relative z-10 bg-blue-600 p-4 rounded-2xl text-white mb-4 shadow-lg shadow-blue-600/30">
            <FileCheck size={40} strokeWidth={2.5} />
          </div>
          <h1 className="relative z-10 text-3xl sm:text-4xl font-black text-white tracking-wide mb-1">ClearTrack</h1>
          <p className="relative z-10 text-sm sm:text-base text-blue-200 font-bold uppercase tracking-widest">Abra Provincial Health Office</p>
        </div>

        {/* Login Form */}
        <div className="p-6 sm:p-10">
          <form onSubmit={handleLogin} className="space-y-6">
            
            {/* Email Input */}
            <div>
              <label className="block text-base font-bold text-slate-900 mb-2">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User size={20} className="text-slate-400" />
                </div>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. user@abrapho.gov.ph" 
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-400 rounded-xl focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 outline-none text-base font-bold text-slate-900 placeholder:text-slate-500 transition-all font-mono"
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-base font-bold text-slate-900 mb-2">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock size={20} className="text-slate-400" />
                </div>
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password" 
                  className="w-full pl-12 pr-12 py-4 bg-slate-50 border-2 border-slate-400 rounded-xl focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 outline-none text-base font-bold text-slate-900 placeholder:text-slate-500 transition-all"
                  disabled={isLoading}
                  required
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-800 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between mt-2">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative flex items-center justify-center">
                  <input 
                    type="checkbox" 
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="peer appearance-none w-6 h-6 border-2 border-slate-400 rounded-md checked:bg-blue-600 checked:border-blue-600 transition-all cursor-pointer"
                  />
                  <Check size={16} strokeWidth={4} className="text-white absolute opacity-0 peer-checked:opacity-100 pointer-events-none" />
                </div>
                <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">Remember me</span>
              </label>

              <button 
                type="button" 
                onClick={() => toast.info('Contact System Administrator to reset your password.')}
                className="text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors"
              >
                Forgot Password?
              </button>
            </div>

            {/* Submit Button */}
            <button 
              type="submit"
              disabled={isLoading}
              className="w-full py-4 mt-4 bg-slate-900 hover:bg-blue-700 text-white font-black rounded-xl shadow-lg transition-all active:scale-95 text-lg flex items-center justify-center gap-2 border-2 border-slate-900 hover:border-blue-700 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>Secure Login <ArrowRight size={20} strokeWidth={3} /></>
              )}
            </button>
          </form>
        </div>

        {/* System Admin Notice */}
        <div className="bg-slate-100 p-6 text-center border-t-2 border-slate-200">
          <p className="text-sm font-medium text-slate-600">
            Need an account or lost access? <br className="sm:hidden" />
            <span className="font-bold text-slate-900">Contact your System Administrator.</span>
          </p>
        </div>

      </div>

      {/* Footer Branding */}
      <div className="mt-8 text-center opacity-60">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">ClearTrack Document Management</p>
        <p className="text-xs font-medium text-slate-400 mt-1">© 2026 Abra Provincial Health Office</p>
      </div>

    </div>
  );
}