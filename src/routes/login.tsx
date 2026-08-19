// src/routes/login.tsx
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight, Loader2, Eye, EyeOff, Fingerprint } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { Turnstile } from '@marsidev/react-turnstile';
import type { TurnstileInstance } from '@marsidev/react-turnstile';
import { env } from '../lib/env';

// Both logos are back!
import clearTrackLogo from '../assets/clear_track_logo.png';
import phoLogo from '../assets/pho_logo.png';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isBiometricLoading, setIsBiometricLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  // Added a reference to the Turnstile widget so we can reset it on failure
  const turnstileRef = useRef<TurnstileInstance>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Validation Error", { description: "Please enter both email and password." });
      return;
    }

    if (!turnstileToken) {
      toast.error("Security Check Required", { description: "Please complete the Cloudflare security verification." });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
        options: {
          captchaToken: turnstileToken
        }
      });

      if (error) throw error;

      await navigateToDashboard(data.user.id);
    } catch (err: unknown) {
      console.error("Supabase Auth Error:", err);
      const errorMessage = err instanceof Error ? err.message : "Invalid credentials.";
      toast.error("Login Failed", { description: errorMessage });
      
      // Reset the CAPTCHA token so the user can try again without refreshing
      setTurnstileToken(null);
      turnstileRef.current?.reset();
      
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    setIsBiometricLoading(true);
    try {
      // @ts-expect-error - Supabase Experimental Passkey Method
      
      if (error) throw error;
      
      if (data?.user?.id) {
          await navigateToDashboard(data.user.id);
      }
    } catch (err: unknown) {
      console.error("Biometric Login Error:", err);
      const errorMessage = err instanceof Error ? err.message : "Authentication failed.";
      toast.error("Biometric Login Failed", { description: errorMessage });
    } finally {
      setIsBiometricLoading(false);
    }
  };

  const navigateToDashboard = async (userId: string) => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      toast.success("Welcome Back!");

      if (profile?.role === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
  };

  const handleForgotPassword = () => {
    toast.info("Password Reset", { 
      description: "Please contact your System Administrator to reset your password." 
    });
  };

  return (
    // min-h-[100dvh] for perfect mobile keyboard handling
    <div className="min-h-[100dvh] bg-slate-900 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30rem] h-[30rem] bg-blue-600/20 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl shadow-black/50 border border-slate-100 p-8 sm:p-10 relative z-10 animate-in fade-in zoom-in-95 duration-500">
        
        {/* Logos Section */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="w-14 h-14 flex items-center justify-center bg-slate-50 rounded-2xl p-2 border border-slate-100 shadow-sm">
            <img 
              src={clearTrackLogo} 
              alt="App Logo" 
              className="w-full h-full object-contain drop-shadow-sm" 
            />
          </div>

          <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>

          <div className="w-14 h-14 flex items-center justify-center bg-slate-50 rounded-2xl p-2 border border-slate-100 shadow-sm">
            <img 
              src={phoLogo} 
              alt="Abra PHO Logo" 
              className="w-full h-full object-contain drop-shadow-sm" 
            />
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">filetrackr<span className="text-blue-600">.</span></h2>
          <p className="text-[11px] font-bold text-blue-600 uppercase tracking-widest mt-1">Abra Provincial Health Office</p>
          <p className="text-sm text-slate-500 font-medium mt-2">Sign in to manage and route documents</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {/* Email Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Email Address</label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-blue-600 transition-colors duration-200" />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@abra.gov.ph"
                required
                autoComplete="email"
                disabled={isLoading || isBiometricLoading}
                className="w-full pl-12 pr-4 py-3.5 bg-slate-50/50 border-2 border-slate-200 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10 rounded-2xl outline-none font-semibold text-slate-900 transition-all text-base placeholder:text-slate-400 placeholder:font-normal disabled:opacity-70"
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <div className="flex justify-between items-end mb-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Password</label>
              <button 
                type="button" 
                onClick={handleForgotPassword}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors hover:underline active:scale-95"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-blue-600 transition-colors duration-200" />
              <input 
                type={showPassword ? 'text' : 'password'} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                disabled={isLoading || isBiometricLoading}
                className="w-full pl-12 pr-14 py-3.5 bg-slate-50/50 border-2 border-slate-200 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10 rounded-2xl outline-none font-semibold text-slate-900 transition-all text-base placeholder:text-slate-400 placeholder:font-normal disabled:opacity-70"
              />
              {/* Touch-optimized password toggle */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-blue-600 active:scale-90 transition-all"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {/* Captcha Container */}
          <div className="flex justify-center pt-2">
            <div className="w-full flex justify-center sm:rounded-2xl sm:bg-slate-50/80 sm:border-2 sm:border-slate-100 sm:p-1.5 sm:shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] [&_iframe]:!border-none [&_iframe]:!outline-none [&_iframe]:!rounded-none [&>div]:!border-none overflow-hidden">
              <Turnstile
                ref={turnstileRef}
                siteKey={env.VITE_TURNSTILE_SITE_KEY}
                options={{ theme: 'light' }}
                onSuccess={(token) => setTurnstileToken(token)}
                onError={() => {
                  setTurnstileToken(null);
                  toast.error("Security check failed. Please try again.");
                }}
                onExpire={() => setTurnstileToken(null)}
              />
            </div>
          </div>

          {/* Standard Login Button */}
          <button 
            type="submit" 
            disabled={isLoading || isBiometricLoading || !turnstileToken}
            className="w-full py-4 mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-[0_8px_16px_-6px_rgba(37,99,235,0.4)] hover:shadow-[0_12px_20px_-8px_rgba(37,99,235,0.6)] transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-base border border-blue-500 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:shadow-none"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin h-5 w-5" />
                Authenticating...
              </>
            ) : (
              <>
                Sign In <ArrowRight size={20} strokeWidth={2.5} />
              </>
            )}
          </button>
        </form>

        <div className="relative flex items-center justify-center py-5">
            <div className="w-full h-px bg-slate-200"></div>
            <span className="absolute bg-white px-4 text-xs font-bold text-slate-400 uppercase tracking-widest">or</span>
        </div>

        {/* NEW: Biometric Login Button */}
        <button 
            type="button"
            onClick={handleBiometricLogin}
            disabled={isLoading || isBiometricLoading}
            className="w-full py-3.5 bg-slate-50 hover:bg-slate-100 text-slate-900 font-bold rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm border-2 border-slate-200 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
        >
            {isBiometricLoading ? (
                <>
                    <Loader2 className="animate-spin h-5 w-5 text-blue-600" />
                    Scanning...
                </>
            ) : (
                <>
                    <Fingerprint size={20} className="text-blue-600" />
                    Sign in with Passkey / Face ID
                </>
            )}
        </button>

        <div className="mt-8 text-center border-t border-slate-100 pt-6">
          <p className="text-xs text-slate-400 font-medium mb-3">
            Authorized personnel only. All access attempts are monitored and logged.
          </p>
          <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
            v{__APP_VERSION__}
          </p>
        </div>

      </div>
    </div>
  );
}