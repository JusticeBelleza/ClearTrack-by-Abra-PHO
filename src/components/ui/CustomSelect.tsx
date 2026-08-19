// src/components/ui/CustomSelect.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import type { DocumentItem } from '../../types/processing';

interface CustomSelectProps {
    options: OptionType[];
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    disabled?: boolean;
    emptyText?: string;
    isRelative?: boolean;
    itemType?: string;
}

export default function CustomSelect({ 
    options, value, onChange, placeholder, disabled = false, 
    emptyText = "Loading options...", isRelative = false, itemType = "option" 
}: CustomSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const dropdownRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null); 
    const searchInputRef = useRef<HTMLInputElement>(null);
 
    useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false);
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
      if (isOpen) {
        setTimeout(() => {
          searchInputRef.current?.focus();
          menuRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 50);
      } else {
        setSearchTerm("");
      }
    }, [isOpen]);

    const filteredOptions = options.filter(opt => {
        const optLabel = typeof opt === 'string' ? opt : opt.label;
        return optLabel.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const MAX_ITEMS_TO_SHOW = 10;
    const visibleOptions = filteredOptions.slice(0, MAX_ITEMS_TO_SHOW);
    const hiddenCount = filteredOptions.length - visibleOptions.length;

    const selectedOptionLabel = options.find(opt => (typeof opt === 'string' ? opt : opt.value) === value);
    const displayLabel = selectedOptionLabel 
        ? (typeof selectedOptionLabel === 'string' ? selectedOptionLabel : selectedOptionLabel.label)
        : placeholder;
 
    return (
      <div className="relative w-full" ref={dropdownRef}>
        <button 
            type="button" 
            disabled={disabled}
            onClick={() => !disabled && setIsOpen(!isOpen)} 
            className={`w-full px-4 py-3.5 bg-slate-50/50 focus:bg-white border focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl flex justify-between items-center transition-all text-sm outline-none active:scale-[0.99] ${isOpen ? 'border-blue-500 bg-white ring-4 ring-blue-500/10' : 'border-slate-200 hover:bg-white hover:border-slate-300'} ${!value ? 'text-slate-500 font-medium' : 'text-slate-700 font-bold'}`}
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronDown size={20} className={`text-slate-400 transition-transform duration-300 ease-in-out sm:w-5 sm:h-5 ${isOpen ? 'rotate-180 text-slate-800' : ''}`} />
        </button>

        {isOpen && !disabled && (
          <div ref={menuRef} className={`${isRelative ? 'relative mt-2 mb-4' : 'absolute mt-1.5'} z-50 w-full bg-white border border-slate-200 rounded-xl shadow-xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200`}>
            
            {options.length > 5 && (
                <div className="p-2 border-b border-slate-100 bg-slate-50 shrink-0">
                    <div className="relative">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            ref={searchInputRef} type="text" placeholder="Type to search..."
                            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onClick={(e) => e.stopPropagation()}
                            className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-medium text-slate-800 placeholder:text-slate-400"
                        />
                    </div>
                </div>
            )}

            <div className="max-h-[240px] overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
              {filteredOptions.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-slate-500 text-center font-medium">
                      {searchTerm ? `No results for "${searchTerm}"` : emptyText}
                  </div>
              ) : (
                  visibleOptions.map((option: OptionType, idx: number) => {
                    const optValue = typeof option === 'string' ? option : option.value;
                    const optLabel = typeof option === 'string' ? option : option.label;
                    const isSelected = optValue === value;
                    return (
                      <div 
                        key={idx} onClick={() => { onChange(optValue); setIsOpen(false); }} 
                        className={`px-4 py-3 text-sm rounded-lg cursor-pointer transition-colors flex items-center active:scale-95 ${isSelected ? 'bg-blue-600 text-white font-bold shadow-sm' : 'text-slate-700 hover:bg-slate-100 font-medium'}`}
                      >
                        {optLabel}
                      </div>
                    );
                  })
              )}
            </div>
            {hiddenCount > 0 && (
                <div className="p-2.5 bg-slate-50 border-t border-slate-100 shrink-0 text-center">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        +{hiddenCount} more {hiddenCount === 1 ? itemType : `${itemType}s`}. Keep typing to search.
                    </p>
                </div>
            )}
          </div>
        )}
      </div>
    );
}