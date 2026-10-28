import { Terminal, CheckCircle, AlertCircle, Info, AlertTriangle, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { timeAgo } from '../utils/formatDate';

const statusIcons = {
  success: CheckCircle,
  error:   AlertCircle,
  info:    Info,
  warning: AlertTriangle,
};

const statusStyles = {
  success: 'text-green-600 bg-green-50 border-green-100',
  error:   'text-red-600 bg-red-50 border-red-100',
  info:    'text-blue-600 bg-blue-50 border-blue-100',
  warning: 'text-orange-600 bg-orange-50 border-orange-100',
};

export default function SystemLogs() {
  const { state, dispatch } = useApp();
  const logs = state.logs;

  const clearLogs = () => dispatch({ type: 'CLEAR_LOGS' });

  return (
    <div className="space-y-4 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-brand-600" />
          <p className="section-title">System Logs</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge bg-slate-100 text-slate-600 border-slate-200">{logs.length} entries</span>
          <button
            onClick={clearLogs}
            className="btn-secondary text-xs py-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>
      </div>

      {/* Log terminal */}
      <div className="card overflow-hidden">
        <div className="bg-slate-800 px-4 py-2 flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
          <span className="text-xs text-slate-400 ml-2 font-mono">safeband-ai — system logs</span>
        </div>

        {logs.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <Terminal className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">No logs yet. Use the simulator or navigate the app to generate events.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
            {logs.map((log) => {
              const Icon = statusIcons[log.status] || Info;
              const style = statusStyles[log.status] || statusStyles.info;
              return (
                <div key={log.id} className={`flex items-start gap-3 px-4 py-2.5 border-l-2 ${style}`}>
                  <Icon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold">{log.type}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{timeAgo(log.timestamp)}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 break-words">{log.message}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Log legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(statusStyles).map(([key, style]) => {
          const Icon = statusIcons[key];
          return (
            <div key={key} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${style}`}>
              <Icon className="w-3 h-3" />
              <span className="capitalize">{key}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
