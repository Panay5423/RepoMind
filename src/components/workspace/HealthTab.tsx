import { motion } from 'motion/react';
import { Info } from 'lucide-react';
import type { HealthScoreReport } from '../../../shared/types.ts';
import { AnimatedCounter, InteractiveCard, RM_EASE } from '../ui/PremiumPrimitives.tsx';

interface HealthTabProps {
  report: HealthScoreReport;
}

export function HealthTab({ report }: HealthTabProps) {
  const scoreColor =
    report.overallEstimate >= 80
      ? 'text-[#059669]'
      : report.overallEstimate >= 60
        ? 'text-[#D97706]'
        : 'text-[#E11D48]';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: RM_EASE }}
      className="space-y-6"
    >
      {/* Heuristic Disclaimer */}
      <div className="rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF]/60 p-5 flex items-start gap-3">
        <Info className="w-4 h-4 text-[#2563EB] mt-0.5 shrink-0" />
        <p className="text-[12px] text-[#334155] leading-relaxed">{report.disclaimer}</p>
      </div>

      {/* Overall Score + Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <InteractiveCard hoverLift={false} className="lg:col-span-4 p-6 flex flex-col justify-between">
          <div>
            <p className="text-[12px] font-semibold text-[#64748B]">Overall Health Estimate</p>
            <div className="mt-4 flex items-baseline gap-2">
              <span className={`font-display text-5xl font-bold tabular-nums ${scoreColor}`}>
                <AnimatedCounter value={report.overallEstimate} />
              </span>
              <span className="text-[13px] font-mono text-[#64748B]">/ 100</span>
            </div>
            <div className="mt-4 h-2.5 w-full rounded-full bg-[#F1F5F9] overflow-hidden">
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.5, delay: 0.08, ease: RM_EASE }}
                className="h-full rounded-full bg-gradient-to-r from-[#2563EB] to-[#60A5FA] origin-left"
                style={{ width: `${report.overallEstimate}%` }}
              />
            </div>
          </div>

          {report.prioritizedImprovements.length > 0 && (
            <div className="mt-8 pt-6 border-t border-[#E2E8F0]">
              <h3 className="text-[12px] font-bold text-[#0F172A] mb-3">
                Prioritized Improvement Actions
              </h3>
              <ul className="space-y-2 text-[12px] text-[#475569] leading-relaxed">
                {report.prioritizedImprovements.map((imp, idx) => (
                  <motion.li
                    key={idx}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.18, delay: 0.12 + idx * 0.04 }}
                    className="flex items-start gap-2"
                  >
                    <span className="font-mono font-bold text-[#2563EB] shrink-0">{idx + 1}.</span>
                    <span>{imp}</span>
                  </motion.li>
                ))}
              </ul>
            </div>
          )}
        </InteractiveCard>

        <InteractiveCard hoverLift={false} className="lg:col-span-8 divide-y divide-[#F1F5F9]">
          {report.breakdown.map((item, idx) => {
            const barColor =
              item.score >= 80
                ? 'bg-[#059669]'
                : item.score >= 60
                  ? 'bg-[#2563EB]'
                  : 'bg-[#D97706]';
            return (
              <motion.div
                key={item.category}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.04, ease: RM_EASE }}
                className="p-5 space-y-2"
              >
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-[14px] font-bold text-[#0F172A]">{item.category}</h3>
                  <span className="font-mono text-[13px] font-bold text-[#0B1F3A] tabular-nums">
                    {item.score}/100
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-[#F1F5F9] overflow-hidden">
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.45, delay: 0.1 + idx * 0.05, ease: RM_EASE }}
                    className={`h-full rounded-full origin-left ${barColor}`}
                    style={{ width: `${item.score}%` }}
                  />
                </div>
                <p className="text-[12px] text-[#475569] leading-relaxed">
                  <span className="text-[#0F172A] font-semibold">Basis: </span>
                  {item.basis}
                </p>
                <p className="text-[12px] text-[#475569] leading-relaxed">
                  <span className="text-[#2563EB] font-semibold">Recommendation: </span>
                  {item.recommendation}
                </p>
              </motion.div>
            );
          })}
        </InteractiveCard>
      </div>
    </motion.div>
  );
}
