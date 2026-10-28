import { Link } from 'react-router-dom';
import { Bell, Menu, RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { timeAgo } from '../../utils/formatDate';

export default function Header({ onMenuClick, title, subtitle }) {
  const { state } = useApp();
  const online = state.systemStatus === 'online';
  const offline = state.systemStatus === 'offline';

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:px-7">
      <div className="flex min-h-10 items-center gap-3">
        <button
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold leading-tight text-slate-950">{title}</p>
          {subtitle && <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</p>}
        </div>
        {state.lastUpdated && (
          <span className="hidden items-center gap-1.5 text-xs text-slate-500 md:flex">
            <RefreshCw className="h-3.5 w-3.5" /> Updated {timeAgo(state.lastUpdated)}
          </span>
        )}
        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${online ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : offline ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          <span className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-500' : offline ? 'bg-rose-500' : 'bg-amber-500'}`} />
          API {online ? 'connected' : offline ? 'offline' : 'checking'}
        </span>
        <Link to="/alerts" aria-label="Open emergency alerts" className="relative rounded-lg border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50">
          <Bell className="h-4 w-4" />
          {state.activeAlertCount > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">{state.activeAlertCount > 9 ? '9+' : state.activeAlertCount}</span>}
        </Link>
        <div className="hidden rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 sm:block">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Demo user</p>
          <p className="font-mono text-xs font-semibold text-slate-800">{state.userId}</p>
        </div>
      </div>
    </header>
  );
}
