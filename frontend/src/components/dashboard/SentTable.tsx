import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, RefreshCw, ExternalLink, CheckCircle2 } from 'lucide-react';
import { getSentEmails } from '../../api/emailApi.js';
import { StatusBadge } from '../ui/StatusBadge.js';
import { Pagination } from '../ui/Pagination.js';
import { Skeleton } from '../ui/Skeleton.js';
import { EmptyState } from '../ui/EmptyState.js';
import { formatDate } from '../../lib/utils.js';
import type { ScheduledEmail } from '../../types/index.js';

export interface SentTableProps {
  onOpenCompose: () => void;
}

export const SentTable: React.FC<SentTableProps> = ({ onOpenCompose }) => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['sentEmails', page, search, statusFilter],
    queryFn: () =>
      getSentEmails({
        page,
        limit: 10,
        search: search || undefined,
        status: statusFilter || undefined,
      }),
    refetchInterval: 3000,
  });

  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  return (
    <div className="space-y-3">
      {/* Controls: Search, Filter, Refresh */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search sent emails..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6D4AFF]/20 focus:border-[#6D4AFF]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center rounded-lg bg-slate-100 p-0.5 text-xs">
            <button
              onClick={() => {
                setStatusFilter('');
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                statusFilter === ''
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Sent
            </button>
            <button
              onClick={() => {
                setStatusFilter('sent');
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                statusFilter === 'sent'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Delivered
            </button>
            <button
              onClick={() => {
                setStatusFilter('failed');
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                statusFilter === 'failed'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Failed
            </button>
          </div>

          <button
            type="button"
            onClick={() => refetch()}
            className="p-1.5 rounded-lg bg-white border border-slate-300 text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
            title="Refresh logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-[#6D4AFF]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Sent Table Container */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-5 space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="No sent emails yet"
            description="Emails you successfully send will appear here."
            actionLabel="Compose Email"
            onAction={onOpenCompose}
            icon={<CheckCircle2 className="w-5 h-5 text-slate-400" />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 px-4">Recipient</th>
                  <th className="py-2.5 px-4">Subject</th>
                  <th className="py-2.5 px-4">Sent</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Preview</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((email: ScheduledEmail) => (
                  <tr
                    key={email.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-medium text-slate-900">
                      <span className="truncate max-w-[200px] block">{email.recipient}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-700 max-w-[240px] truncate">
                      {email.subject}
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {formatDate(email.sentAt || email.updatedAt)}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={email.status} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      {email.previewUrl ? (
                        <a
                          href={email.previewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-[#6D4AFF] hover:underline font-medium"
                        >
                          <span>View email</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : email.status === 'failed' ? (
                        <span
                          className="text-xs text-rose-600 truncate max-w-[150px] inline-block"
                          title={email.lastError || 'Delivery failed'}
                        >
                          {email.lastError || 'Failed'}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={10}
          onPageChange={(p) => setPage(p)}
        />
      </div>
    </div>
  );
};
