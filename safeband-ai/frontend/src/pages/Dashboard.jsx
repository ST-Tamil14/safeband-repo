import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, Bell, CircleHelp,
  Clock3, Database, MapPin, Play, Radio, ShieldCheck, TriangleAlert,
  Wifi, WifiOff,
} from 'lucide-react';
import { useSensorPolling } from '../hooks/useSensorPolling';
import { useNotifications } from '../hooks/useNotifications';
import { useApp } from '../context/AppContext';
import { formatConfidence } from '../utils/formatSensorValue';
import { timeAgo } from '../utils/formatDate';

function Metric({ icon: Icon, label, value, note, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-rose-50 text-rose-700',
    blue: 'bg-sky-50 text-sky-700',
  };

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{value}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{note}</p>
        </div>
        <span className={`rounded-xl p-2.5 ${tones[tone]}`}><Icon className="h-5 w-5" /></span>
      </div>
    </article>
  );
}

function SensorValue({ label, value, unit }) {
  const display = value === undefined || value === null || value === ''
    ? '—'
    : typeof value === 'number' ? Number(value).toFixed(2) : value;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-sm font-semibold text-slate-900">{display}<span className="ml-1 font-sans text-xs font-normal text-slate-500">{unit}</span></p>
    </div>
  );
}

function readableActivity(raw) {
  const value = String(raw || '').toLowerCase();
  const labels = {
    normal_activity: 'Normal movement',
    possible_fall: 'Possible fall motion',
    lying_or_stationary: 'Still / lying down',
    high_motion: 'High movement',
    walking: 'Walking',
    running: 'Running',
    sitting: 'Sitting',
    standing: 'Standing',
    falling: 'Falling',
  };
  return labels[value] || (raw ? String(raw).replaceAll('_', ' ') : 'Waiting for a reading');
}

