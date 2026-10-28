import { useState, useMemo } from 'react';
import { Search, Filter, ChevronDown, ChevronUp, Eye, CheckCircle, CheckSquare } from 'lucide-react';
import { getSeverityColors, getStatusColors } from '../../utils/riskHelpers';
import { formatTableDate, timeAgo } from '../../utils/formatDate';
import EmptyState from '../ui/EmptyState';
import LoadingState from '../ui/LoadingState';

const PAGE_SIZE = 10;

export default function NotificationTable({ notifications, loading, onAcknowledge, onResolve, actionLoading }) {
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);

  const filtered = useMemo(() => {
    let items = [...(notifications || [])];
    if (search) {
      items = items.filter(
        (n) =>
          (n.user_id || '').toLowerCase().includes(search.toLowerCase()) ||
          (n.message || '').toLowerCase().includes(search.toLowerCase())
      );
    }
    if (severityFilter !== 'all') {
      items = items.filter((n) => (n.severity || '').toLowerCase() === severityFilter);
    }
    if (statusFilter !== 'all') {
      items = items.filter((n) => (n.status || '').toLowerCase() === statusFilter);
    }
    items.sort((a, b) => {
      const da = new Date(a.created_at || 0).getTime();
      const db = new Date(b.created_at || 0).getTime();
      return sortDir === 'desc' ? db - da : da - db;
    });
    return items;
  }, [notifications, search, severityFilter, statusFilter, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selected = filtered.find((n) => n.id === selectedId);

  if (loading) return <LoadingState message="Loading notifications…" />;

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search user ID or message…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="input-field pl-8 text-xs"
          />
        </div>
        <select value={severityFilter} onChange={(e) => { setSeverityFilter(e.target.value); setPage(1); }}
          className="select-field text-xs w-28">
          <option value="all">All Severity</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="select-field text-xs w-28">
          <option value="all">All Status</option>
          <option value="simulated">Simulated</option>
          <option value="sent">Sent</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="resolved">Resolved</option>
          <option value="failed">Failed</option>
        </select>
        <button
          onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
          className="btn-secondary text-xs"
        >
          {sortDir === 'desc' ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          {sortDir === 'desc' ? 'Newest' : 'Oldest'}
        </button>
        <span className="text-xs text-slate-400 ml-auto">{filtered.length} records</span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState message={notifications.length === 0
          ? 'No emergency notification records have been saved for this user yet. A possible fall result is not saved as an alert until the backend confirms it.'
          : 'No notifications match your current search and filters.'} />
      ) : (
        <>
          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left">
                  {['ID', 'User ID', 'Message', 'Severity', 'Risk', 'Recipient', 'Created At', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="px-3 py-2.5 font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginated.map((n) => {
                  const sColors = getSeverityColors((n.severity || 'low').toLowerCase());
                  const sCls = getStatusColors(n.status);
                  const isResolved = n.status === 'resolved';
                  const isAck = n.status === 'acknowledged';
                  const isLoadingRow = actionLoading === n.id;

                  return (
                    <tr key={n.id}
                      className={`hover:bg-slate-50 cursor-pointer transition-colors ${selectedId === n.id ? 'bg-brand-50' : ''}`}
                      onClick={() => setSelectedId(selectedId === n.id ? null : n.id)}
                    >
                      <td className="px-3 py-2.5 font-mono text-slate-400">#{n.id}</td>
                      <td className="px-3 py-2.5 font-medium text-slate-700 whitespace-nowrap">{n.user_id}</td>
                      <td className="px-3 py-2.5 text-slate-600 max-w-[200px]">
                        <span className="line-clamp-2">{n.message}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`badge capitalize ${sColors.badge}`}>{n.severity}</span>
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-slate-700">{n.risk_score ?? '—'}</td>
                      <td className="px-3 py-2.5 text-slate-500">{n.recipient}</td>
                      <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{formatTableDate(n.created_at)}</td>
                      <td className="px-3 py-2.5">
                        <span className={`badge capitalize ${sCls}`}>{n.status}</span>
                      </td>
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {!isAck && !isResolved && (
                            <button
                              onClick={() => onAcknowledge?.(n.id)}
                              disabled={isLoadingRow}
                              className="p-1 rounded text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                              title="Acknowledge"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {!isResolved && (
                            <button
                              onClick={() => onResolve?.(n.id)}
                              disabled={isLoadingRow}
                              className="p-1 rounded text-slate-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                              title="Resolve"
                            >
                              <CheckSquare className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Detail panel */}
          {selected && (
            <div className="mt-3 p-4 rounded-xl border border-brand-200 bg-brand-50 text-xs fade-in">
              <p className="font-semibold text-slate-700 mb-2">Alert Detail — #{selected.id}</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {Object.entries({
                  'User ID': selected.user_id,
                  'Type': selected.notification_type,
                  'Recipient': selected.recipient,
                  'Severity': selected.severity,
                  'Risk Score': selected.risk_score,
                  'Status': selected.status,
                  'Created': formatTableDate(selected.created_at),
                  'Location': selected.location_available ? 'Available' : 'None',
                }).map(([k, v]) => (
                  <div key={k}>
                    <p className="text-slate-400">{k}</p>
                    <p className="font-semibold text-slate-700">{String(v ?? '—')}</p>
                  </div>
                ))}
              </div>
              {selected.message && (
                <div className="mt-2">
                  <p className="text-slate-400">Message</p>
                  <p className="text-slate-700 mt-0.5">{selected.message}</p>
                </div>
              )}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-xs disabled:opacity-40">
                Previous
              </button>
              <span className="text-xs text-slate-500">Page {page} / {totalPages}</span>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="btn-secondary text-xs disabled:opacity-40">
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
