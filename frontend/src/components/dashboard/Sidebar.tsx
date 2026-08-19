import React from 'react';
import { Mail, Clock, CheckCircle2, Settings } from 'lucide-react';
import { cn } from '../../lib/utils.js';

export type DashboardTab = 'emails' | 'scheduled' | 'sent' | 'settings';

export interface SidebarProps {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  scheduledCount?: number;
  sentCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  scheduledCount = 0,
  sentCount = 0,
}) => {
  const navItems = [
    {
      id: 'emails' as DashboardTab,
      label: 'All Emails',
      icon: <Mail className="w-4 h-4" />,
    },
    {
      id: 'scheduled' as DashboardTab,
      label: 'Scheduled',
      icon: <Clock className="w-4 h-4" />,
      badge: scheduledCount > 0 ? scheduledCount : undefined,
    },
    {
      id: 'sent' as DashboardTab,
      label: 'Sent',
      icon: <CheckCircle2 className="w-4 h-4" />,
      badge: sentCount > 0 ? sentCount : undefined,
    },
    {
      id: 'settings' as DashboardTab,
      label: 'Settings',
      icon: <Settings className="w-4 h-4" />,
    },
  ];

  return (
    <aside className="w-56 flex-shrink-0 bg-[#F8FAFC] border-r border-slate-200 flex flex-col justify-between p-3 min-h-[calc(100vh-57px)]">
      <div className="space-y-1">
        <nav className="space-y-0.5">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer',
                  isActive
                    ? 'bg-slate-200/70 text-slate-900 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <span className={isActive ? 'text-[#6D4AFF]' : 'text-slate-400'}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>

                {item.badge !== undefined && (
                  <span
                    className={cn(
                      'px-1.5 py-0.5 rounded text-[10px] font-medium',
                      isActive
                        ? 'bg-[#6D4AFF] text-white'
                        : 'bg-slate-200 text-slate-600'
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
    </aside>
  );
};
