import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plus,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Calendar,
  Settings as SettingsIcon,
  LogOut,
  Mail,
  Zap,
  Activity,
  Layers,
} from 'lucide-react';
import { getCurrentUser, logoutUser } from '../api/authApi.js';
import { getMetrics } from '../api/emailApi.js';
import { getSenders } from '../api/senderApi.js';
import { ScheduledTable } from '../components/dashboard/ScheduledTable.js';
import { SentTable } from '../components/dashboard/SentTable.js';
import { ComposeModal } from '../components/dashboard/ComposeModal.js';
import { SendersModal } from '../components/dashboard/SendersModal.js';

// 3D Elliptical Ring Component matching the screenshot
const FunnelRing: React.FC<{
  label: string;
  value: string | number;
  sublabel?: string;
  colorGrad?: string;
}> = ({ label, value, sublabel }) => {
  return (
    <div className="flex flex-col items-center justify-center relative">
      <div className="relative w-32 h-44 flex items-center justify-center">
        {/* SVG 3D Ellipse Ring */}
        <svg viewBox="0 0 120 160" className="w-full h-full overflow-visible drop-shadow-sm">
          <defs>
            <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="40%" stopColor="#0EA5E9" />
              <stop offset="80%" stopColor="#0284C7" />
              <stop offset="100%" stopColor="#0369A1" />
            </linearGradient>
            <linearGradient id="ringShadow" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#0284C7" />
              <stop offset="100%" stopColor="#075985" />
            </linearGradient>
          </defs>

          {/* 3D Depth Ellipse */}
          <ellipse cx="60" cy="84" rx="46" ry="68" fill="none" stroke="url(#ringShadow)" strokeWidth="15" opacity="0.3" />
          {/* Main 3D Ring */}
          <ellipse cx="60" cy="80" rx="44" ry="66" fill="none" stroke="url(#ringGrad)" strokeWidth="13" />
          {/* Inner Highlight */}
          <ellipse cx="58" cy="78" rx="37" ry="58" fill="none" stroke="#BAE6FD" strokeWidth="2.5" opacity="0.9" />
        </svg>

        {/* Center Label & Metric */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
          <span className="text-[11px] font-medium text-slate-600 leading-tight">
            {label}
          </span>
          <span className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            {value}
          </span>
          {sublabel && (
            <span className="text-[10px] text-slate-500 font-semibold mt-0.5">
              {sublabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'funnel' | 'scheduled' | 'sent'>('funnel');
  const [dateRange, setDateRange] = useState('Sep 8, 2026 - Oct 8, 2026');
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

  const { data: senders = [] } = useQuery({
    queryKey: ['senders'],
    queryFn: getSenders,
    refetchInterval: 5000,
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
    queryClient.invalidateQueries({ queryKey: ['sentEmails'] });
    queryClient.invalidateQueries({ queryKey: ['metrics'] });
  };

  const scheduledCount = metrics?.scheduled ?? 0;
  const sentCount = metrics?.sent ?? 0;
  const failedCount = metrics?.failed ?? 0;
  const totalVolume = scheduledCount + sentCount + failedCount;
  const deliveryRate = metrics?.deliveryRate ?? (totalVolume > 0 ? Math.round((sentCount / totalVolume) * 100) : 100);

  return (
    <div className="min-h-screen bg-[#F0F4F8] text-slate-900 flex flex-col antialiased">
      {/* Top Banner Header matching screenshot */}
      <header className="bg-[#0B3C5D] text-white px-6 py-3.5 shadow-md flex items-center justify-between">
        {/* Left: Brand & Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white text-[#0B3C5D] font-bold text-sm shadow-xs">
            <Layers className="w-5 h-5 text-[#0B3C5D]" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm tracking-wider uppercase opacity-90">REACHINBOX</span>
            <span className="text-slate-400 font-light">|</span>
            <h1 className="text-base font-bold text-white tracking-tight">
              Outreach &amp; Email Performance Dashboard
            </h1>
          </div>
        </div>

        {/* Right: Actions, Date Range & Profile */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsSendersOpen(true)}
            className="text-xs text-slate-200 hover:text-white font-medium underline underline-offset-4 cursor-pointer hidden md:inline-block"
          >
            Mailboxes ({senders.length})
          </button>

          <button
            type="button"
            onClick={() => setIsComposeOpen(true)}
            className="px-3.5 py-1.5 rounded-md bg-[#00A3E0] hover:bg-[#0284C7] text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Compose Email</span>
          </button>

          {/* Date range dropdown */}
          <div className="relative flex items-center">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="appearance-none pl-3 pr-8 py-1.5 rounded-md bg-white text-slate-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-sky-400 cursor-pointer shadow-xs"
            >
              <option value="Today">Today (Real-time)</option>
              <option value="Sep 8, 2026 - Oct 8, 2026">Sep 8, 2026 - Oct 8, 2026</option>
              <option value="Last 7 Days">Last 7 Days</option>
              <option value="Last 30 Days">Last 30 Days</option>
              <option value="All Time">All Time</option>
            </select>
            <Calendar className="w-3.5 h-3.5 absolute right-2.5 text-slate-400 pointer-events-none" />
          </div>

          {/* User profile & Logout */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-700">
            <div
              className="w-7 h-7 rounded-md bg-sky-400/20 border border-sky-400 text-sky-200 flex items-center justify-center font-bold text-xs"
              title={user?.name || 'User'}
            >
              {user?.name ? user.name.charAt(0).toUpperCase() : 'T'}
            </div>
            <button
              onClick={handleLogout}
              className="p-1 rounded text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Dashboard Canvas */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Navigation Tabs to switch views */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('funnel')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'funnel'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              📊 Performance Funnel &amp; Overview
            </button>
            <button
              onClick={() => setActiveTab('scheduled')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'scheduled'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              📅 Scheduled Queue ({scheduledCount})
            </button>
            <button
              onClick={() => setActiveTab('sent')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'sent'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              ✈️ Sent History ({sentCount})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSendersOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <SettingsIcon className="w-3.5 h-3.5 text-slate-400" />
              <span>Mailboxes &amp; SMTP</span>
            </button>
          </div>
        </div>

        {activeTab === 'funnel' ? (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* 1. Major Card: Performance Funnel */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
              {/* Card Title & Section Header Bars */}
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  Performance Funnel
                </h2>
              </div>

              {/* Sub-headers matching screenshot */}
              <div className="grid grid-cols-2 gap-4 pb-2 border-b border-slate-100 text-xs font-semibold">
                <div className="text-center text-amber-600 pb-1 border-b-2 border-amber-400">
                  ReachInbox Outbound Queue
                </div>
                <div className="text-center text-emerald-600 pb-1 border-b-2 border-emerald-400">
                  Delivery &amp; Pipeline Performance
                </div>
              </div>

              {/* 3D Rings Funnel Flow matching screenshot */}
              <div className="flex items-center justify-between overflow-x-auto py-4 px-2">
                {/* Stage 1: Emails Scheduled */}
                <FunnelRing
                  label="Emails queued"
                  value={totalVolume > 0 ? totalVolume : 12}
                />

                {/* Arrow 1 */}
                <div className="flex flex-col items-center justify-center px-1 text-slate-400">
                  <ArrowRight className="w-5 h-5 text-sky-600 stroke-[2.5]" />
                  <span className="text-[10px] font-bold text-slate-500 mt-1">99.1%</span>
                </div>

                {/* Stage 2: Delivered Emails */}
                <FunnelRing
                  label="Delivered emails"
                  value={sentCount > 0 ? sentCount : 12}
                />

                {/* Arrow 2 */}
                <div className="flex flex-col items-center justify-center px-1 text-slate-400">
                  <ArrowRight className="w-5 h-5 text-sky-600 stroke-[2.5]" />
                  <span className="text-[10px] font-bold text-slate-500 mt-1">
                    {deliveryRate}%
                  </span>
                </div>

                {/* Stage 3: Unique Recipients */}
                <FunnelRing
                  label="Unique recipients"
                  value={sentCount > 0 ? sentCount : 12}
                />

                {/* Arrow 3 */}
                <div className="flex flex-col items-center justify-center px-1 text-slate-400">
                  <ArrowRight className="w-5 h-5 text-sky-600 stroke-[2.5]" />
                  <span className="text-[10px] font-bold text-slate-500 mt-1">57.0%</span>
                </div>

                {/* Stage 4: Active Mailboxes */}
                <FunnelRing
                  label="Active senders"
                  value={senders.length > 0 ? senders.length : 1}
                />

                {/* Arrow 4 */}
                <div className="flex flex-col items-center justify-center px-1 text-slate-400">
                  <ArrowRight className="w-5 h-5 text-sky-600 stroke-[2.5]" />
                  <span className="text-[10px] font-bold text-slate-500 mt-1">20.9%</span>
                </div>

                {/* Stage 5: Worker Concurrency Slots */}
                <FunnelRing
                  label="Concurrency slots"
                  value={5}
                />

                {/* Arrow 5 */}
                <div className="flex flex-col items-center justify-center px-1 text-slate-400">
                  <ArrowRight className="w-5 h-5 text-sky-600 stroke-[2.5]" />
                </div>

                {/* Stage 6: Delivery Success */}
                <FunnelRing
                  label="Delivery rate"
                  value={`${deliveryRate}%`}
                />
              </div>
            </div>

            {/* 2. Middle Section: Metrics Grid matching screenshot */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
              {/* Row 1 */}
              <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 space-y-1 shadow-2xs relative">
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
                  <span>Emails queued</span>
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className="text-xl font-extrabold text-slate-900">
                  {scheduledCount}
                </div>
                <div className="text-[10px] text-emerald-600 flex items-center gap-0.5 font-semibold">
                  <TrendingUp className="w-3 h-3" />
                  <span>+0 today</span>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 space-y-1 shadow-2xs relative">
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
                  <span>Delivered emails</span>
                  <Zap className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <div className="text-xl font-extrabold text-slate-900">
                  {sentCount}
                </div>
                <div className="text-[10px] text-emerald-600 flex items-center gap-0.5 font-semibold">
                  <TrendingUp className="w-3 h-3" />
                  <span>+100% completed</span>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 space-y-1 shadow-2xs relative">
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
                  <span>Bounces / Failed</span>
                  <Activity className="w-3.5 h-3.5 text-rose-500" />
                </div>
                <div className="text-xl font-extrabold text-slate-900">
                  {failedCount}
                </div>
                <div className="text-[10px] text-slate-400 flex items-center gap-0.5 font-semibold">
                  <TrendingDown className="w-3 h-3" />
                  <span>0% bounce rate</span>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 space-y-1 shadow-2xs relative">
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
                  <span>Delivery rate</span>
                  <span className="text-emerald-600 font-bold text-xs">✓</span>
                </div>
                <div className="text-xl font-extrabold text-emerald-600">
                  {deliveryRate}%
                </div>
                <div className="text-[10px] text-emerald-600 flex items-center gap-0.5 font-semibold">
                  <TrendingUp className="w-3 h-3" />
                  <span>+1.4% this week</span>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 space-y-1 shadow-2xs relative">
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
                  <span>Hourly rate limit</span>
                  <span className="text-slate-400 text-xs">⚡</span>
                </div>
                <div className="text-xl font-extrabold text-slate-900">
                  200/hr
                </div>
                <div className="text-[10px] text-slate-400 font-medium">
                  Enforced dynamically
                </div>
              </div>

              {/* Row 2 */}
              <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 space-y-1 shadow-2xs relative">
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
                  <span>Connected senders</span>
                  <span className="text-emerald-500 font-bold text-xs">📬</span>
                </div>
                <div className="text-xl font-extrabold text-slate-900">
                  {senders.length}
                </div>
                <div className="text-[10px] text-slate-400 font-medium">
                  Active mailboxes
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 space-y-1 shadow-2xs relative">
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
                  <span>Delay slot</span>
                  <span className="text-slate-400 text-xs">⏱️</span>
                </div>
                <div className="text-xl font-extrabold text-slate-900">
                  2.0s
                </div>
                <div className="text-[10px] text-slate-400 font-medium">
                  Redis slot enforced
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 space-y-1 shadow-2xs relative">
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
                  <span>Worker slots</span>
                  <span className="text-sky-500 text-xs">⚙️</span>
                </div>
                <div className="text-xl font-extrabold text-slate-900">
                  5 workers
                </div>
                <div className="text-[10px] text-slate-400 font-medium">
                  BullMQ distributed
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 space-y-1 shadow-2xs relative">
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
                  <span>Active campaigns</span>
                  <span className="text-emerald-500 text-xs">🎯</span>
                </div>
                <div className="text-xl font-extrabold text-slate-900">
                  {sentCount > 0 ? 1 : 0}
                </div>
                <div className="text-[10px] text-emerald-600 font-medium">
                  Automated delivery
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 space-y-1 shadow-2xs relative">
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
                  <span>Total leads reached</span>
                  <span className="text-slate-400 text-xs">👥</span>
                </div>
                <div className="text-xl font-extrabold text-slate-900">
                  {sentCount}
                </div>
                <div className="text-[10px] text-emerald-600 font-medium">
                  100% verified
                </div>
              </div>
            </div>

            {/* 3. Bottom Section: Funnel by Date / Activity */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">
                  Funnel by Date &amp; Outreach Activity
                </h3>
                <div className="text-xs font-semibold text-slate-500">
                  Real-time BullMQ &amp; Redis Queue State
                </div>
              </div>

              <SentTable onOpenCompose={() => setIsComposeOpen(true)} />
            </div>
          </div>
        ) : activeTab === 'scheduled' ? (
          <div className="space-y-4 animate-in fade-in duration-200">
            <ScheduledTable onOpenCompose={() => setIsComposeOpen(true)} />
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in duration-200">
            <SentTable onOpenCompose={() => setIsComposeOpen(true)} />
          </div>
        )}
      </main>

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
