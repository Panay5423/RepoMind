import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Copy, FileCode2, X } from 'lucide-react';
import { api } from '../../lib/api.ts';
import { useToast } from '../../context/ToastContext.tsx';
import { RM_EASE, SECONDARY_WHITE_BTN } from '../ui/PremiumPrimitives.tsx';

interface CodeViewerModalProps {
  repositoryId: string;
  filePath: string | null;
  highlightStart?: number;
  highlightEnd?: number;
  onClose: () => void;
}

export function CodeViewerModal({
  repositoryId,
  filePath,
  highlightStart,
  highlightEnd,
  onClose,
}: CodeViewerModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fileData, setFileData] = useState<{
    path: string;
    language: string;
    lines: number;
    complexityScore: number;
    content: string;
  } | null>(null);
  const { notify } = useToast();
  const highlightRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!filePath) return;
    let active = true;
    setLoading(true);
    setError('');
    api.repositories
      .fileContent(repositoryId, filePath)
      .then((res) => {
        if (active) setFileData(res);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load file.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [repositoryId, filePath]);

  useEffect(() => {
    if (!filePath) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [filePath, onClose]);

  useEffect(() => {
    if (fileData && highlightStart && highlightRef.current) {
      highlightRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [fileData, highlightStart]);

  const lines = (fileData?.content || '').split('\n');

  const handleCopy = async () => {
    if (!fileData) return;
    const raw = lines.map((l) => l.replace(/^\d+:\s?/, '')).join('\n');
    await navigator.clipboard.writeText(raw);
    notify('Copied file content to clipboard.', 'success');
  };

  return (
    <AnimatePresence>
      {filePath && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#0B1F3A]/40 backdrop-blur-xs"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.24, ease: RM_EASE }}
            className="relative z-10 w-full max-w-4xl h-full bg-[#F8FAFC] border-l border-[#E2E8F0] flex flex-col shadow-2xl"
          >
            <div className="h-14 px-5 border-b border-[#E2E8F0] flex items-center justify-between gap-4 bg-white">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileCode2 className="w-4 h-4 text-[#2563EB] shrink-0" />
                <span className="font-mono text-[13px] font-semibold text-[#0F172A] truncate">
                  {filePath}
                </span>
                {fileData && (
                  <span className="text-[11px] text-[#64748B] font-mono shrink-0">
                    · {fileData.language} · {fileData.lines}L
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={() => void handleCopy()}
                  disabled={!fileData}
                  className={`${SECONDARY_WHITE_BTN} h-8 px-3 text-[12px]`}
                >
                  <Copy className="w-3.5 h-3.5 text-[#475569]" />
                  <span>Copy</span>
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.94 }}
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] transition-colors"
                  aria-label="Close source viewer"
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed">
              {loading ? (
                <div className="space-y-2 p-2">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <div key={n} className="h-4 rounded bg-[#E2E8F0] animate-pulse" />
                  ))}
                </div>
              ) : error ? (
                <div className="p-4 rounded-xl border border-[#FECDD3] bg-[#FFF1F2] text-[#E11D48]">
                  {error}
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.18 }}
                  className="rounded-2xl border border-[#1E3A5F] bg-[#0B1F3A] overflow-x-auto py-2 shadow-lg"
                >
                  {lines.map((line, idx) => {
                    const match = line.match(/^(\d+):\s?(.*)$/);
                    const lineNum = match ? Number(match[1]) : idx + 1;
                    const code = match ? match[2] : line;
                    const isHighlighted =
                      typeof highlightStart === 'number' &&
                      lineNum >= highlightStart &&
                      lineNum <= (highlightEnd ?? highlightStart);
                    return (
                      <div
                        key={`${lineNum}-${idx}`}
                        ref={lineNum === highlightStart ? highlightRef : undefined}
                        className={`flex px-3.5 py-0.5 transition-colors ${
                          isHighlighted
                            ? 'bg-[#2563EB]/30 text-white'
                            : 'text-[#E2E8F0] hover:bg-white/[0.04]'
                        }`}
                      >
                        <span className="w-12 pr-4 text-right select-none text-[#64748B] tabular-nums shrink-0">
                          {lineNum}
                        </span>
                        <pre className="whitespace-pre font-mono">{code || ' '}</pre>
                      </div>
                    );
                  })}
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
