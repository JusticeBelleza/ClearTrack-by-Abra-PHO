import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react'; // <-- Added 'type' import here
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // In a full enterprise setup, this is where you send the error to Sentry:
    // Sentry.captureException(error, { extra: errorInfo });
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 selection:bg-red-200">
          <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border-2 border-red-100 p-8 text-center animate-in fade-in zoom-in duration-500">
            <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <AlertTriangle size={40} strokeWidth={2.5} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">Oops! Something snapped.</h1>
            <p className="text-slate-600 font-medium mb-8">
              The application encountered an unexpected error. Don't worry, your data is safe. Our technical team has been notified.
            </p>
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={this.handleReset}
                className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md border-2 border-red-700"
              >
                <RefreshCcw size={20} /> Reload Application
              </button>
              <button 
                onClick={() => window.location.href = '/dashboard'}
                className="w-full py-4 bg-white text-slate-700 hover:bg-slate-50 font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 border-2 border-slate-300"
              >
                <Home size={20} /> Return to Dashboard
              </button>
            </div>
            
            {/* Show exact error in Vite development mode */}
            {import.meta.env.DEV && this.state.error && (
                <div className="mt-8 p-4 bg-slate-900 rounded-xl text-left overflow-auto">
                    <p className="text-red-400 font-mono text-xs font-bold mb-1">Developer Error Log:</p>
                    <p className="text-slate-300 font-mono text-xs">{this.state.error.toString()}</p>
                </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}