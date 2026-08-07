import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

// Import both logos from your assets folder
import clearTrackLogo from '../assets/clear_track_logo.png';
import phoLogo from '../assets/pho_logo.png';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Validation Error", { description: "Please enter both email and password." });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) throw error;

      // Check user role to redirect appropriately
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      toast.success("Welcome Back!");

      if (profile?.role === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err: any) {
      toast.error("Login Failed", { description: err.message || "Invalid credentials." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    toast.info("Password Reset", { 
      description: "Please contact your System Administrator to reset your password." 
    });
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden">
      
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border-2 border-slate-100 p-8 sm:p-10 relative z-10 animate-in fade-in zoom-in-95 duration-500">
        
        {/* LOGOS CONTAINER - Reduced gap to pull them closer */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {/* ClearTrack Logo */}
          <div className="w-16 h-16 flex items-center justify-center">
            <img 
              src={clearTrackLogo} 
              alt="ClearTrack Logo" 
              className="w-full h-full object-contain drop-shadow-md" 
            />
          </div>

          {/* Divider */}
          <div className="w-px h-10 bg-slate-200 mx-1"></div>

          {/* PHO Logo */}
          <div className="w-14 h-14 flex items-center justify-center">
            <img 
              src={phoLogo} 
              alt="Abra PHO Logo" 
              className="w-full h-full object-contain drop-shadow-md" 
            />
          </div>
        </div>

        {/* Title & Subtitle */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">ClearTrack</h2>
          <p className="text-sm font-bold text-blue-600 uppercase tracking-widest mt-1">Provincial Health Office of Abra</p>
          <p className="text-xs text-slate-500 font-medium mt-1">Sign in to manage and route documents</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@abra.gov.ph"
                required
                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-200 focus:border-blue-600 focus:bg-white rounded-2xl outline-none font-bold text-slate-900 transition-all text-base"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-end mb-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Password</label>
              <button 
                type="button" 
                onClick={handleForgotPassword}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors hover:underline active:scale-95"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-200 focus:border-blue-600 focus:bg-white rounded-2xl outline-none font-bold text-slate-900 transition-all text-base"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-base border-2 border-blue-500 disabled:opacity-50 mt-2"
          >
            {isLoading ? (
              <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <>Sign In <ArrowRight size={20} strokeWidth={2.5} /></>
            )}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-slate-100 pt-6">
          <p className="text-xs text-slate-400 font-medium">
            Authorized personnel only. All access attempts are monitored and logged.
          </p>
        </div>

      </div>
    </div>
  );
}