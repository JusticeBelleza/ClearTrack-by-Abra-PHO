// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';

import AppLayout from './components/layout/AppLayout';
import Dashboard from './routes/dashboard';
import Processing from './routes/processing';
import History from './routes/history';
import Admin from './routes/admin'; // <-- Imported Admin Route
import Settings from './routes/settings';
import Login from './routes/login';
import './index.css';

// --- Import our new Safety Net ---
import GlobalErrorBoundary from './components/system/GlobalErrorBoundary';

// Initialize React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

// Setup React Router
const router = createBrowserRouter([
  // Public Route (No Sidebar/Navigation)
  {
    path: '/login',
    element: <Login />,
  },
  // Private Routes (Wrapped in AppLayout)
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'processing', element: <Processing /> },
      { path: 'history', element: <History /> },
      { path: 'admin', element: <Admin /> }, // <-- Wired up Admin Route
      { path: 'settings', element: <Settings /> },
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
    {/* --- Wrap the entire app in the Error Boundary --- */}
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster position="top-center" richColors />
      </QueryClientProvider>
    </GlobalErrorBoundary>
  </StrictMode>
);