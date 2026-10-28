import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Activity, AlertTriangle, Bell,
  Play, Users, Terminal, Shield, X
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

const navItems = [
  { to: '/',               label: 'Dashboard',          icon: LayoutDashboard },
  { to: '/monitoring',     label: 'Live Monitoring',     icon: Activity },
  { to: '/alerts',         label: 'Emergency Alerts',    icon: AlertTriangle },
  { to: '/notifications',  label: 'Notification History',icon: Bell },
  { to: '/simulator',      label: 'Sensor Simulator',    icon: Play },
  { to: '/users',          label: 'Users & Devices',     icon: Users },
  { to: '/logs',           label: 'System Logs',         icon: Terminal },
];

export default function Sidebar({ open, onClose }) {
  const { state } = useApp();
  const statusColor =
    state.systemStatus === 'online' ? 'bg-green-500' :
    state.systemStatus === 'offline' ? 'bg-red-500' :
    'bg-yellow-400';

  const statusLabel =
    state.systemStatus === 'online' ? 'System Online' :
    state.systemStatus === 'offline' ? 'System Offline' :
    'Connecting…';

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-64 bg-white border-r border-slate-200 z-30
          flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:z-auto
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 leading-tight">SafeBand AI</p>
              <p className="text-[10px] text-slate-400 leading-tight">Fall detection demo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* User / System status */}
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColor}`} />
            <span className="text-xs text-slate-500">{statusLabel}</span>
          </div>
          <p className="mt-1 text-xs font-medium text-slate-700 truncate">
            User: <span className="font-semibold text-brand-700">{state.userId}</span>
          </p>
          {state.activeAlertCount > 0 && (
            <div className="mt-1.5 flex items-center gap-1.5 px-2 py-1 bg-red-50 border border-red-200 rounded-md">
              <AlertTriangle className="w-3 h-3 text-red-500" />
              <span className="text-xs font-semibold text-red-600">
                {state.activeAlertCount} Active Alert{state.activeAlertCount > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        <div className="mx-3 mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800">Prototype</p>
          <p className="mt-0.5 text-[10px] leading-4 text-amber-800">Simulator data is synthetic. No physical band is connected.</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            Navigation
          </p>
          <ul className="space-y-0.5">
            {navItems.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  onClick={() => { if (window.innerWidth < 1024) onClose(); }}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150
                     ${isActive
                       ? 'bg-brand-50 text-brand-700 border border-brand-100'
                       : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                     }`
                  }
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1">{label}</span>
                  {to === '/alerts' && state.activeAlertCount > 0 && (
                    <span className="w-5 h-5 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full">
                      {state.activeAlertCount > 9 ? '9+' : state.activeAlertCount}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-100">
          <p className="text-[10px] text-slate-400 text-center">
            SafeBand AI v1.0 — Prototype
          </p>
          <p className="text-[10px] text-slate-400 text-center mt-0.5">
            Not a certified medical device
          </p>
        </div>
      </aside>
    </>
  );
}
