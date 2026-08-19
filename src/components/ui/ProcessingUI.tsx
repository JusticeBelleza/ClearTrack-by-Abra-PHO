// src/components/ui/ProcessingUI.tsx
import React from 'react';
import type { TabButtonProps } from '../../types/processing';

export function TabButton({ label, icon, count, isActive, onClick, colorClass, badgeClass, newCount = 0 }: TabButtonProps) {
    return (
        <button 
            onClick={onClick}
            title={label}
            className={`relative flex-none shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-95 active:shadow-inner text-sm whitespace-nowrap overflow-hidden border-2 ${
                isActive ? `${colorClass} border-transparent shadow-sm` : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700'
            }`}
        >
            {newCount > 0 && !isActive && (
                <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border border-white"></span>
                </span>
            )}
            
            {icon}
            
            {isActive && <span className="animate-in fade-in slide-in-from-left-2 duration-200">{label}</span>}
            
            <div className="flex items-center gap-1.5">
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] border ${isActive ? badgeClass : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
                    {count}
                </span>
                
                {newCount > 0 && !isActive && (
                    <span className="text-[9px] font-black text-white bg-red-500 px-1.5 py-0.5 rounded shadow-sm animate-in zoom-in flex items-center">
                        {newCount} NEW
                    </span>
                )}
            </div>
        </button>
    );
}