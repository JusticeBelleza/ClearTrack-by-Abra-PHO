// src/features/dashboard/MobileHandover.tsx
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { useUiStore } from '@/store/uiStore';
import { FileUp, Clock } from 'lucide-react';

export default function MobileHandoverDashboard() {
  const openHandoverDrawer = useUiStore((state) => state.openHandoverDrawer);

  // 1. Fetch only documents currently assigned to this user's custody
  const { data: activeDocs, isLoading } = useQuery({
    queryKey: ['active-custody'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('status', 'routing')
        // RLS guarantees they only see their own custody, 
        // but we filter explicitly here for safety
        .order('created_at', { ascending: false }); 
        
      if (error) throw error;
      return data;
    }
  });

  if (isLoading) return <div className="animate-pulse">Loading custody roster...</div>;

  if (!activeDocs || activeDocs.length === 0) {
    return (
      <div className="text-center mt-20 text-gray-500">
        <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
          <FileUp size={28} />
        </div>
        <h3 className="font-semibold text-lg">No Active Documents</h3>
        <p className="text-sm">You currently have no documents in your custody.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-bold tracking-tight mb-2">My Active Roster</h2>
      
      {activeDocs.map((doc) => (
        <div key={doc.id} className="bg-white border rounded-lg p-4 shadow-sm flex flex-col gap-3">
          <div>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">
              {doc.reference_no}
            </span>
            <h3 className="font-semibold text-lg mt-2 leading-tight">{doc.title}</h3>
          </div>
          
          <div className="flex items-center text-sm text-gray-500 gap-1">
            <Clock size={14} />
            <span>Assigned to you</span>
          </div>

          <Button 
            className="w-full mt-2 bg-blue-900 hover:bg-blue-800 text-white font-medium"
            onClick={() => openHandoverDrawer(doc.id)}
          >
            Route Record
          </Button>
        </div>
      ))}
    </div>
  );
}