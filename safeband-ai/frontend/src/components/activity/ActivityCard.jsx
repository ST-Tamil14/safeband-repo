import { Activity, User, PersonStanding, BedDouble, Zap, HelpCircle, TrendingDown } from 'lucide-react';
import { formatDateTime } from '../../utils/formatDate';

const activityConfig = {
  walking:    { label: 'Walking',    icon: Activity,         color: 'text-brand-600', bg: 'bg-brand-50',  badge: 'bg-brand-100 text-brand-700 border-brand-200' },
  running:    { label: 'Running',    icon: Zap,              color: 'text-orange-600', bg: 'bg-orange-50', badge: 'bg-orange-100 text-orange-700 border-orange-200' },
  sitting:    { label: 'Sitting',    icon: User,             color: 'text-blue-600', bg: 'bg-blue-50',   badge: 'bg-blue-100 text-blue-700 border-blue-200' },
  standing:   { label: 'Standing',   icon: PersonStanding,   color: 'text-green-600', bg: 'bg-green-50',  badge: 'bg-green-100 text-green-700 border-green-200' },
  lying:      { label: 'Lying Down', icon: BedDouble,        color: 'text-slate-500', bg: 'bg-slate-50',  badge: 'bg-slate-100 text-slate-600 border-slate-200' },
  'lying down': { label: 'Lying Down', icon: BedDouble, color: 'text-slate-500', bg: 'bg-slate-50', badge: 'bg-slate-100 text-slate-600 border-slate-200' },
  normal_activity: { label: 'Normal Movement', icon: Activity, color: 'text-brand-600', bg: 'bg-brand-50', badge: 'bg-brand-100 text-brand-700 border-brand-200' },
  possible_fall: { label: 'Possible Fall Motion', icon: TrendingDown, color: 'text-orange-600', bg: 'bg-orange-50', badge: 'bg-orange-100 text-orange-700 border-orange-200' },
  lying_or_stationary: { label: 'Still / Lying Down', icon: BedDouble, color: 'text-slate-500', bg: 'bg-slate-50', badge: 'bg-slate-100 text-slate-600 border-slate-200' },
  high_motion: { label: 'High Movement', icon: Zap, color: 'text-orange-600', bg: 'bg-orange-50', badge: 'bg-orange-100 text-orange-700 border-orange-200' },
  falling:    { label: 'Falling',    icon: TrendingDown,     color: 'text-red-600', bg: 'bg-red-50',    badge: 'bg-red-100 text-red-700 border-red-200' },
  unknown:    { label: 'Unknown',    icon: HelpCircle,       color: 'text-slate-400', bg: 'bg-slate-50',  badge: 'bg-slate-100 text-slate-500 border-slate-200' },
};

function getConfig(activity) {
  const key = String(activity || 'unknown').toLowerCase();
  return activityConfig[key] || activityConfig.unknown;
}

export default function ActivityCard({ activityResult, history = [] }) {
  if (!activityResult) {
    return (
      <div className="card p-5">
        <p className="section-title mb-1">Activity Recognition</p>
        <p className="text-sm text-slate-400">Waiting for data…</p>
      </div>
    );
  }

  const activity = activityResult.activity || activityResult.classified_activity || 'Unknown';
  const confidence = activityResult.confidence ?? activityResult.activity_confidence;
  const cfg = getConfig(activity);
  const Icon = cfg.icon;
  const confPct = confidence !== undefined ? (confidence * 100).toFixed(1) : null;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="section-title">Activity Recognition</p>
        <span className={`badge ${cfg.badge}`}>{cfg.label}</span>
      </div>

      {/* Main activity display */}
      <div className={`flex items-center gap-4 p-4 rounded-xl ${cfg.bg} mb-4`}>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center bg-white shadow-sm`}>
          <Icon className={`w-6 h-6 ${cfg.color}`} />
        </div>
        <div className="flex-1">
          <p className={`text-xl font-bold ${cfg.color}`}>{cfg.label}</p>
          {confPct !== null && (
            <div className="mt-1">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-white rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${cfg.color.replace('text-', 'bg-')}`}
                    style={{ width: `${confPct}%` }}
                  />
                </div>
                <span className={`text-xs font-semibold ${cfg.color}`}>{confPct}%</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Confidence</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent activity timeline */}
      {history.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Recent Timeline</p>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {history.slice(-6).map((item, i) => {
              const hcfg = getConfig(item.activity || item.classified_activity);
              const HIcon = hcfg.icon;
              const isLatest = i === history.slice(-6).length - 1;
              return (
                <div key={i} className={`flex-shrink-0 flex flex-col items-center gap-1 p-2 rounded-lg border min-w-[60px]
                  ${isLatest ? 'border-brand-200 bg-brand-50' : 'border-slate-100 bg-slate-50'}`}>
                  <HIcon className={`w-4 h-4 ${hcfg.color}`} />
                  <span className="text-[10px] font-medium text-slate-600 text-center leading-tight">{hcfg.label}</span>
                  {isLatest && <span className="text-[9px] text-brand-500 font-semibold">Now</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
