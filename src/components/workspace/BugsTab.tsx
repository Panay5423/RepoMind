import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Bug,
  Download,
  FileCode2,
  MessageSquareCode,
  RefreshCw,
  Search,
  ShieldAlert,
} from 'lucide-react';
import type {
  BugFindingDTO,
  ChatMode,
  FindingOrigin,
  FindingSeverity,
} from '../../../shared/types.ts';
import { api } from '../../lib/api.ts';
import { useToast } from '../../context/ToastContext.tsx';

interface BugsTabProps {
  repositoryId: string;
  repositoryName: string;
  initialFindings: BugFindingDTO[];
  onFindingsUpdated: (findings: BugFindingDTO[]) => void;
  onOpenFile: (path: string, startLine?: number, endLine?: number) => void;
  onAskAI: (prompt: string, mode?: ChatMode) => void;
}

const SEVERITY_COLORS: Record<FindingSeverity, string> = {
  critical: 'text-rose-400',
  high: 'text-orange-400',
  medium: 'text-amber-400',
  low: 'text-blue-400',
  info: 'text-slate-400',
};

export function BugsTab({
  repositoryId,
  repositoryName,
  initialFindings,
  onFindingsUpdated,
  onOpenFile,
  onAskAI,
}: BugsTabProps) {
  const [originFilter, setOriginFilter] = useState<'all' | FindingOrigin>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | FindingSeverity>('all');
  const [query, setQuery] = useState('');
  const [scanning, setScanning] = useState(false);
  const { notify } = useToast();

  const handleDeepScan = async () => {
    setScanning(true);
    try {
      const res = await api.bugs.scan(repositoryId);
      onFindingsUpdated(res.findings);
      notify(`Inspection complete: ${res.findings.length} total findings.`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Bug scan failed.', 'error');
    } finally {
      setScanning(false);
    }
  };

  const severityCounts = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const f of initialFindings) {
      if (f.severity in counts) {
        counts[f.severity as keyof typeof counts] += 1;
      }
    }
    return counts;
  }, [initialFindings]);

  const filtered = initialFindings.filter((f) => {
    const matchOrigin = originFilter === 'all' || f.origin === originFilter;
    const matchSeverity = severityFilter === 'all' || f.severity === severityFilter;
    const q = query.trim().toLowerCase();
    const matchQuery =
      !q ||
      f.title.toLowerCase().includes(q) ||
      f.filePath.toLowerCase().includes(q) ||
      f.explanation.toLowerCase().includes(q);
    return matchOrigin && matchSeverity && matchQuery;
  });

  const staticCount = initialFindings.filter((f) => f.origin === 'verified_static_check').length;
  const aiCount = initialFindings.filter((f) => f.origin === 'ai_potential_issue').length;

  const handleExportBugs = () => {
    if (filtered.length === 0) return;
    const md = [
      `# Bug Detective Report — ${repositoryName}`,
      `Generated: ${new Date().toISOString()}`,
      `Findings included: ${filtered.length} (${staticCount} verified static checks, ${aiCount} AI potential issues)`,
      '',
      ...filtered.map(
        (f) =>
          `## [${f.severity.toUpperCase()}] ${f.title}\n- **Origin**: ${
            f.origin === 'verified_static_check' ? 'Verified Static Check' : 'AI Potential Issue'
          }\n- **Category**: ${f.category}\n- **Location**: \`${f.filePath}${
            f.startLine ? `:${f.startLine}` : ''
          }\`\n\n${f.explanation}\n\n**Suggested Fix:** ${f.suggestedFix}`
      ),
    ].join('\n\n---\n\n');

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${repositoryName.replace(/[^a-z0-9_-]+/gi, '-')}-bugs.md`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Exported findings as Markdown.', 'success');
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/[0.08] bg-[#111827] p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-base font-semibold text-white">
            Bug Detective & Security Inspection
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Verified static checks (regex/secret/dependency rules) are separated from AI-generated
            potential issue hypotheses.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-slate-400">
            <span className="tabular-nums text-slate-200">{staticCount} verified static checks</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums text-slate-200">{aiCount} AI potential issues</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums text-rose-400">{severityCounts.critical} critical</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums text-orange-400">{severityCounts.high} high</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums text-amber-400">{severityCounts.medium} medium</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {filtered.length > 0 && (
            <button
              type="button"
              onClick={handleExportBugs}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 text-xs text-slate-300 hover:text-white hover:bg-white/[0.04] whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export (.md)</span>
            </button>
          )}
          <button
            type="button"
            disabled={scanning}
            onClick={() => void handleDeepScan()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors disabled:opacity-60 whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
            <span>{scanning ? 'Inspecting Codebase...' : 'Run Deep AI Scan'}</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#111827] border border-white/[0.08]">
          {[
            { id: 'all', label: 'All Findings' },
            { id: 'verified_static_check', label: 'Verified Static Checks' },
            { id: 'ai_potential_issue', label: 'AI Potential Issues' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setOriginFilter(tab.id as 'all' | FindingOrigin)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                originFilter === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-56">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by file or keyword..."
              className="w-full rounded-lg border border-white/10 bg-[#111827] pl-8 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as 'all' | FindingSeverity)}
            aria-label="Filter by severity"
            className="rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="info">Info</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-white/[0.08] bg-[#111827] p-12 text-center">
          <Bug className="w-8 h-8 text-slate-500 mx-auto mb-3" />
          <p className="text-sm font-medium text-white">No findings match the current filter</p>
          <p className="mt-1 text-xs text-slate-400">
            Try switching filters or run a deep AI inspection across high-complexity files.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((finding) => (
            <article
              key={finding.id}
              className="rounded-xl border border-white/[0.08] bg-[#111827] p-5 space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  {finding.origin === 'verified_static_check' ? (
                    <ShieldAlert className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <h3 className="text-sm font-semibold text-white">{finding.title}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-mono">
                      <span className={`uppercase font-semibold ${SEVERITY_COLORS[finding.severity]}`}>
                        {finding.severity}
                      </span>
                      <span className="text-slate-600">·</span>
                      <span className="text-slate-300">
                        {finding.origin === 'verified_static_check'
                          ? 'Verified Static Check'
                          : 'AI Potential Issue'}
                      </span>
                      <span className="text-slate-600">·</span>
                      <span className="capitalize text-slate-400">{finding.category}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      onAskAI(
                        `How should I fix the ${finding.severity} issue "${finding.title}" in \`${finding.filePath}\`${
                          finding.startLine ? ` near line ${finding.startLine}` : ''
                        }? Provide a refactored snippet.`,
                        'refactor'
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-white/10 bg-[#0B0F19] hover:border-blue-500/40 text-xs text-slate-200 hover:text-white"
                  >
                    <MessageSquareCode className="w-3.5 h-3.5 text-blue-400" />
                    <span>Ask AI Fix</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onOpenFile(finding.filePath, finding.startLine, finding.endLine)
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-white/10 bg-[#0B0F19] hover:border-blue-500/40 text-xs font-mono text-blue-300"
                  >
                    <FileCode2 className="w-3.5 h-3.5" />
                    <span>
                      {finding.filePath}
                      {finding.startLine ? `:${finding.startLine}` : ''}
                    </span>
                  </button>
                </div>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed">{finding.explanation}</p>

              <div className="rounded-lg border border-white/[0.06] bg-[#0B0F19] p-3.5">
                <p className="text-[11px] font-medium text-emerald-400 mb-1">Suggested Fix</p>
                <p className="text-xs text-slate-300 leading-relaxed">{finding.suggestedFix}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
