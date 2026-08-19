import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { getCurrentUser, logoutUser } from '../api/authApi.js';
import { getMetrics } from '../api/emailApi.js';
import { Sidebar, DashboardTab } from '../components/dashboard/Sidebar.js';
import { Header } from '../components/dashboard/Header.js';
import { ScheduledTable } from '../components/dashboard/ScheduledTable.js';
import { SentTable } from '../components/dashboard/SentTable.js';
import { ComposeModal } from '../components/dashboard/ComposeModal.js';
import { SendersModal } from '../components/dashboard/SendersModal.js';
import { Button } from '../components/ui/Button.js';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sidebarTab, setSidebarTab] = useState<DashboardTab>('emails');
  const [emailTab, setEmailTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isSendersOpen, setIsSendersOpen] = useState(false);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });

  const { data: metrics } = useQuery({
    queryKey: ['metrics'],
    queryFn: getMetrics,
    refetchInterval: 3000,
  });

  const handleLogout = async () => {
    try {
      await logoutUser();
      queryClient.clear();
      toast.success('Logged out successfully');
      navigate('/login');
    } catch {
      navigate('/login');
    }
  };

  const handleComposeSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['scheduledEmails'] });
    queryClient.invalidateQueries({ queryKey: ['metrics'] });
    setEmailTab('scheduled');
    setSidebarTab('scheduled');
  };

  const handleSidebarChange = (tab: DashboardTab) => {
    if (tab === 'settings') {
      setIsSendersOpen(true);
    } else if (tab === 'scheduled') {
      setSidebarTab('scheduled');
      setEmailTab('scheduled');
    } else if (tab === 'sent') {
      setSidebarTab('sent');
      setEmailTab('sent');
    } else {
      setSidebarTab('emails');
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      {/* Top Header */}
      <Header
        user={user || null}
        onLogout={handleLogout}
        onOpenSettings={() => setIsSendersOpen(true)}
      />

      {/* Main App Body with Sidebar */}
      <div className="flex-1 flex min-w-0">
        {/* Minimal Sidebar */}
        <Sidebar
          activeTab={sidebarTab}
          onTabChange={handleSidebarChange}
          scheduledCount={metrics?.scheduled}
          sentCount={metrics?.sent}
        />

        {/* Content Area */}
        <main className="flex-1 p-6 max-w-6xl w-full mx-auto space-y-6">
          {/* Page Heading & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">Emails</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage your scheduled and sent emails.
              </p>
            </div>

            {/* Email Tabs and Compose Action */}
            <div className="flex items-center gap-3">
              {/* Tab Selector */}
              <div className="inline-flex rounded-lg bg-slate-100 p-1 text-xs">
                <button
                  onClick={() => {
                    setEmailTab('scheduled');
                    setSidebarTab('scheduled');
                  }}
                  className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    emailTab === 'scheduled'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Scheduled
                  {metrics?.scheduled !== undefined && metrics.scheduled > 0 && (
                    <span className="ml-1.5 text-[10px] text-slate-500 font-normal">
                      ({metrics.scheduled})
                    </span>
                  )}
                </button>
                <button
                  onClick={() => {
                    setEmailTab('sent');
                    setSidebarTab('sent');
                  }}
                  className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    emailTab === 'sent'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sent
                  {metrics?.sent !== undefined && metrics.sent > 0 && (
                    <span className="ml-1.5 text-[10px] text-slate-500 font-normal">
                      ({metrics.sent})
                    </span>
                  )}
                </button>
              </div>

              <Button
                onClick={() => setIsComposeOpen(true)}
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
              >
                New Email
              </Button>
            </div>
          </div>

          {/* Tab View */}
          {emailTab === 'scheduled' ? (
            <ScheduledTable onOpenCompose={() => setIsComposeOpen(true)} />
          ) : (
            <SentTable onOpenCompose={() => setIsComposeOpen(true)} />
          )}
        </main>
      </div>

      {/* Compose Email Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={handleComposeSuccess}
      />

      {/* Senders / Settings Modal */}
      <SendersModal
        isOpen={isSendersOpen}
        onClose={() => setIsSendersOpen(false)}
      />
    </div>
  );
};
