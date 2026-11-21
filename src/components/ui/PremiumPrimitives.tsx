import React, { useEffect, useState } from 'react';
import { animate, motion } from 'motion/react';

export const RM_EASE = [0.16, 1, 0.3, 1] as const;

export const PRIMARY_BLUE_BTN =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#3B82F6] hover:from-[#1D4ED8] hover:to-[#2563EB] text-white font-semibold shadow-sm shadow-[#2563EB]/25 hover:shadow-md hover:shadow-[#2563EB]/30 transition-all whitespace-nowrap shrink-0 disabled:opacity-55 disabled:cursor-not-allowed';

export const SECONDARY_WHITE_BTN =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] hover:border-[#93C5FD] text-[#0F172A] font-medium shadow-2xs transition-all whitespace-nowrap shrink-0 disabled:opacity-55 disabled:cursor-not-allowed';

export function AnimatedCounter({
  value,
  suffix = '',
}: {
  value: number;
  suffix?: string;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const controls = animate(0, value, {
      duration: 0.55,
      ease: RM_EASE,
      onUpdate: (latest) => setDisplay(Math.round(latest)),
    });
    return () => controls.stop();
  }, [value]);

  return (
    <span className="tabular-nums">
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}

export function InteractiveCard({
  children,
  className = '',
  delay = 0,
  hoverLift = true,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  hoverLift?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, delay, ease: RM_EASE }}
      whileHover={hoverLift ? { y: -3 } : undefined}
      className={`group relative rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-10px_rgba(37,99,235,0.06)] hover:border-[#93C5FD] hover:shadow-[0_0_0_1px_rgba(59,130,246,0.14),0_14px_30px_-10px_rgba(37,99,235,0.16)] transition-[border-color,box-shadow,background-color] duration-200 ${className}`}
    >
      {children}
    </motion.div>
  );
}

export function SkeletonCard({ className = 'h-24' }: { className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-[#E2E8F0] bg-white overflow-hidden relative ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-[#F8FAFC] via-[#EFF6FF] to-[#F8FAFC] animate-pulse" />
    </div>
  );
}
