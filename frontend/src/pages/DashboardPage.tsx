import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { getCurrentUser, logoutUser } from '../api/authApi.js';
import { getMetrics, getSentEmails, getScheduledEmails } from '../api/emailApi.js';
import { Sidebar, DashboardTab } from '../components/dashboard/Sidebar.js';
import { Header } from '../components/dashboard/Header.js';
import { ScheduledTable } from '../components/dashboard/ScheduledTable.js';
import { SentTable } from '../components/dashboard/SentTable.js';
import { ComposeModal } from '../components/dashboard/ComposeModal.js';
import { SendersModal } from '../components/dashboard/SendersModal.js';
import { Button } from '../components/ui/Button.js';
import { formatDate } from '../lib/utils.js';
import type { ScheduledEmail } from '../types/index.js';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sidebarTab, setSidebarTab] = useState<DashboardTab>('overview');
  const [emailTab, setEmailTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isSendersOpen, setIsSendersOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });

  const { data: metrics } = useQuery({
    queryKey: ['metrics'],
    queryFn: getMetrics,
    refetchInterval: 3000,
  });

  const { data: sentData } = useQuery({
    queryKey: ['recentSent'],
    queryFn: () => getSentEmails({ page: 1, limit: 5 }),
    refetchInterval: 3000,
  });

  const { data: scheduledData } = useQuery({
    queryKey: ['recentScheduled'],
    queryFn: () => getScheduledEmails({ page: 1, limit: 4, status: 'scheduled' }),
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
    queryClient.invalidateQueries({ queryKey: ['recentScheduled'] });
    queryClient.invalidateQueries({ queryKey: ['recentSent'] });
    queryClient.invalidateQueries({ queryKey: ['metrics'] });
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
      setSidebarTab(tab);
    }
  };

  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 12
      ? 'Good morning'
      : currentHour < 18
      ? 'Good afternoon'
      : 'Good evening';
  const firstName = user?.name ? user.name.split(' ')[0] : 'User';

  const scheduledCount = metrics?.scheduled ?? 0;
  const sentCount = metrics?.sent ?? 0;
  const failedCount = metrics?.failed ?? 0;
  const processingCount = metrics?.processing ?? 0;
  const totalVolume = scheduledCount + sentCount + failedCount + processingCount;
  const completedPercent =
    totalVolume > 0 ? Math.round((sentCount / totalVolume) * 100) : 100;

  const recentSentList = sentData?.items || [];
  const recentScheduledList = scheduledData?.items || [];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col antialiased">
      <div className="flex-1 flex min-w-0">
        {/* Left Sidebar */}
        <Sidebar
          activeTab={sidebarTab}
          onTabChange={handleSidebarChange}
          scheduledCount={scheduledCount}
          sentCount={sentCount}
          user={user}
          onLogout={handleLogout}
        />

        {/* Right Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Header */}
          <Header
            user={user || null}
            onLogout={handleLogout}
            onOpenSettings={() => setIsSendersOpen(true)}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />

          <main className="flex-1 p-8 max-w-6xl w-full mx-auto space-y-6">
            {sidebarTab === 'overview' ? (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Greeting & Main Action Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                      {greeting}, {firstName}.
                    </h1>
                    <p className="text-xs text-slate-500 mt-1 font-medium">
                      Here's your email activity for today.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsComposeOpen(true)}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#059669] hover:bg-[#047857] text-white font-medium text-xs shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Compose Email</span>
                  </button>
                </div>

                {/* 4 Stat Cards Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Card 1: Scheduled */}
                  <div className="bg-white border border-slate-200/80 rounded-xl p-4 space-y-2 shadow-2xs">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      SCHEDULED
                    </div>
                    <div className="text-3xl font-extrabold text-blue-600 tracking-tight">
                      {scheduledCount}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      +{scheduledCount} today
                    </div>
                  </div>

                  {/* Card 2: Sent Outreach */}
                  <div className="bg-white border border-slate-200/80 rounded-xl p-4 space-y-2 shadow-2xs">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      SENT OUTREACH
                    </div>
                    <div className="text-3xl font-extrabold text-emerald-600 tracking-tight">
                      {sentCount}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      +{sentCount} today
                    </div>
                  </div>

                  {/* Card 3: Success Rate */}
                  <div className="bg-white border border-slate-200/80 rounded-xl p-4 space-y-2 shadow-2xs">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      SUCCESS RATE
                    </div>
                    <div className="text-3xl font-extrabold text-emerald-600 tracking-tight">
                      {metrics?.deliveryRate ?? 100}%
                    </div>
                    <div className="text-[11px] text-emerald-600 font-medium flex items-center gap-0.5">
                      <ArrowUpRight className="w-3 h-3" />
                      <span>2.1% this week</span>
                    </div>
                  </div>

                  {/* Card 4: Failed Deliveries */}
                  <div className="bg-white border border-slate-200/80 rounded-xl p-4 space-y-2 shadow-2xs">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      FAILED DELIVERIES
                    </div>
                    <div className="text-3xl font-extrabold text-rose-600 tracking-tight">
                      {failedCount}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      -{failedCount} today
                    </div>
                  </div>
                </div>

                {/* Bottom Two-Column Section: Activity Log (2/3) + Overview/Queue (1/3) */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Sending Activity Log */}
                  <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-xl p-5 shadow-2xs space-y-4">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      SENDING ACTIVITY LOG
                    </div>

                    {recentSentList.length === 0 ? (
                      <div className="py-12 text-center">
                        <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-xs text-slate-500 font-medium">
                          No sending activity recorded yet.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4 pt-1">
                        {recentSentList.map((item: ScheduledEmail, index: number) => {
                          const isLast = index === recentSentList.length - 1;
                          const timeStr = item.sentAt
                            ? new Date(item.sentAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })
                            : 'Just now';

                          return (
                            <div key={item.id} className="relative flex items-start gap-3">
                              {/* Timeline indicator */}
                              <div className="flex flex-col items-center flex-shrink-0 pt-0.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-50" />
                                {!isLast && (
                                  <span className="w-px h-10 bg-slate-200 my-1" />
                                )}
                              </div>

                              {/* Log details */}
                              <div className="min-w-0 flex-1">
                                <div className="text-[11px] text-slate-400 font-medium">
                                  &bull; {timeStr}
                                </div>
                                <div className="text-xs font-semibold text-slate-900 mt-0.5 truncate">
                                  Email sent <span className="text-slate-700 font-normal">{item.recipient}</span>
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  1 email &bull; {item.subject}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Email Overview & Upcoming Queue */}
                  <div className="space-y-6">
                    {/* Top Right Card: Email Overview */}
                    <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-2xs space-y-3.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        EMAIL OVERVIEW
                      </div>

                      <div className="space-y-2.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600 font-medium">Scheduled</span>
                          <span className="font-bold text-blue-600">{scheduledCount}</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-600 font-medium">Sending / Active</span>
                          <span className="font-bold text-amber-600">{processingCount}</span>
                        </div>

                        <div className="space-y-1 pt-1">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-700 font-semibold">Completed / Sent</span>
                            <span className="font-bold text-emerald-600">{sentCount}</span>
                          </div>
                          {/* Progress bar */}
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, Math.max(completedPercent, sentCount > 0 ? 100 : 0))}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-slate-600 font-medium">Failed / Bounced</span>
                          <span className="font-bold text-rose-600">{failedCount}</span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Right Card: Upcoming Queue */}
                    <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-2xs space-y-3">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        UPCOMING QUEUE
                      </div>

                      {recentScheduledList.length === 0 ? (
                        <p className="text-xs text-slate-400 py-3 font-medium">
                          Nothing queued yet.
                        </p>
                      ) : (
                        <div className="space-y-2.5">
                          {recentScheduledList.map((item: ScheduledEmail) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 border border-slate-200/60"
                            >
                              <div className="min-w-0 pr-2">
                                <p className="font-medium text-slate-900 truncate">
                                  {item.recipient}
                                </p>
                                <p className="text-[10px] text-slate-400 truncate">
                                  {item.subject}
                                </p>
                              </div>
                              <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded font-mono whitespace-nowrap">
                                {formatDate(item.scheduledAt)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Dedicated Emails / Scheduled / Sent Management View */
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
                  <div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-900">
                      {sidebarTab === 'scheduled'
                        ? 'Scheduled Emails'
                        : sidebarTab === 'sent'
                        ? 'Sent History'
                        : 'Emails'}
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Manage your scheduled and sent outreach campaigns.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="inline-flex rounded-lg bg-slate-100 p-1 text-xs">
                      <button
                        onClick={() => setEmailTab('scheduled')}
                        className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                          emailTab === 'scheduled'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Scheduled ({scheduledCount})
                      </button>
                      <button
                        onClick={() => setEmailTab('sent')}
                        className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                          emailTab === 'sent'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Sent ({sentCount})
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

                {emailTab === 'scheduled' ? (
                  <ScheduledTable onOpenCompose={() => setIsComposeOpen(true)} />
                ) : (
                  <SentTable onOpenCompose={() => setIsComposeOpen(true)} />
                )}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Compose Email Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={handleComposeSuccess}
      />

      {/* Settings / Mailboxes Modal */}
      <SendersModal
        isOpen={isSendersOpen}
        onClose={() => setIsSendersOpen(false)}
      />
    </div>
  );
};
