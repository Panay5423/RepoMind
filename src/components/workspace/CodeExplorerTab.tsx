import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  FileCode2,
  Folder,
  MessageSquareCode,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import type { ChatMode, DirectoryNode, FileSearchMatch, RepositoryFileDTO } from '../../../shared/types.ts';
import { api } from '../../lib/api.ts';
import { useToast } from '../../context/ToastContext.tsx';

interface CodeExplorerTabProps {
  repositoryId: string;
  directoryTree: DirectoryNode[];
  files: RepositoryFileDTO[];
  initialFilePath?: string | null;
  onAskAI: (prompt: string, mode?: ChatMode) => void;
}

function ExplorerTreeNode({
  node,
  depth,
  selectedPath,
  onSelect,
}: {
  node: DirectoryNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}) {
  const [open, setOpen] = useState(depth < 1);

  if (node.type === 'file') {
    const active = selectedPath === node.path;
    return (
      <button
        type="button"
        onClick={() => onSelect(node.path)}
        className={`w-full flex items-center justify-between gap-2 py-1.5 px-2 rounded-md text-left text-xs transition-colors ${
          active
            ? 'bg-blue-600/20 text-white border border-blue-500/40'
            : 'text-slate-300 hover:bg-white/[0.04] hover:text-white'
        }`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
        <span className="flex items-center gap-2 min-w-0">
          <FileCode2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span className="font-mono truncate">{node.name}</span>
        </span>
      </button>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-1.5 py-1.5 px-2 rounded-md text-left text-xs font-medium text-slate-200 hover:bg-white/[0.04]"
        style={{ paddingLeft: `${depth * 14 + 6}px` }}
      >
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        )}
        <Folder className="w-3.5 h-3.5 text-blue-400 shrink-0" />
        <span className="font-mono truncate">{node.name}</span>
      </button>
      {open &&
        node.children?.map((child) => (
          <ExplorerTreeNode
            key={child.path}
            node={child}
            depth={depth + 1}
            selectedPath={selectedPath}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}

export function CodeExplorerTab({
  repositoryId,
  directoryTree,
  files,
  initialFilePath,
  onAskAI,
}: CodeExplorerTabProps) {
  const [sidebarMode, setSidebarMode] = useState<'files' | 'search'>('files');
  const [fileQuery, setFileQuery] = useState('');
  const [codeQuery, setCodeQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchMatches, setSearchMatches] = useState<FileSearchMatch[]>([]);

  const [selectedPath, setSelectedPath] = useState<string | null>(
    initialFilePath || files.find((f) => f.isImportant)?.path || files[0]?.path || null
  );
  const [highlightLine, setHighlightLine] = useState<number | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState('');
  const [fileContent, setFileContent] = useState<{
    path: string;
    language: string;
    lines: number;
    complexityScore: number;
    content: string;
  } | null>(null);

  const [explaining, setExplaining] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const targetLineRef = useRef<HTMLDivElement | null>(null);
  const { notify } = useToast();

  useEffect(() => {
    if (!selectedPath) return;
    let active = true;
    setFileLoading(true);
    setFileError('');
    setExplanation(null);
    api.repositories
      .fileContent(repositoryId, selectedPath)
      .then((res) => {
        if (active) setFileContent(res);
      })
      .catch((err) => {
        if (active) setFileError(err instanceof Error ? err.message : 'Unable to load file.');
      })
      .finally(() => {
        if (active) setFileLoading(false);
      });
    return () => {
      active = false;
    };
  }, [repositoryId, selectedPath]);

  useEffect(() => {
    if (highlightLine && !fileLoading && targetLineRef.current) {
      targetLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightLine, fileLoading, fileContent?.path]);

  const filteredFiles = useMemo(() => {
    const q = fileQuery.trim().toLowerCase();
    if (!q) return [];
    return files.filter((f) => f.path.toLowerCase().includes(q)).slice(0, 60);
  }, [files, fileQuery]);

  const handleCodeSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (codeQuery.trim().length < 2) return;
    setSearching(true);
    setHasSearched(true);
    try {
      const res = await api.repositories.searchCode(repositoryId, codeQuery.trim());
      setSearchMatches(res.matches);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Code search failed.', 'error');
    } finally {
      setSearching(false);
    }
  };

  const handleExplainFile = async () => {
    if (!selectedPath || explaining) return;
    setExplaining(true);
    try {
      const res = await api.repositories.explainFile(repositoryId, selectedPath);
      setExplanation(res.explanationMarkdown);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'File explanation failed.', 'error');
    } finally {
      setExplaining(false);
    }
  };

  const handleCopyFile = async () => {
    if (!fileContent) return;
    const raw = fileContent.content
      .split('\n')
      .map((l) => l.replace(/^\d+:\s?/, ''))
      .join('\n');
    await navigator.clipboard.writeText(raw);
    notify('Copied source file to clipboard.', 'success');
  };

  const lines = (fileContent?.content || '').split('\n');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 rounded-xl border border-white/[0.08] bg-[#111827] overflow-hidden min-h-[650px]">
      {/* Left Explorer / Code Search Pane */}
      <aside className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-white/[0.08] bg-[#0B0F19]/60 flex flex-col max-h-[680px]">
        <div className="p-3 border-b border-white/[0.08] space-y-2.5">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#111827] border border-white/[0.06]">
            <button
              type="button"
              onClick={() => setSidebarMode('files')}
              className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                sidebarMode === 'files' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Files ({files.length})
            </button>
            <button
              type="button"
              onClick={() => setSidebarMode('search')}
              className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                sidebarMode === 'search' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Code Search
            </button>
          </div>

          {sidebarMode === 'files' ? (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={fileQuery}
                onChange={(e) => setFileQuery(e.target.value)}
                placeholder="Filter file paths..."
                className="w-full rounded-lg border border-white/10 bg-[#111827] pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          ) : (
            <form onSubmit={handleCodeSearch} className="flex gap-2">
              <input
                type="text"
                value={codeQuery}
                onChange={(e) => setCodeQuery(e.target.value)}
                placeholder="Search symbol or text..."
                className="flex-1 rounded-lg border border-white/10 bg-[#111827] px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={searching || codeQuery.trim().length < 2}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium disabled:opacity-50"
              >
                {searching ? '...' : 'Find'}
              </button>
            </form>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {sidebarMode === 'files' ? (
            fileQuery.trim() ? (
              filteredFiles.length === 0 ? (
                <p className="p-3 text-xs text-slate-500">No file paths match "{fileQuery}".</p>
              ) : (
                <div className="space-y-1">
                  {filteredFiles.map((f) => (
                    <button
                      key={f.path}
                      type="button"
                      onClick={() => {
                        setSelectedPath(f.path);
                        setHighlightLine(null);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-md text-xs font-mono truncate transition-colors ${
                        selectedPath === f.path
                          ? 'bg-blue-600/20 text-white border border-blue-500/40'
                          : 'text-slate-300 hover:bg-white/[0.04]'
                      }`}
                    >
                      {f.path}
                    </button>
                  ))}
                </div>
              )
            ) : (
              directoryTree.map((node) => (
                <ExplorerTreeNode
                  key={node.path}
                  node={node}
                  depth={0}
                  selectedPath={selectedPath}
                  onSelect={(p) => {
                    setSelectedPath(p);
                    setHighlightLine(null);
                  }}
                />
              ))
            )
          ) : searchMatches.length === 0 ? (
            <p className="p-3 text-xs text-slate-500">
              {searching
                ? 'Searching across indexed files...'
                : hasSearched
                ? `No source lines matched "${codeQuery}".`
                : 'Enter at least 2 characters to search source lines across the repository.'}
            </p>
          ) : (
            <div className="space-y-1.5">
              <p className="px-1 text-[11px] font-mono text-slate-500 tabular-nums">
                {searchMatches.length} match{searchMatches.length === 1 ? '' : 'es'}
              </p>
              {searchMatches.map((m, idx) => (
                <button
                  key={`${m.filePath}-${m.lineNumber}-${idx}`}
                  type="button"
                  onClick={() => {
                    setSelectedPath(m.filePath);
                    setHighlightLine(m.lineNumber);
                  }}
                  className="w-full text-left p-2.5 rounded-lg border border-white/[0.06] bg-[#111827] hover:border-blue-500/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-blue-400">
                    <span className="truncate">{m.filePath}</span>
                    <span className="shrink-0 tabular-nums">L{m.lineNumber}</span>
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-slate-300 truncate">
                    {m.lineText}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Right Source Viewer + AI File Explainer */}
      <div className="lg:col-span-8 flex flex-col max-h-[680px]">
        <div className="px-5 py-3 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-3 bg-[#111827]">
          <div className="min-w-0">
            <p className="font-mono text-xs sm:text-sm text-white truncate">
              {selectedPath || 'Select a file'}
            </p>
            {fileContent && (
              <p className="text-[11px] font-mono text-slate-400 mt-0.5 tabular-nums">
                {fileContent.language} · {fileContent.lines} lines · complexity score{' '}
                {fileContent.complexityScore}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={!fileContent}
              onClick={() => void handleCopyFile()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs text-slate-300 hover:text-white hover:bg-white/[0.04] disabled:opacity-50"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </button>
            <button
              type="button"
              disabled={!selectedPath}
              onClick={() =>
                selectedPath &&
                onAskAI(`Explain the responsibilities and edge cases of \`${selectedPath}\`.`, 'qa')
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs text-slate-200 hover:text-white hover:bg-white/[0.04] disabled:opacity-50"
            >
              <MessageSquareCode className="w-3.5 h-3.5 text-blue-400" />
              <span>Ask in Chat</span>
            </button>
            <button
              type="button"
              disabled={!selectedPath || explaining}
              onClick={() => void handleExplainFile()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{explaining ? 'Explaining...' : 'Explain File'}</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-[#070A12] flex flex-col">
          {explanation && (
            <div className="m-4 rounded-xl border border-blue-500/30 bg-[#111827] p-5">
              <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-white/[0.08]">
                <span className="text-xs font-semibold text-blue-300">
                  Gemini File Analysis · {selectedPath}
                </span>
                <button
                  type="button"
                  onClick={() => setExplanation(null)}
                  className="text-slate-400 hover:text-white"
                  aria-label="Close file explanation"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="repomind-prose text-xs">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{explanation}</ReactMarkdown>
              </div>
            </div>
          )}

          {fileLoading ? (
            <div className="p-6 space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-4 rounded bg-white/[0.04] animate-pulse" />
              ))}
            </div>
          ) : fileError ? (
            <div className="p-6 text-sm text-rose-300">{fileError}</div>
          ) : !fileContent ? (
            <div className="p-12 text-center text-xs text-slate-500">
              Choose any file from the tree or search results to inspect its source code.
            </div>
          ) : (
            <div className="p-3 font-mono text-xs leading-relaxed overflow-x-auto">
              {lines.map((line, idx) => {
                const match = line.match(/^(\d+):\s?(.*)$/);
                const lineNum = match ? Number(match[1]) : idx + 1;
                const code = match ? match[2] : line;
                const isTarget = highlightLine === lineNum;
                return (
                  <div
                    key={`${lineNum}-${idx}`}
                    ref={isTarget ? targetLineRef : undefined}
                    className={`flex px-2 py-0.5 rounded ${
                      isTarget ? 'bg-blue-500/20 text-white' : 'text-slate-300 hover:bg-white/[0.02]'
                    }`}
                  >
                    <span className="w-11 pr-4 text-right select-none text-slate-600 tabular-nums shrink-0">
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
