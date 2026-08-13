import React, { useState, useRef, useEffect } from 'react';
import { useLanguage, LANGUAGES, Language } from '../../contexts/LanguageContext';
import { Globe, ChevronDown, Check } from 'lucide-react';

export const LanguageSelector: React.FC = () => {
  const { language, setLanguage, currentLanguageObj } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-50 hover:bg-surface-100 border border-surface-200 text-surface-700 font-medium text-xs transition-all duration-200 shadow-sm"
        aria-label="Change language"
      >
        <Globe size={15} className="text-primary-600 shrink-0" />
        <span className="font-bold">{currentLanguageObj.nativeName}</span>
        <ChevronDown size={14} className={`text-surface-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-44 bg-white rounded-2xl shadow-xl border border-surface-100 py-1.5 z-50 animate-scale-in">
          <div className="px-3 py-1.5 text-[10px] font-bold tracking-wider text-surface-400 uppercase border-b border-surface-100">
            Select Language
          </div>
          {LANGUAGES.map((lang) => {
            const isSelected = language === lang.code;
            return (
              <button
                key={lang.code}
                onClick={() => {
                  setLanguage(lang.code as Language);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors ${
                  isSelected
                    ? 'bg-primary-50 text-primary-700 font-bold'
                    : 'text-surface-700 hover:bg-surface-50 font-normal'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{lang.flag}</span>
                  <div>
                    <div className="leading-none">{lang.nativeName}</div>
                    <div className="text-[10px] text-surface-400 mt-0.5">{lang.name}</div>
                  </div>
                </div>
                {isSelected && <Check size={14} className="text-primary-600" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
