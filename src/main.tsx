// src/main.tsx
import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';

// Keep AppLayout static so the sidebar/shell renders instantly!
import AppLayout from './components/layout/AppLayout';
import './index.css';
import GlobalErrorBoundary from './components/system/GlobalErrorBoundary';

// 1. DYNAMIC IMPORTS: Only load the page code when the user navigates to it
const Dashboard = lazy(() => import('./routes/dashboard'));
const Processing = lazy(() => import('./routes/processing'));
const History = lazy(() => import('./routes/history'));
const Admin = lazy(() => import('./routes/admin'));
const Settings = lazy(() => import('./routes/settings'));
const Login = lazy(() => import('./routes/login'));

// Initialize React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

// 2. VISIBLE SKELETON LOADER
const PageSkeleton = () => (
  <div className="p-6 sm:p-8 w-full max-w-7xl mx-auto space-y-8 animate-pulse">
    {/* Header Skeleton */}
    <div className="flex flex-col gap-3">
      <div className="h-10 w-48 sm:w-64 bg-slate-200 rounded-xl"></div>
      <div className="h-5 w-64 sm:w-96 bg-slate-100 rounded-lg"></div>
    </div>

    {/* Search/Tabs Skeleton */}
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="h-14 flex-1 bg-slate-100 rounded-2xl border border-slate-200"></div>
      <div className="h-14 w-full sm:w-32 bg-slate-100 rounded-xl border border-slate-200"></div>
    </div>

    {/* Content/List Skeleton */}
    <div className="space-y-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white h-24 rounded-2xl border border-slate-200 shadow-sm flex items-center p-5 gap-4">
          <div className="w-1.5 h-full bg-slate-200 rounded-full"></div>
          <div className="flex-1 space-y-3">
            <div className="h-5 w-3/4 sm:w-1/2 bg-slate-200 rounded-lg"></div>
            <div className="h-4 w-1/2 sm:w-1/3 bg-slate-100 rounded-lg"></div>
          </div>
          <div className="hidden sm:block h-10 w-10 bg-slate-100 rounded-full"></div>
        </div>
      ))}
    </div>
  </div>
);

// 3. SETUP REACT ROUTER WITH SUSPENSE WRAPPERS
const router = createBrowserRouter([
  // Public Route (No Sidebar/Navigation)
  {
    path: '/login',
    element: <Suspense fallback={<PageSkeleton />}><Login /></Suspense>,
  },
  // Private Routes (Wrapped in static AppLayout)
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <Suspense fallback={<PageSkeleton />}><Dashboard /></Suspense> },
      { path: 'processing', element: <Suspense fallback={<PageSkeleton />}><Processing /></Suspense> },
      { path: 'history', element: <Suspense fallback={<PageSkeleton />}><History /></Suspense> },
      { path: 'admin', element: <Suspense fallback={<PageSkeleton />}><Admin /></Suspense> },
      { path: 'settings', element: <Suspense fallback={<PageSkeleton />}><Settings /></Suspense> },
    ],
  },
  // Fallback redirect for unknown routes
  {
    path: '*',
    element: <Navigate to="/login" replace />
  }
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster position="top-center" richColors />
      </QueryClientProvider>
    </GlobalErrorBoundary>
  </StrictMode>
);