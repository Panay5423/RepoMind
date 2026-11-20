import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Activity,
  Bug,
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
  DocumentationDTO,
  RepositoryDTO,
  RepositoryFileDTO,
} from '../../shared/types.ts';
import { api } from '../lib/api.ts';
import { useToast } from '../context/ToastContext.tsx';
import { WorkspaceLayout } from '../components/WorkspaceLayout.tsx';
import { OverviewTab } from '../components/workspace/OverviewTab.tsx';
import { ChatTab } from '../components/workspace/ChatTab.tsx';
import { ArchitectureTab } from '../components/workspace/ArchitectureTab.tsx';
import { BugsTab } from '../components/workspace/BugsTab.tsx';
import { DocsTab } from '../components/workspace/DocsTab.tsx';
import { HealthTab } from '../components/workspace/HealthTab.tsx';
import { CodeViewerModal } from '../components/workspace/CodeViewerModal.tsx';

type WorkspaceTab = 'overview' | 'chat' | 'architecture' | 'bugs' | 'docs' | 'health';

export function RepoWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { notify } = useToast();

  const tabParam = (searchParams.get('tab') || 'overview') as WorkspaceTab;
  const convParam = searchParams.get('conv');
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(tabParam);

  const [repository, setRepository] = useState<RepositoryDTO | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisDTO | null>(null);
  const [files, setFiles] = useState<RepositoryFileDTO[]>([]);
  const [bugs, setBugs] = useState<BugFindingDTO[]>([]);
  const [docs, setDocs] = useState<DocumentationDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Source Code Viewer Modal
  const [viewerTarget, setViewerTarget] = useState<{
    path: string;
    startLine?: number;
    endLine?: number;
  } | null>(null);

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
    void loadDetail();
  }, [loadDetail]);

  // Poll while indexing/analyzing
  useEffect(() => {
    if (!repository) return;
    if (repository.status !== 'indexing' && repository.status !== 'analyzing') return;
    const timer = setInterval(() => {
      void loadDetail();
    }, 2200);
    return () => clearInterval(timer);
  }, [repository?.status, loadDetail]);

  const handleTabChange = (tab: WorkspaceTab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
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

  const openFile = (path: string, startLine?: number, endLine?: number) => {
    setViewerTarget({ path, startLine, endLine });
  };

  const tabs: Array<{ id: WorkspaceTab; label: string; icon: typeof LayoutGrid }> = [
    { id: 'overview', label: 'Overview & Files', icon: LayoutGrid },
    { id: 'chat', label: 'AI Code Chat', icon: MessageSquareCode },
    { id: 'architecture', label: 'Architecture Graph', icon: Layers },
    { id: 'bugs', label: `Bug Detective (${bugs.length})`, icon: Bug },
    { id: 'docs', label: 'Documentation', icon: FileText },
    { id: 'health', label: 'Health Score', icon: Activity },
  ];

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
            {repository.githubUrl && (
              <a
                href={repository.githubUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs text-slate-300 hover:text-white hover:bg-white/[0.04] whitespace-nowrap"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">GitHub</span>
              </a>
            )}
            <button
              type="button"
              onClick={() => void handleReanalyze()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs font-medium text-slate-200 hover:bg-white/[0.04] whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Re-analyze</span>
            </button>
          </div>
        )
      }
    >
      {loading ? (
        <div className="space-y-4">
          <div className="h-24 rounded-xl border border-white/[0.08] bg-[#111827] animate-pulse" />
          <div className="h-96 rounded-xl border border-white/[0.08] bg-[#111827] animate-pulse" />
        </div>
      ) : error || !repository ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-8 text-center">
          <p className="text-sm font-medium text-rose-300">{error || 'Repository not found.'}</p>
          <button
            type="button"
            onClick={() => navigate('/repositories')}
            className="mt-4 px-4 py-2 rounded-lg bg-[#111827] text-xs font-medium text-white border border-white/10"
          >
            Back to Repositories
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header Metadata Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-white">
                {repository.fullName}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2.5 text-xs text-slate-400 font-mono">
                <span>{repository.primaryLanguage}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{repository.fileCount} files</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{repository.totalLines.toLocaleString()} lines</span>
                {typeof repository.healthScore === 'number' && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-slate-200 tabular-nums">
                      Health estimate: {repository.healthScore}/100
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Active Processing Progress */}
          {(repository.status === 'indexing' || repository.status === 'analyzing') && (
            <div className="rounded-xl border border-blue-500/30 bg-[#111827] p-5 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-blue-300">{repository.progressStage}</span>
                <span className="font-mono text-slate-300 tabular-nums">
                  {repository.progress}%
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-[#0B0F19] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all duration-300"
                  style={{ width: `${repository.progress}%` }}
                />
              </div>
            </div>
          )}

          {repository.status === 'failed' && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-rose-300">Analysis failed</p>
                <p className="text-xs text-rose-200/80 mt-1">
                  {repository.errorMessage || 'An unexpected error occurred during indexing.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleReanalyze()}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shrink-0"
              >
                Retry Analysis
              </button>
            </div>
          )}

          {/* Workspace Tab Bar */}
          <div className="border-b border-white/[0.08] overflow-x-auto">
            <nav className="flex items-center gap-1 min-w-max" aria-label="Workspace modules">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleTabChange(tab.id)}
                    className={`inline-flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'border-blue-500 text-white'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tab Viewports */}
          {!analysis && repository.status !== 'completed' ? (
            <div className="rounded-xl border border-white/[0.08] bg-[#111827] p-12 text-center text-sm text-slate-400">
              Waiting for repository indexing and Gemini architectural analysis to complete...
            </div>
          ) : (
            <>
              {activeTab === 'overview' && analysis && (
                <OverviewTab
                  repository={repository}
                  analysis={analysis}
                  files={files}
                  onOpenFile={(p) => openFile(p)}
                />
              )}
              {activeTab === 'chat' && (
                <ChatTab
                  repositoryId={repository.id}
                  repositoryName={repository.fullName}
                  initialConversationId={convParam}
                  onOpenFile={openFile}
                />
              )}
              {activeTab === 'architecture' && analysis && (
                <ArchitectureTab
                  graph={analysis.architectureGraph}
                  onOpenFile={(p) => openFile(p)}
                />
              )}
              {activeTab === 'bugs' && (
                <BugsTab
                  repositoryId={repository.id}
                  initialFindings={bugs}
                  onFindingsUpdated={setBugs}
                  onOpenFile={openFile}
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
            </>
          )}
        </div>
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
