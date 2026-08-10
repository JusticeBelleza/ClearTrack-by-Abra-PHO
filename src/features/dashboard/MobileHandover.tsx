import { useQuery } from '@tanstack/react-query';
import { FileUp, Clock, AlertCircle, MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useUiStore } from '../../store/uiStore';

// Define the shape of our document so TypeScript knows what properties exist
interface ActiveDocument {
    id: string;
    reference_no?: string;
    is_urgent?: boolean;
    title?: string;
    subject?: string;
    current_location?: string;
    status?: string;
}

export default function MobileHandoverDashboard() {
    // Safely type-cast through unknown to satisfy strict TypeScript rules without using 'any'
    const openHandoverDrawer = useUiStore((state: unknown) => (state as { openHandoverDrawer: () => void }).openHandoverDrawer);

    // 1. Fetch only documents currently assigned to this user's custody
    const { data: activeDocs = [], isLoading, isError } = useQuery({
        queryKey: ['active-custody'],
        queryFn: async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("No authenticated session found");

            const currentUserId = session.user.id;
            const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', currentUserId).single();
            const currentUserName = profile?.full_name || '';

            const { data, error } = await supabase
                .from('documents')
                .select('*')
                .neq('status', 'sealed')
                .or(`created_by.eq.${currentUserId},assigned_clerk.eq.${currentUserName}`)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            return data || [];
        }
    });

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-8">
                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                <p className="mt-4 text-slate-500 font-bold text-sm">Loading Custody Records...</p>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="bg-red-50 p-4 rounded-2xl border-2 border-red-200 flex items-center gap-3">
                <AlertCircle className="text-red-600 shrink-0" size={24} />
                <p className="text-red-700 font-bold text-sm">Failed to load active documents. Please check your connection.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 animate-in fade-in duration-300 w-full">
            
            {/* Action Banner */}
            <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <FileUp size={100} />
                </div>
                
                <div className="relative z-10">
                    <h3 className="text-xl font-black mb-1">Mobile Handover</h3>
                    <p className="text-blue-100 text-sm font-medium mb-6 max-w-[80%]">
                        You have <span className="font-bold text-white bg-blue-500/50 px-2 py-0.5 rounded-md">{activeDocs.length}</span> documents in your custody.
                    </p>
                    
                    <button 
                        onClick={openHandoverDrawer}
                        className="w-full bg-white text-blue-700 hover:bg-blue-50 active:scale-95 transition-all font-black py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-md border-2 border-transparent"
                    >
                        <FileUp size={20} strokeWidth={2.5} /> Initiate Handover
                    </button>
                </div>
            </div>

            {/* Quick List of Active Custody */}
            <div className="flex flex-col gap-3">
                <h4 className="font-black text-slate-900 text-lg px-1 flex items-center gap-2 mt-2">
                    <Clock size={20} className="text-slate-500" /> Current Custody
                </h4>

                {activeDocs.length === 0 ? (
                    <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center">
                        <p className="text-slate-500 font-medium text-sm">Your custody queue is empty.</p>
                    </div>
                ) : (
                    activeDocs.map((doc: ActiveDocument) => (
                        <div key={doc.id} className="bg-white border-2 border-slate-200 rounded-2xl p-4 flex flex-col gap-2 shadow-sm">
                            <div className="flex justify-between items-start">
                                <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded font-mono border border-slate-200">
                                    {doc.reference_no || doc.id.substring(0, 8)}
                                </span>
                                {doc.is_urgent && (
                                    <span className="text-[10px] font-black text-red-700 bg-red-50 px-2 py-1 rounded-full border border-red-200 uppercase tracking-wider">
                                        Urgent
                                    </span>
                                )}
                            </div>
                            <h5 className="font-bold text-slate-900 leading-snug line-clamp-2">
                                {doc.title || doc.subject}
                            </h5>
                            <div className="flex items-center gap-1.5 mt-1 text-slate-500">
                                <MapPin size={14} />
                                <span className="text-xs font-semibold truncate">{doc.current_location || 'Processing'}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
            
        </div>
    );
}