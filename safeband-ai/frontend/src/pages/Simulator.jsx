import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play, Square, Info, CheckCircle, AlertTriangle,
  Heart, RefreshCw, Terminal, Activity, Cpu
} from 'lucide-react';
import { simulatorStart, simulatorStop, simulatorStatus } from '../services/api';
import { useApp } from '../context/AppContext';

// Poll backend for simulator status every 3 s while on this page
const STATUS_POLL_MS = 3000;

export default function Simulator() {
  const { addLog, showToast } = useApp();

  const [isRunning, setIsRunning]       = useState(false);
  const [pid, setPid]                   = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false); // start / stop in progress
  const [logs, setLogs]                 = useState([]);
  const [readingsSent, setReadingsSent]  = useState(0);
  const [error, setError]               = useState(null);

  const statusTimerRef = useRef(null);
  const isMounted      = useRef(true);

  // ── Helper: append a local log line ────────────────────────────────────────
  const pushLog = useCallback((message, type = 'info') => {
    const ts = new Date().toLocaleTimeString();
    setLogs((l) => [`[${ts}] ${message}`, ...l].slice(0, 60));
    addLog('Simulator', message, type);
  }, [addLog]);

  // ── Fetch simulator status from backend ─────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    if (!isMounted.current) return;
    try {
      const res = await simulatorStatus();
      if (!isMounted.current) return;
      const { running, pid: p } = res.data;
      setIsRunning(running);
      setPid(p ?? null);
      setError(null);
    } catch (err) {
      if (!isMounted.current) return;
      // If backend is down, mark as not running
      setIsRunning(false);
      setPid(null);
      setError('Cannot reach backend — is the server running?');
    } finally {
      if (isMounted.current) setStatusLoading(false);
    }
  }, []);

  // ── Start polling status on mount; stop on unmount (page navigation) ────────
  useEffect(() => {
    isMounted.current = true;
    fetchStatus();
    statusTimerRef.current = setInterval(fetchStatus, STATUS_POLL_MS);

    return () => {
      isMounted.current = false;
      clearInterval(statusTimerRef.current);
      statusTimerRef.current = null;

      // ✅ Auto-stop the simulator when the user navigates away
      simulatorStop().catch(() => {/* silently ignore if already stopped */});
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Start simulator ─────────────────────────────────────────────────────────
  const handleStart = async () => {
    if (actionLoading || isRunning) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await simulatorStart();
      const { pid: p, message } = res.data;
      setPid(p);
      setIsRunning(true);
      setReadingsSent(0);
      pushLog(`✅ ${message} (PID ${p})`, 'success');
      showToast('Simulator started — running simulator.py', 'success');
    } catch (err) {
      setError(err.message);
      pushLog(`❌ Failed to start: ${err.message}`, 'error');
      showToast(`Start failed: ${err.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Stop simulator ──────────────────────────────────────────────────────────
  const handleStop = async () => {
    if (actionLoading || !isRunning) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await simulatorStop();
      const { message } = res.data;
      setIsRunning(false);
      setPid(null);
      pushLog(`⛔ ${message}`, 'info');
      showToast('Simulator stopped', 'info');
    } catch (err) {
      setError(err.message);
      pushLog(`❌ Failed to stop: ${err.message}`, 'error');
      showToast(`Stop failed: ${err.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Track estimated readings (backend sends every 3 s) ──────────────────────
  useEffect(() => {
    if (!isRunning) { setReadingsSent(0); return; }
    const t = setInterval(() => setReadingsSent((c) => c + 1), 3000);
    return () => clearInterval(t);
  }, [isRunning]);

  return (
    <div className="space-y-5 fade-in">

      {/* ── Info banner ─────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <Info className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-950">
            Demo only — this is not a physical SafeBand
          </p>
          <p className="text-xs text-amber-900 mt-1 leading-5">
            Start sends synthetic sensor readings to the AI pipeline every 3 seconds. It includes a fall scenario every tenth reading. Confirmed events can be saved to Supabase and may send email if email delivery is configured. Use a test project/account for demonstrations. The simulator stops when you leave this page.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ── Left column — controls ─────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Status card */}
          <div className="card p-5">
            <p className="section-title mb-4">Simulator Status</p>

            {/* Status indicator */}
            <div className={`flex items-center gap-3 p-4 rounded-xl border mb-4
              ${isRunning
                ? 'bg-green-50 border-green-200'
                : error
                ? 'bg-red-50 border-red-200'
                : 'bg-slate-50 border-slate-200'}`}>
              <span className={`w-3 h-3 rounded-full flex-shrink-0
                ${isRunning ? 'bg-green-500 dot-blink' : error ? 'bg-red-400' : 'bg-slate-300'}`}
              />
              <div className="flex-1">
                <p className={`text-sm font-semibold
                  ${isRunning ? 'text-green-700' : error ? 'text-red-700' : 'text-slate-500'}`}>
                  {statusLoading
                    ? 'Checking status…'
                    : isRunning
                    ? 'Simulator Running'
                    : error
                    ? 'Backend Unreachable'
                    : 'Simulator Stopped'}
                </p>
                {isRunning && pid && (
                  <p className="text-xs text-green-600 mt-0.5 font-mono">PID {pid}</p>
                )}
                {error && (
                  <p className="text-xs text-red-600 mt-0.5">{error}</p>
                )}
              </div>
              <button onClick={fetchStatus} className="p-1 rounded hover:bg-white transition-colors" title="Refresh status">
                <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>

            {/* Start / Stop buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleStart}
                disabled={isRunning || actionLoading || statusLoading}
                className="btn-primary flex-1 justify-center"
              >
                <Play className="w-4 h-4" />
                {actionLoading && !isRunning ? 'Starting…' : 'Start Simulator'}
              </button>
              <button
                onClick={handleStop}
                disabled={!isRunning || actionLoading}
                className="btn-danger flex-1 justify-center"
              >
                <Square className="w-4 h-4" />
                {actionLoading && isRunning ? 'Stopping…' : 'Stop'}
              </button>
            </div>
          </div>

          {/* Stats card */}
          <div className="card p-5">
            <p className="section-title mb-3">Simulator Stats</p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                { label: 'Status',           value: isRunning ? 'Running' : 'Stopped',     icon: Activity,  color: isRunning ? 'text-green-600' : 'text-slate-400' },
                { label: 'Process ID',       value: pid ?? '—',                             icon: Cpu,       color: 'text-brand-600' },
                { label: 'Est. Readings',    value: readingsSent,                           icon: CheckCircle, color: 'text-slate-700' },
                { label: 'Send Interval',    value: '3 seconds',                            icon: Heart,     color: 'text-slate-700' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className={`w-3.5 h-3.5 ${color}`} />
                    <p className="text-slate-400">{label}</p>
                  </div>
                  <p className={`font-bold text-base ${color}`}>{String(value)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* How it works */}
          <div className="card p-5">
            <p className="section-title mb-3">How It Works</p>
            <ol className="space-y-2 text-xs text-slate-600">
              {[
                'Click Start — the backend runs simulator.py as a child process.',
                'Every 3 seconds, a randomised sensor reading is POSTed to /fall/ml-process.',
                'Every 10th reading is a FALL event; the rest are normal.',
                'The backend AI pipeline processes each reading and stores alerts in Supabase.',
                'Check the Dashboard and Alerts pages to see results in real-time.',
                'Click Stop (or navigate away) to terminate the simulator process.',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* ── Right column — log terminal ────────────────────────────────────── */}
        <div className="card overflow-hidden flex flex-col">
          {/* Terminal title bar */}
          <div className="bg-slate-800 px-4 py-2.5 flex items-center gap-2 flex-shrink-0">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
            <Terminal className="w-3.5 h-3.5 text-slate-400 ml-2" />
            <span className="text-xs text-slate-400 font-mono">simulator — control log</span>
            <span className={`ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded
              ${isRunning ? 'bg-green-800 text-green-200' : 'bg-slate-700 text-slate-400'}`}>
              {isRunning ? '● running' : '○ stopped'}
            </span>
          </div>

          {/* Log output */}
          <div className="flex-1 bg-slate-900 p-3 overflow-y-auto font-mono text-[11px] min-h-[400px]">
            {logs.length === 0 ? (
              <p className="text-slate-500 mt-2">
                Waiting for simulator events…{'\n'}
                Click <span className="text-green-400">Start</span> to begin.
              </p>
            ) : (
              logs.map((line, i) => (
                <div key={i} className={`leading-5
                  ${line.includes('✅') ? 'text-green-400'
                  : line.includes('❌') ? 'text-red-400'
                  : line.includes('⛔') ? 'text-yellow-400'
                  : 'text-slate-300'}`}>
                  {line}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
