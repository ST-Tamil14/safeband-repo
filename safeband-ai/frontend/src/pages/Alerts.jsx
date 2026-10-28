import { AlertTriangle, Bell, RefreshCw, Info } from 'lucide-react';
import AlertCard from '../components/alerts/AlertCard';
import EmergencyBanner from '../components/alerts/EmergencyBanner';
import LoadingState from '../components/ui/LoadingState';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import { useNotifications } from '../hooks/useNotifications';

export default function Alerts() {
  const { notifications, loading, error, actionLoading, acknowledge, resolve, refetch } = useNotifications(5000);

  const active = notifications.filter((n) => n.status !== 'resolved' && n.status !== 'acknowledged');
  const acknowledged = notifications.filter((n) => n.status === 'acknowledged');
  const resolved = notifications.filter((n) => n.status === 'resolved');

  if (loading) return <LoadingState message="Loading emergency alerts…" />;
  if (error) return <div className="card"><ErrorState message={error} onRetry={refetch} /></div>;

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-700" />
        <p><strong>What appears here:</strong> saved emergency notifications that still need action. A model’s “possible fall” result is not an alert until the backend confirms it and records a notification.</p>
      </div>
      {/* Emergency banner */}
      {active.length > 0 && <EmergencyBanner count={active.length} />}

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Active Alerts', count: active.length, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
          { label: 'Acknowledged', count: acknowledged.length, color: 'text-cyan-600', bg: 'bg-cyan-50 border-cyan-200' },
          { label: 'Resolved', count: resolved.length, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
        ].map(({ label, count, color, bg }) => (
          <div key={label} className={`card p-3 border ${bg}`}>
            <p className="text-xs text-slate-500">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{count}</p>
          </div>
        ))}
      </div>

      {/* Active alerts */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <p className="section-title text-red-600">Active Alerts</p>
          </div>
          <button onClick={refetch} className="btn-secondary text-xs py-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
        {active.length === 0 ? (
          <div className="card">
            <EmptyState message="No unresolved emergency notifications are recorded for this user. This does not prove that a person is safe; check the live sensor result above and confirm the data feed is running." icon={Bell} />
          </div>
        ) : (
          <div className="space-y-3">
            {active.map((n) => (
              <AlertCard
                key={n.id}
                notification={n}
                onAcknowledge={acknowledge}
                onResolve={resolve}
                actionLoading={actionLoading}
              />
            ))}
          </div>
        )}
      </div>

      {/* Acknowledged alerts */}
      {acknowledged.length > 0 && (
        <div>
          <p className="section-title text-cyan-600 mb-3">Acknowledged</p>
          <div className="space-y-2">
            {acknowledged.map((n) => (
              <AlertCard
                key={n.id}
                notification={n}
                onResolve={resolve}
                actionLoading={actionLoading}
              />
            ))}
          </div>
        </div>
      )}

      {/* Resolved alerts */}
      {resolved.length > 0 && (
        <div>
          <p className="section-title text-slate-500 mb-3">Resolved</p>
          <div className="space-y-2 opacity-70">
            {resolved.slice(0, 5).map((n) => (
              <AlertCard key={n.id} notification={n} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
