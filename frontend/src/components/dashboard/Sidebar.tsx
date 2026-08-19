import React from 'react';
import { BarChart3, Mail, Calendar, Send, Settings, LogOut } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import type { User } from '../../types/index.js';

export type DashboardTab = 'overview' | 'emails' | 'scheduled' | 'sent' | 'settings';

export interface SidebarProps {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  scheduledCount?: number;
  sentCount?: number;
  user?: User | null;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  scheduledCount = 0,
  sentCount = 0,
  user,
  onLogout,
}) => {
  const workspaceItems = [
    {
      id: 'overview' as DashboardTab,
      label: 'Overview',
      icon: <BarChart3 className="w-4 h-4" />,
    },
    {
      id: 'emails' as DashboardTab,
      label: 'Emails',
      icon: <Mail className="w-4 h-4" />,
    },
    {
      id: 'scheduled' as DashboardTab,
      label: 'Scheduled',
      icon: <Calendar className="w-4 h-4" />,
      badge: scheduledCount > 0 ? scheduledCount : undefined,
    },
    {
      id: 'sent' as DashboardTab,
      label: 'Sent',
      icon: <Send className="w-4 h-4" />,
      badge: sentCount > 0 ? sentCount : undefined,
    },
  ];

  const manageItems = [
    {
      id: 'settings' as DashboardTab,
      label: 'Settings',
      icon: <Settings className="w-4 h-4" />,
    },
  ];

  const initial = user?.name ? user.name.charAt(0).toUpperCase() : 'U';

  return (
    <aside className="w-60 flex-shrink-0 bg-white border-r border-slate-200/80 flex flex-col justify-between p-4 min-h-screen">
      <div className="space-y-6">
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-2 py-1">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-emerald-100 text-emerald-700 font-bold text-sm">
            R
          </div>
          <span className="font-bold text-base text-slate-900 tracking-tight">ReachInbox</span>
        </div>

        {/* WORKSPACE section */}
        <div className="space-y-1.5">
          <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            WORKSPACE
          </div>
          <nav className="space-y-1">
            {workspaceItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer',
                    isActive
                      ? 'bg-slate-100/90 text-slate-900 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className={isActive ? 'text-emerald-600' : 'text-slate-400'}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>

                  {item.badge !== undefined && (
                    <span
                      className={cn(
                        'px-1.5 py-0.5 rounded text-[10px] font-medium',
                        isActive
                          ? 'bg-slate-200 text-slate-800'
                          : 'bg-slate-100 text-slate-500'
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* MANAGE section */}
        <div className="space-y-1.5">
          <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            MANAGE
          </div>
          <nav className="space-y-1">
            {manageItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer',
                    isActive
                      ? 'bg-slate-100 text-slate-900 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className={isActive ? 'text-emerald-600' : 'text-slate-400'}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Bottom User Card */}
      {user && (
        <div className="pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200/60">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 font-bold text-xs flex-shrink-0">
                {initial}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-900 truncate">
                  {user.name}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {user.email}
                </div>
              </div>
            </div>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
                title="Log out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
