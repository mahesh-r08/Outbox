import React, { useState, useRef, useEffect } from 'react';
import { Search, LogOut, Settings as SettingsIcon } from 'lucide-react';
import type { User } from '../../types/index.js';

export interface HeaderProps {
  user: User | null;
  onLogout: () => void;
  onOpenSettings?: () => void;
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onLogout,
  onOpenSettings,
  searchQuery = '',
  onSearchChange,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const initial = user?.name ? user.name.charAt(0).toUpperCase() : 'T';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-8 py-4 bg-[#F8FAFC]/90 backdrop-blur-xs border-b border-slate-200/60">
      {/* Title on left */}
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
        OPERATIONS COMMAND CENTER
      </div>

      {/* Right controls: Search + Avatar */}
      <div className="flex items-center gap-3">
        <div className="relative w-52 sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search emails..."
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>

        {/* User avatar dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100/90 text-emerald-800 font-bold text-xs hover:bg-emerald-200 transition-colors cursor-pointer border border-emerald-200"
            title={user?.name || 'User profile'}
          >
            {initial}
          </button>

          {/* Dropdown Menu */}
          {showDropdown && (
            <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white border border-slate-200 shadow-lg py-1 z-50 animate-in fade-in zoom-in-95">
              <div className="px-3.5 py-2.5 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-900 truncate">{user?.name}</p>
                <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
              </div>

              {onOpenSettings && (
                <button
                  type="button"
                  onClick={() => {
                    setShowDropdown(false);
                    onOpenSettings();
                  }}
                  className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <SettingsIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>Settings</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setShowDropdown(false);
                  onLogout();
                }}
                className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