export default function Dashboard() {
  const { state } = useApp();
  const { data, loading, error, readingCount, lastUpdated, refetch } = useSensorPolling(4000);
  const {
    notifications,
    error: notificationError,
    refetch: refetchNotifications,
  } = useNotifications(8000);
  const [activityHistory, setActivityHistory] = useState([]);

  useEffect(() => {
    const label = data?.activity?.activity || data?.activity?.classified_activity;
    if (!label) return;
    setActivityHistory((history) => [...history, label].slice(-8));
  }, [data]);

  const openAlerts = notifications.filter((item) => !['resolved', 'acknowledged'].includes(item.status));
  const acknowledged = notifications.filter((item) => item.status === 'acknowledged');
  const resolved = notifications.filter((item) => item.status === 'resolved');
  const model = data?.ml_detection;
  const fallDetected = Boolean(model?.model_detected_fall || model?.fall_detected);
  const confirmed = Boolean(data?.confirmation?.confirmed);
  const confidence = Number(model?.confidence || 0);
  const severity = data?.severity;
  const riskScore = severity?.risk_score;
  const sensor = data?.sensor || {};
  const locationAvailable = sensor.latitude != null && sensor.longitude != null;

  let fallStatus = 'No reading yet';
  let fallTone = 'slate';
  let fallNote = 'Start the demo feed to run the detection model.';
  if (error) {
    fallStatus = 'Feed unavailable';
    fallTone = 'red';
    fallNote = 'Check that the backend is running.';
  } else if (data && fallDetected && confirmed) {
    fallStatus = 'Confirmed fall';
    fallTone = 'red';
    fallNote = 'The pipeline marked this event as confirmed.';
  } else if (data && fallDetected) {
    fallStatus = 'Possible fall';
    fallTone = 'amber';
    fallNote = 'Model flagged a pattern; confirmation is still pending.';
  } else if (data) {
    fallStatus = 'No fall detected';
    fallTone = 'green';
    fallNote = 'Most recent reading did not cross the fall threshold.';
  }

  const activity = readableActivity(data?.activity?.activity || data?.activity?.classified_activity);
  const riskText = riskScore == null ? 'No score' : `${Math.round(riskScore)} / 100`;
  const statusIcon = state.systemStatus === 'online' ? Wifi : WifiOff;
  const StatusIcon = statusIcon;

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5 pb-8">
      <section className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-lg">
        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-cyan-100">DEMONSTRATION MODE</span>
              <span className="text-xs text-slate-300">Prototype · not a medical device</span>
            </div>
            <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">See how a reading becomes a fall alert</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              SafeBand receives motion data, estimates activity and fall likelihood, then records an emergency alert only when the fall is confirmed.
              The simulator sends synthetic readings; it does not connect a physical band.
            </p>
          </div>
          <Link to="/simulator" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300">
            <Play className="h-4 w-4 fill-current" /> Open demo controls <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid border-t border-white/10 bg-white/[0.04] sm:grid-cols-3">
          {[
            ['01', 'Sensor reading', 'Motion and optional health/location values'],
            ['02', 'AI assessment', 'Activity, fall probability and risk estimate'],
            ['03', 'Alert decision', 'Only confirmed events enter notification history'],
          ].map(([number, title, description]) => (
            <div key={number} className="flex gap-3 border-b border-white/10 px-5 py-4 last:border-0 sm:border-b-0 sm:border-r sm:last:border-0">
              <span className="font-mono text-sm font-bold text-cyan-300">{number}</span>
              <div><p className="text-sm font-semibold">{title}</p><p className="mt-0.5 text-xs leading-5 text-slate-400">{description}</p></div>
            </div>
          ))}
        </div>
      </section>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><p className="font-semibold">Sensor feed is not responding</p><p className="mt-1">{error}</p><button onClick={refetch} className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-rose-800 ring-1 ring-rose-200">Try again</button></div>}
      {notificationError && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><span><strong>Alert history unavailable.</strong> The backend could not load notifications, so the alert count may be incomplete.</span><button onClick={refetchNotifications} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold ring-1 ring-amber-200">Retry alert history</button></div>}

      <section aria-label="Current system summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={StatusIcon} label="Backend connection" value={state.systemStatus === 'online' ? 'Connected' : state.systemStatus === 'offline' ? 'Offline' : 'Checking'} note="This only checks the API, not a physical wearable." tone={state.systemStatus === 'online' ? 'green' : state.systemStatus === 'offline' ? 'red' : 'slate'} />
        <Metric icon={Radio} label="Readings seen this visit" value={readingCount} note={lastUpdated ? `Latest update ${timeAgo(lastUpdated)} · not a lifetime database total.` : 'No reading has reached this page yet.'} tone="blue" />
        <Metric icon={AlertTriangle} label="Latest model result" value={fallStatus} note={fallNote} tone={fallTone} />
        <Metric icon={Bell} label="Open emergency alerts" value={notificationError ? 'Unavailable' : openAlerts.length} note={`${acknowledged.length} acknowledged · ${resolved.length} resolved`} tone={openAlerts.length ? 'red' : 'green'} />
      </section>

      <section className={`rounded-2xl border p-5 sm:p-6 ${fallDetected ? confirmed ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className={`rounded-xl bg-white p-3 shadow-sm ${fallDetected ? confirmed ? 'text-rose-600' : 'text-amber-600' : 'text-emerald-600'}`}>
              {fallDetected ? <TriangleAlert className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">What is happening now</p>
              <h3 className="mt-1 text-xl font-bold text-slate-950">{fallStatus}</h3>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-700">{fallDetected && !confirmed ? `The model confidence is ${formatConfidence(confidence)}. A possible detection is not yet a confirmed emergency alert.` : fallNote}</p>
            </div>
          </div>
          {fallDetected && !confirmed && <Link to="/alerts" className="inline-flex items-center gap-2 self-start rounded-lg border border-amber-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-900">View alert rules <ArrowRight className="h-4 w-4" /></Link>}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h3 className="text-lg font-bold text-slate-950">Latest reading</h3><p className="mt-1 text-sm text-slate-500">Values used for the most recent model assessment.</p></div>
            <Link to="/monitoring" className="inline-flex items-center gap-1 text-sm font-semibold text-cyan-800 hover:text-cyan-950">All sensor values <ArrowRight className="h-4 w-4" /></Link>
          </div>
          {!data ? (
            <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <Database className="mx-auto h-7 w-7 text-slate-400" />
              <p className="mt-3 font-semibold text-slate-800">Waiting for the first sensor reading</p>
              <p className="mt-1 text-sm text-slate-500">Open Demo Controls and start the simulator to send synthetic sensor data.</p>
              <Link to="/simulator" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">Go to simulator <ArrowRight className="h-4 w-4" /></Link>
            </div>
          ) : (
            <>
              <div className="mt-5 grid gap-2 sm:grid-cols-3">
                <SensorValue label="Acceleration X" value={sensor.adxl_acc_x} unit="m/s²" />
                <SensorValue label="Acceleration Y" value={sensor.adxl_acc_y} unit="m/s²" />
                <SensorValue label="Acceleration Z" value={sensor.adxl_acc_z} unit="m/s²" />
                <SensorValue label="Heart rate" value={sensor.heart_rate} unit="bpm" />
                <SensorValue label="Blood oxygen" value={sensor.spo2} unit="%" />
                <SensorValue label="Location" value={locationAvailable ? `${Number(sensor.latitude).toFixed(4)}, ${Number(sensor.longitude).toFixed(4)}` : null} unit="" />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Activity estimate</p><p className="mt-1 font-semibold capitalize text-slate-900">{activity}</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Fall model confidence</p><p className="mt-1 font-semibold text-slate-900">{formatConfidence(confidence)}</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Prototype risk score</p><p className="mt-1 font-semibold text-slate-900">{riskText}</p><p className="mt-1 text-xs leading-5 text-slate-500">{riskScore === 0 && fallDetected ? 'No risk factors crossed the scoring thresholds. This is separate from the possible-fall flag.' : 'A separate estimate from the model confidence.'}</p></div>
              </div>
            </>
          )}
        </section>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2"><div><h3 className="text-lg font-bold text-slate-950">How to read this</h3><p className="mt-1 text-sm text-slate-500">The three numbers mean different things.</p></div><CircleHelp className="h-5 w-5 text-slate-400" /></div>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="border-t border-slate-100 pt-3"><dt className="font-semibold text-slate-800">Model confidence</dt><dd className="mt-1 leading-5 text-slate-500">How strongly the model matches a fall pattern. A possible fall can still be unconfirmed.</dd></div>
              <div className="border-t border-slate-100 pt-3"><dt className="font-semibold text-slate-800">Risk score</dt><dd className="mt-1 leading-5 text-slate-500">A separate prototype score based on fall probability, impact, inactivity and health readings.</dd></div>
              <div className="border-t border-slate-100 pt-3"><dt className="font-semibold text-slate-800">Open alerts</dt><dd className="mt-1 leading-5 text-slate-500">Saved notifications still needing action. Possible detections do not automatically count as alerts.</dd></div>
            </dl>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-slate-500" /><h3 className="font-bold text-slate-950">Recent activity labels</h3></div>
            {activityHistory.length ? <div className="mt-3 flex flex-wrap gap-2">{activityHistory.slice(-5).reverse().map((item, index) => <span key={`${item}-${index}`} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium capitalize text-slate-700">{readableActivity(item)}</span>)}</div> : <p className="mt-3 text-sm text-slate-500">No model assessments received yet.</p>}
            <p className="mt-4 flex items-center gap-2 text-xs text-slate-500"><MapPin className="h-3.5 w-3.5" />{locationAvailable ? 'Coordinates came with the latest reading.' : 'No location came with the latest reading.'}</p>
          </section>
        </aside>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
        <span>Signed-in demo user: <strong className="font-mono text-slate-700">{state.userId}</strong> · Data feed: backend API</span>
        <span className="inline-flex items-center gap-1.5">{state.systemStatus === 'online' ? <Wifi className="h-3.5 w-3.5 text-emerald-600" /> : <WifiOff className="h-3.5 w-3.5 text-rose-600" />}{loading ? 'Checking for new readings…' : 'Updates automatically every 4 seconds'}</span>
      </div>
    </div>
  );
}
