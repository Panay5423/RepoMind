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
import { PRIMARY_BLUE_BTN, SECONDARY_WHITE_BTN } from '../ui/PremiumPrimitives.tsx';

interface BugsTabProps {
  repositoryId: string;
  repositoryName: string;
  initialFindings: BugFindingDTO[];
  onFindingsUpdated: (findings: BugFindingDTO[]) => void;
  onOpenFile: (path: string, startLine?: number, endLine?: number) => void;
  onAskAI: (prompt: string, mode?: ChatMode) => void;
}

const SEVERITY_COLORS: Record<FindingSeverity, string> = {
  critical: 'text-[#E11D48]',
  high: 'text-[#EA580C]',
  medium: 'text-[#D97706]',
  low: 'text-[#2563EB]',
  info: 'text-[#64748B]',
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
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-2xs">
        <div>
          <h2 className="font-display text-base font-bold text-[#0B1F3A]">
            Bug Detective &amp; Security Inspection
          </h2>
          <p className="mt-1 text-xs text-[#64748B]">
            Verified static checks (regex/secret/dependency rules) are separated from AI-generated
            potential issue hypotheses.
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-[#475569]">
            <span className="tabular-nums font-semibold text-[#0F172A]">
              {staticCount} verified static checks
            </span>
            <span aria-hidden="true" className="text-[#CBD5E1]">·</span>
            <span className="tabular-nums font-semibold text-[#0F172A]">
              {aiCount} AI potential issues
            </span>
            <span aria-hidden="true" className="text-[#CBD5E1]">·</span>
            <span className="tabular-nums font-semibold text-[#E11D48]">
              {severityCounts.critical} critical
            </span>
            <span aria-hidden="true" className="text-[#CBD5E1]">·</span>
            <span className="tabular-nums font-semibold text-[#EA580C]">
              {severityCounts.high} high
            </span>
            <span aria-hidden="true" className="text-[#CBD5E1]">·</span>
            <span className="tabular-nums font-semibold text-[#D97706]">
              {severityCounts.medium} medium
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {filtered.length > 0 && (
            <button
              type="button"
              onClick={handleExportBugs}
              className={`${SECONDARY_WHITE_BTN} px-3 py-2 text-xs`}
            >
              <Download className="w-3.5 h-3.5 text-[#475569]" />
              <span>Export (.md)</span>
            </button>
          )}
          <button
            type="button"
            disabled={scanning}
            onClick={() => void handleDeepScan()}
            className={`${PRIMARY_BLUE_BTN} px-4 py-2 text-xs`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
            <span>{scanning ? 'Inspecting Codebase...' : 'Run Deep AI Scan'}</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-white border border-[#E2E8F0] shadow-2xs">
          {[
            { id: 'all', label: 'All Findings' },
            { id: 'verified_static_check', label: 'Verified Static Checks' },
            { id: 'ai_potential_issue', label: 'AI Potential Issues' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setOriginFilter(tab.id as 'all' | FindingOrigin)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                originFilter === tab.id
                  ? 'bg-[#2563EB] text-white'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-56">
            <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by file or keyword..."
              className="w-full rounded-xl border border-[#E2E8F0] bg-white pl-8 pr-3 py-2 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2563EB]"
            />
          </div>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as 'all' | FindingSeverity)}
            aria-label="Filter by severity"
            className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-medium text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
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
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-12 text-center shadow-2xs">
          <Bug className="w-8 h-8 text-[#64748B] mx-auto mb-3" />
          <p className="text-sm font-semibold text-[#0F172A]">No findings match the current filter</p>
          <p className="mt-1 text-xs text-[#64748B]">
            Try switching filters or run a deep AI inspection across high-complexity files.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filtered.map((finding) => (
            <article
              key={finding.id}
              className="rounded-2xl border border-[#E2E8F0] bg-white p-5 space-y-3 shadow-2xs hover:border-[#93C5FD] transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  {finding.origin === 'verified_static_check' ? (
                    <ShieldAlert className="w-4 h-4 text-[#E11D48] mt-0.5 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-[#D97706] mt-0.5 shrink-0" />
                  )}
                  <div>
                    <h3 className="text-sm font-bold text-[#0F172A]">{finding.title}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-mono">
                      <span className={`uppercase font-bold ${SEVERITY_COLORS[finding.severity]}`}>
                        {finding.severity}
                      </span>
                      <span className="text-[#CBD5E1]">·</span>
                      <span className="text-[#475569]">
                        {finding.origin === 'verified_static_check'
                          ? 'Verified Static Check'
                          : 'AI Potential Issue'}
                      </span>
                      <span className="text-[#CBD5E1]">·</span>
                      <span className="capitalize text-[#64748B]">{finding.category}</span>
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
                    className={`${SECONDARY_WHITE_BTN} px-2.5 py-1.5 text-xs`}
                  >
                    <MessageSquareCode className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>Ask AI Fix</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onOpenFile(finding.filePath, finding.startLine, finding.endLine)
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] hover:bg-[#DBEAFE] text-xs font-mono font-medium text-[#2563EB] transition-colors"
                  >
                    <FileCode2 className="w-3.5 h-3.5" />
                    <span>
                      {finding.filePath}
                      {finding.startLine ? `:${finding.startLine}` : ''}
                    </span>
                  </button>
                </div>
              </div>

              <p className="text-sm text-[#334155] leading-relaxed">{finding.explanation}</p>

              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5">
                <p className="text-[11px] font-semibold text-[#059669] mb-1">Suggested Fix</p>
                <p className="text-xs text-[#334155] leading-relaxed">{finding.suggestedFix}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
