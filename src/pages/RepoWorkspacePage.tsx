import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  Bug,
  Code2,
  Download,
  ExternalLink,
  FileText,
  Layers,
  LayoutGrid,
  MessageSquareCode,
  RefreshCw,
} from 'lucide-react';
import type {
  AnalysisDTO,
  BugFindingDTO,
  ChatMode,
  DocumentationDTO,
  RepositoryDTO,
  RepositoryFileDTO,
} from '../../shared/types.ts';
import { api } from '../lib/api.ts';
import { useToast } from '../context/ToastContext.tsx';
import { WorkspaceLayout } from '../components/WorkspaceLayout.tsx';
import { OverviewTab } from '../components/workspace/OverviewTab.tsx';
import { CodeExplorerTab } from '../components/workspace/CodeExplorerTab.tsx';
import { ChatTab, type PendingChatPrompt } from '../components/workspace/ChatTab.tsx';
import { ArchitectureTab } from '../components/workspace/ArchitectureTab.tsx';
import { BugsTab } from '../components/workspace/BugsTab.tsx';
import { DocsTab } from '../components/workspace/DocsTab.tsx';
import { HealthTab } from '../components/workspace/HealthTab.tsx';
import { CodeViewerModal } from '../components/workspace/CodeViewerModal.tsx';
import {
  PRIMARY_BLUE_BTN,
  RM_EASE,
  SECONDARY_WHITE_BTN,
  SkeletonCard,
} from '../components/ui/PremiumPrimitives.tsx';

type WorkspaceTab =
  | 'overview'
  | 'explorer'
  | 'chat'
  | 'architecture'
  | 'bugs'
  | 'docs'
  | 'health';

const VALID_TABS = new Set<WorkspaceTab>([
  'overview',
  'explorer',
  'chat',
  'architecture',
  'bugs',
  'docs',
  'health',
]);

