import { useEffect, useState } from 'react';
import { Copy, FileCode2, X } from 'lucide-react';
import { api } from '../../lib/api.ts';
import { useToast } from '../../context/ToastContext.tsx';

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

  if (!filePath) return null;

  const lines = (fileData?.content || '').split('\n');

  const handleCopy = async () => {
    if (!fileData) return;
    const raw = lines
      .map((l) => l.replace(/^\d+:\s?/, ''))
      .join('\n');
    await navigator.clipboard.writeText(raw);
    notify('Copied file content to clipboard.', 'success');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-4xl h-full bg-[#0B0F19] border-l border-white/10 flex flex-col">
        <div className="h-14 px-5 border-b border-white/[0.08] flex items-center justify-between gap-4 bg-[#111827]">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileCode2 className="w-4 h-4 text-blue-400 shrink-0" />
            <span className="font-mono text-sm text-white truncate">{filePath}</span>
            {fileData && (
              <span className="text-xs text-slate-400 font-mono shrink-0">
                · {fileData.language} · {fileData.lines}L
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void handleCopy()}
              disabled={!fileData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-white/10 text-xs text-slate-300 hover:text-white hover:bg-white/[0.04]"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/[0.06]"
              aria-label="Close source viewer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed">
          {loading ? (
            <div className="space-y-2 p-2">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div key={n} className="h-4 rounded bg-white/[0.05] animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="p-4 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300">
              {error}
            </div>
          ) : (
            <div className="rounded-lg border border-white/[0.08] bg-[#070A12] overflow-x-auto">
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
                    className={`flex px-3 py-0.5 ${
                      isHighlighted ? 'bg-blue-500/15 text-white' : 'text-slate-300 hover:bg-white/[0.02]'
                    }`}
                  >
                    <span className="w-12 pr-4 text-right select-none text-slate-600 tabular-nums shrink-0">
                      {lineNum}
                    </span>
                    <pre className="whitespace-pre font-mono">{code || ' '}</pre>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
