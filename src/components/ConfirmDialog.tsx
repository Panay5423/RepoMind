import { AlertTriangle } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { SECONDARY_WHITE_BTN } from './ui/PremiumPrimitives.tsx';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={loading ? undefined : onCancel}
            className="fixed inset-0 bg-[#0B1F3A]/35 backdrop-blur-xs"
          />
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_24px_50px_-12px_rgba(11,31,58,0.2)]"
          >
            <div className="flex items-start gap-3.5">
              <div className="rounded-xl border border-[#FECDD3] bg-[#FFF1F2] p-2.5 text-[#E11D48] shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display text-[15px] font-semibold text-[#0F172A]">{title}</h3>
                <p className="mt-1.5 text-[13px] text-[#64748B] leading-relaxed">{description}</p>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={loading}
                onClick={onCancel}
                className={`${SECONDARY_WHITE_BTN} h-9 px-4 text-[12px]`}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={onConfirm}
                className="h-9 px-4 text-[12px] font-semibold text-white bg-[#E11D48] hover:bg-[#BE123C] rounded-xl shadow-sm shadow-[#E11D48]/20 transition-all disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                {loading ? 'Processing...' : confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