export function RepoWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { notify } = useToast();

  const rawTab = searchParams.get('tab') as WorkspaceTab | null;
  const tabFromUrl: WorkspaceTab = rawTab && VALID_TABS.has(rawTab) ? rawTab : 'overview';
  const convParam = searchParams.get('conv');
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(tabFromUrl);
  const [pendingPrompt, setPendingPrompt] = useState<PendingChatPrompt | null>(null);

  const [repository, setRepository] = useState<RepositoryDTO | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisDTO | null>(null);
  const [files, setFiles] = useState<RepositoryFileDTO[]>([]);
  const [bugs, setBugs] = useState<BugFindingDTO[]>([]);
  const [docs, setDocs] = useState<DocumentationDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [viewerTarget, setViewerTarget] = useState<{
    path: string;
    startLine?: number;
    endLine?: number;
  } | null>(null);

  useEffect(() => {
    setActiveTab(tabFromUrl);
  }, [tabFromUrl]);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.repositories.detail(id);
      setRepository(res.repository);
      setAnalysis(res.analysis);
      setFiles(res.files);
      setBugs(res.bugs);
      setDocs(res.docs);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load repository.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (!repository) return;
    if (repository.status !== 'indexing' && repository.status !== 'analyzing') return;
    const timer = setInterval(() => {
      void loadDetail();
    }, 2000);
    return () => clearInterval(timer);
  }, [repository?.status, loadDetail]);

  const handleTabChange = (tab: WorkspaceTab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const handleAskAI = (prompt: string, mode: ChatMode = 'qa') => {
    setPendingPrompt({ text: prompt, mode, nonce: Date.now() });
    setActiveTab('chat');
    setSearchParams({ tab: 'chat' });
  };

  const handleReanalyze = async () => {
    if (!repository) return;
    try {
      await api.repositories.reanalyze(repository.id);
      notify('Restarted repository analysis.', 'info');
      void loadDetail();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Re-analysis failed.', 'error');
    }
  };

  const handleExportFullReport = () => {
    if (!repository || !analysis) return;
    const sections = [
      `# RepoMind Codebase Audit Report: ${repository.fullName}`,
      `Generated: ${new Date().toISOString()}`,
      `Primary Language: ${repository.primaryLanguage} | Files: ${repository.fileCount} | Lines: ${repository.totalLines}`,
      '',
      `## Project Overview`,
      analysis.projectOverview,
      '',
      `## Architecture Summary`,
      analysis.architectureOverview || 'N/A',
      '',
      `## Technology Stack`,
      analysis.technologyStack.map((t) => `- ${t}`).join('\n'),
      '',
      `## Important Modules`,
      analysis.importantModules
        .map(
          (m) =>
            `### ${m.name} (\`${m.path}\`)\n${m.role}\n${m.responsibilities
              .map((r) => `- ${r}`)
              .join('\n')}`
        )
        .join('\n\n'),
      '',
      `## Health Score Estimate (${analysis.healthReport.overallEstimate}/100)`,
      `> ${analysis.healthReport.disclaimer}`,
      '',
      ...analysis.healthReport.breakdown.map(
        (b) => `- **${b.category}**: ${b.score}/100 — ${b.basis} (Action: ${b.recommendation})`
      ),
      '',
      `## Bug Detective Findings (${bugs.length})`,
      ...bugs.map(
        (f) =>
          `### [${f.severity.toUpperCase()}] ${f.title}\n- Origin: ${f.origin}\n- Location: \`${
            f.filePath
          }${f.startLine ? `:${f.startLine}` : ''}\`\n- Explanation: ${
            f.explanation
          }\n- Suggested Fix: ${f.suggestedFix}`
      ),
    ];

    const blob = new Blob([sections.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${repository.name}-repomind-report.md`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Exported full Markdown audit report.', 'success');
  };

  const openFile = (path: string, startLine?: number, endLine?: number) => {
    setViewerTarget({ path, startLine, endLine });
  };

  const tabs: Array<{ id: WorkspaceTab; label: string; icon: typeof LayoutGrid }> = [
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    { id: 'explorer', label: `Code Explorer (${files.length})`, icon: Code2 },
    { id: 'chat', label: 'AI Code Chat', icon: MessageSquareCode },
    { id: 'architecture', label: 'Architecture Graph', icon: Layers },
    { id: 'bugs', label: `Bug Detective (${bugs.length})`, icon: Bug },
    { id: 'docs', label: `Documentation (${docs.length})`, icon: FileText },
    { id: 'health', label: 'Health Score', icon: Activity },
  ];

  const langPalette = [
    'bg-[#2563EB]',
    'bg-[#3B82F6]',
    'bg-[#60A5FA]',
    'bg-[#0B1F3A]',
    'bg-[#93C5FD]',
  ];
  const workspaceReady = files.length > 0 || Boolean(analysis) || repository?.status === 'completed';

  return (
    <WorkspaceLayout
      breadcrumbs={[
        { label: 'Dashboard', to: '/dashboard' },
        { label: 'Repositories', to: '/repositories' },
        { label: repository?.fullName || 'Workspace' },
      ]}
      actions={
        repository && (
          <div className="flex items-center gap-2">
            {analysis && (
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={handleExportFullReport}
                className={`${SECONDARY_WHITE_BTN} h-9 px-3 text-[12px]`}
              >
                <Download className="w-3.5 h-3.5 text-[#475569]" />
                <span className="hidden sm:inline">Export Report</span>
              </motion.button>
            )}
            {repository.githubUrl && (
              <motion.a
                whileTap={{ scale: 0.97 }}
                href={repository.githubUrl}
                target="_blank"
                rel="noreferrer"
                className={`${SECONDARY_WHITE_BTN} h-9 px-3 text-[12px]`}
              >
                <ExternalLink className="w-3.5 h-3.5 text-[#475569]" />
                <span className="hidden sm:inline">GitHub</span>
              </motion.a>
            )}
            <motion.button
              type="button"
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => void handleReanalyze()}
              className={`${PRIMARY_BLUE_BTN} h-9 px-3.5 text-[12px]`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Re-analyze</span>
            </motion.button>
          </div>
        )
      }
    >
      {loading ? (
        <div className="space-y-4">
          <SkeletonCard className="h-28" />
          <SkeletonCard className="h-96" />
        </div>
      ) : error || !repository ? (
        <div className="rounded-2xl border border-[#FECDD3] bg-white p-8 text-center shadow-2xs">
          <p className="text-[14px] font-semibold text-[#E11D48]">{error || 'Repository not found.'}</p>
          <button
            type="button"
            onClick={() => navigate('/repositories')}
            className={`${SECONDARY_WHITE_BTN} mt-4 h-9 px-4 text-[12px]`}
          >
            Back to Repositories
          </button>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: RM_EASE }}
          className="space-y-6"
        >
          {/* Header Metadata Bar + Language Ratio Strip */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 space-y-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_-12px_rgba(37,99,235,0.08)]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-bold tracking-tight text-[#0B1F3A]">
                  {repository.fullName}
                </h1>
                <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-[12px] text-[#64748B] font-mono">
                  <span className="text-[#0F172A] font-semibold">{repository.primaryLanguage}</span>
                  <span aria-hidden="true" className="text-[#CBD5E1]">·</span>
                  <span className="tabular-nums">{repository.fileCount} files</span>
                  <span aria-hidden="true" className="text-[#CBD5E1]">·</span>
                  <span className="tabular-nums">{repository.totalLines.toLocaleString()} lines</span>
                  {analysis && (
                    <>
                      <span aria-hidden="true" className="text-[#CBD5E1]">·</span>
                      <span className="tabular-nums">{analysis.dependencies.length} deps</span>
                    </>
                  )}
                  {typeof repository.healthScore === 'number' && (
                    <>
                      <span aria-hidden="true" className="text-[#CBD5E1]">·</span>
                      <span className="text-[#059669] font-semibold tabular-nums">
                        Health estimate: {repository.healthScore}/100
                      </span>
                    </>
                  )}
                </div>
              </div>
              {repository.description && (
                <p className="text-[13px] text-[#475569] max-w-md">{repository.description}</p>
              )}
            </div>

            {repository.languages.length > 0 && (
              <div className="space-y-2 pt-1">
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.4, ease: RM_EASE }}
                  className="h-2 w-full rounded-full bg-[#F1F5F9] overflow-hidden flex origin-left"
                >
                  {repository.languages.slice(0, 5).map((lang, idx) => (
                    <div
                      key={lang.language}
                      className={langPalette[idx % langPalette.length]}
                      style={{ width: `${Math.max(lang.percentage, 2)}%` }}
                      title={`${lang.language}: ${lang.percentage}%`}
                    />
                  ))}
                </motion.div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-[#64748B]">
                  {repository.languages.slice(0, 5).map((lang, idx) => (
                    <span key={lang.language} className="inline-flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-xs ${langPalette[idx % langPalette.length]}`}
                      />
                      <span>
                        {lang.language} {lang.percentage}%
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Active Processing Progress */}
          {(repository.status === 'indexing' || repository.status === 'analyzing') && (
            <div className="rounded-2xl border border-[#BFDBFE] bg-white p-5 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between text-[12px]">
                <span className="font-semibold text-[#2563EB]">{repository.progressStage}</span>
                <span className="font-mono font-semibold text-[#0F172A] tabular-nums">
                  {repository.progress}%
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-[#EFF6FF] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#2563EB] to-[#60A5FA] transition-all duration-300"
                  style={{ width: `${repoProgressClamp(repository.progress)}%` }}
                />
              </div>
            </div>
          )}

          {repository.status === 'failed' && (
            <div className="rounded-2xl border border-[#FECDD3] bg-[#FFF1F2] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-[14px] font-semibold text-[#E11D48]">Analysis failed</p>
                <p className="text-[12px] text-[#9F1239] mt-1">
                  {repository.errorMessage || 'An unexpected error occurred during indexing.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleReanalyze()}
                className="h-9 px-4 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-white text-[12px] font-semibold shrink-0 transition-colors"
              >
                Retry Analysis
              </button>
            </div>
          )}

          {/* Workspace Tab Bar */}
          <div className="border-b border-[#E2E8F0] overflow-x-auto bg-white rounded-t-2xl px-2 shadow-2xs">
            <nav className="flex items-center gap-1 min-w-max" aria-label="Workspace modules">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleTabChange(tab.id)}
                    className={`relative inline-flex items-center gap-2 px-4 py-3.5 text-[12px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      active ? 'text-[#2563EB]' : 'text-[#64748B] hover:text-[#0F172A]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#2563EB]' : 'text-[#64748B]'}`} />
                    <span>{tab.label}</span>
                    {active && (
                      <motion.span
                        layoutId="workspace-active-tab-line"
                        transition={{ duration: 0.18, ease: RM_EASE }}
                        className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-[#2563EB]"
                      />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tab Viewports with smooth AnimatePresence transitions */}
          {!workspaceReady ? (
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-12 text-center text-[13px] text-[#64748B]">
              Indexing source files and building repository tree...
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16, ease: RM_EASE }}
              >
                {activeTab === 'overview' && analysis && (
                  <OverviewTab
                    repository={repository}
                    analysis={analysis}
                    files={files}
                    onOpenFile={(p) => openFile(p)}
                  />
                )}
                {activeTab === 'explorer' && (
                  <CodeExplorerTab
                    repositoryId={repository.id}
                    directoryTree={analysis?.directoryTree || []}
                    files={files}
                    onAskAI={handleAskAI}
                  />
                )}
                {activeTab === 'chat' && (
                  <ChatTab
                    repositoryId={repository.id}
                    repositoryName={repository.fullName}
                    initialConversationId={convParam}
                    pendingPrompt={pendingPrompt}
                    onOpenFile={openFile}
                  />
                )}
                {activeTab === 'architecture' && (
                  <ArchitectureTab
                    repositoryId={repository.id}
                    repositoryName={repository.fullName}
                    onOpenFile={openFile}
                    onAskAI={handleAskAI}
                  />
                )}
                {activeTab === 'bugs' && (
                  <BugsTab
                    repositoryId={repository.id}
                    repositoryName={repository.fullName}
                    initialFindings={bugs}
                    onFindingsUpdated={setBugs}
                    onOpenFile={openFile}
                    onAskAI={handleAskAI}
                  />
                )}
                {activeTab === 'docs' && (
                  <DocsTab
                    repositoryId={repository.id}
                    repositoryName={repository.fullName}
                    initialDocs={docs}
                    onDocsUpdated={setDocs}
                  />
                )}
                {activeTab === 'health' && analysis && (
                  <HealthTab report={analysis.healthReport} />
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </motion.div>
      )}

      <CodeViewerModal
        repositoryId={id || ''}
        filePath={viewerTarget?.path || null}
        highlightStart={viewerTarget?.startLine}
        highlightEnd={viewerTarget?.endLine}
        onClose={() => setViewerTarget(null)}
      />
    </WorkspaceLayout>
  );
}

function repoProgressClamp(value: number): number {
  return Math.max(0, Math.min(100, value || 0));
}
