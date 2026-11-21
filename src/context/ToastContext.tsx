import React, { createContext, useCallback, useContext, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  notify: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, variant: ToastVariant = 'info') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { id, message, variant }]);
      setTimeout(() => {
        dismiss(id);
      }, 4500);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      >
        <AnimatePresence>
          {toasts.map((toast) => {
            const icon =
              toast.variant === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0" />
              ) : toast.variant === 'error' ? (
                <AlertCircle className="w-4 h-4 text-[#E11D48] shrink-0" />
              ) : (
                <Info className="w-4 h-4 text-[#2563EB] shrink-0" />
              );
            const ringStyle =
              toast.variant === 'success'
                ? 'border-[#A7F3D0]'
                : toast.variant === 'error'
                  ? 'border-[#FECDD3]'
                  : 'border-[#BFDBFE]';

            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.97 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className={`pointer-events-auto flex items-start gap-3 rounded-2xl border ${ringStyle} bg-white/95 backdrop-blur-md px-4 py-3 text-[13px] text-[#0F172A] shadow-[0_12px_32px_-8px_rgba(15,23,42,0.14),0_2px_6px_rgba(37,99,235,0.08)]`}
              >
                <div className="mt-0.5">{icon}</div>
                <p className="flex-1 leading-snug font-medium text-[#0F172A]">{toast.message}</p>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  className="text-[#64748B] hover:text-[#0F172A] transition-colors shrink-0 p-0.5 rounded-md hover:bg-[#F1F5F9]"
                  aria-label="Dismiss notification"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
