import { Info } from 'lucide-react';
import type { HealthScoreReport } from '../../../shared/types.ts';

interface HealthTabProps {
  report: HealthScoreReport;
}

export function HealthTab({ report }: HealthTabProps) {
  const scoreColor =
    report.overallEstimate >= 80
      ? 'text-emerald-400'
      : report.overallEstimate >= 60
      ? 'text-amber-400'
      : 'text-rose-400';

  return (
    <div className="space-y-6">
      {/* Heuristic Disclaimer */}
      <div className="rounded-xl border border-white/[0.08] bg-[#111827] p-5 flex items-start gap-3">
        <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
        <p className="text-xs text-slate-300 leading-relaxed">{report.disclaimer}</p>
      </div>

      {/* Overall Score + Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 rounded-xl border border-white/[0.08] bg-[#111827] p-6 flex flex-col justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Overall Health Estimate</p>
            <div className="mt-4 flex items-baseline gap-2">
              <span className={`font-display text-5xl font-bold tabular-nums ${scoreColor}`}>
                {report.overallEstimate}
              </span>
              <span className="text-sm font-mono text-slate-500">/ 100</span>
            </div>
            <div className="mt-4 h-2 w-full rounded-full bg-[#0B0F19] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500"
                style={{ width: `${report.overallEstimate}%` }}
              />
            </div>
          </div>

          {report.prioritizedImprovements.length > 0 && (
            <div className="mt-8 pt-6 border-t border-white/[0.08]">
              <h3 className="text-xs font-semibold text-white mb-3">
                Prioritized Improvement Actions
              </h3>
              <ul className="space-y-2 text-xs text-slate-300 leading-relaxed">
                {report.prioritizedImprovements.map((imp, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="font-mono text-blue-400 shrink-0">{idx + 1}.</span>
                    <span>{imp}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="lg:col-span-8 rounded-xl border border-white/[0.08] bg-[#111827] divide-y divide-white/[0.06]">
          {report.breakdown.map((item) => {
            const barColor =
              item.score >= 80
                ? 'bg-emerald-500'
                : item.score >= 60
                ? 'bg-blue-500'
                : 'bg-amber-500';
            return (
              <div key={item.category} className="p-5 space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-sm font-semibold text-white">{item.category}</h3>
                  <span className="font-mono text-sm font-semibold text-slate-200 tabular-nums">
                    {item.score}/100
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[#0B0F19] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${barColor}`}
                    style={{ width: `${item.score}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  <span className="text-slate-300 font-medium">Basis: </span>
                  {item.basis}
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  <span className="text-blue-400 font-medium">Recommendation: </span>
                  {item.recommendation}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
