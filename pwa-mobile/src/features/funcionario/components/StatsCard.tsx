import React, { ReactNode } from 'react';

interface StatsCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: ReactNode;
  color?: 'blue' | 'emerald' | 'amber' | 'rose' | 'slate' | 'violet';
  progress?: number; // 0–100
}

const colors = {
  blue:    { bg: 'bg-blue-500/15',    border: 'border-blue-500/25',    icon: 'bg-blue-500/20 text-blue-400',   text: 'text-blue-400',    bar: 'bg-blue-500' },
  emerald: { bg: 'bg-emerald-500/15', border: 'border-emerald-500/25', icon: 'bg-emerald-500/20 text-emerald-400', text: 'text-emerald-400', bar: 'bg-emerald-500' },
  amber:   { bg: 'bg-amber-500/15',   border: 'border-amber-500/25',   icon: 'bg-amber-500/20 text-amber-400',  text: 'text-amber-400',   bar: 'bg-amber-500' },
  rose:    { bg: 'bg-rose-500/15',    border: 'border-rose-500/25',    icon: 'bg-rose-500/20 text-rose-400',   text: 'text-rose-400',    bar: 'bg-rose-500' },
  slate:   { bg: 'bg-slate-700/50',   border: 'border-slate-700',      icon: 'bg-slate-700 text-slate-400',    text: 'text-slate-300',   bar: 'bg-slate-500' },
  violet:  { bg: 'bg-violet-500/15',  border: 'border-violet-500/25',  icon: 'bg-violet-500/20 text-violet-400', text: 'text-violet-400', bar: 'bg-violet-500' },
};

export default function StatsCard({ label, value, sub, icon, color = 'blue', progress }: StatsCardProps) {
  const c = colors[color];
  return (
    <div className={`rounded-2xl border ${c.bg} ${c.border} p-4`}>
      <div className="flex items-start justify-between gap-2">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${c.icon}`}>
          {icon}
        </div>
        <div className="flex-1 text-right min-w-0">
          <p className="text-xs text-slate-400 mb-0.5">{label}</p>
          <p className={`text-xl font-bold truncate ${c.text}`}>{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-0.5 truncate">{sub}</p>}
        </div>
      </div>
      {typeof progress === 'number' && (
        <div className="mt-3 h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div className={`h-full ${c.bar} rounded-full transition-all duration-500`} style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </div>
      )}
    </div>
  );
}
