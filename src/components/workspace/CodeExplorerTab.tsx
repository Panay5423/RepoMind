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
import { PRIMARY_BLUE_BTN, SECONDARY_WHITE_BTN } from '../ui/PremiumPrimitives.tsx';

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
        className={`w-full flex items-center justify-between gap-2 py-1.5 px-2.5 rounded-lg text-left text-xs transition-colors ${
          active
            ? 'bg-[#EFF6FF] text-[#2563EB] font-semibold border border-[#BFDBFE]'
            : 'text-[#334155] hover:bg-white hover:text-[#0F172A]'
        }`}
        style={{ paddingLeft: `${depth * 14 + 10}px` }}
      >
        <span className="flex items-center gap-2 min-w-0">
          <FileCode2
            className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-[#2563EB]' : 'text-[#64748B]'}`}
          />
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
        className="w-full flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg text-left text-xs font-semibold text-[#0F172A] hover:bg-white"
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
        )}
        <Folder className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
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
    <div className="grid grid-cols-1 lg:grid-cols-12 rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_30px_-14px_rgba(37,99,235,0.1)] overflow-hidden min-h-[650px]">
      {/* Left Explorer / Code Search Pane */}
      <aside className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-[#E2E8F0] bg-[#F8FAFC] flex flex-col max-h-[680px]">
        <div className="p-3.5 border-b border-[#E2E8F0] bg-white space-y-2.5">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <button
              type="button"
              onClick={() => setSidebarMode('files')}
              className={`py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                sidebarMode === 'files'
                  ? 'bg-white text-[#2563EB] shadow-2xs border border-[#BFDBFE]'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              Files ({files.length})
            </button>
            <button
              type="button"
              onClick={() => setSidebarMode('search')}
              className={`py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                sidebarMode === 'search'
                  ? 'bg-white text-[#2563EB] shadow-2xs border border-[#BFDBFE]'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              Code Search
            </button>
          </div>

          {sidebarMode === 'files' ? (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={fileQuery}
                onChange={(e) => setFileQuery(e.target.value)}
                placeholder="Filter file paths..."
                className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] pl-8 pr-3 py-1.5 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:bg-white focus:outline-none focus:border-[#2563EB]"
              />
            </div>
          ) : (
            <form onSubmit={handleCodeSearch} className="flex gap-2">
              <input
                type="text"
                value={codeQuery}
                onChange={(e) => setCodeQuery(e.target.value)}
                placeholder="Search symbol or text..."
                className="flex-1 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:bg-white focus:outline-none focus:border-[#2563EB]"
              />
              <button
                type="submit"
                disabled={searching || codeQuery.trim().length < 2}
                className={`${PRIMARY_BLUE_BTN} px-3 py-1.5 text-xs`}
              >
                {searching ? '...' : 'Find'}
              </button>
            </form>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2.5">
          {sidebarMode === 'files' ? (
            fileQuery.trim() ? (
              filteredFiles.length === 0 ? (
                <p className="p-3 text-xs text-[#64748B]">No file paths match &ldquo;{fileQuery}&rdquo;.</p>
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
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono truncate transition-colors ${
                        selectedPath === f.path
                          ? 'bg-[#EFF6FF] text-[#2563EB] font-semibold border border-[#BFDBFE]'
                          : 'text-[#334155] hover:bg-white'
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
            <p className="p-3 text-xs text-[#64748B]">
              {searching
                ? 'Searching across indexed files...'
                : hasSearched
                  ? `No source lines matched "${codeQuery}".`
                  : 'Enter at least 2 characters to search source lines across the repository.'}
            </p>
          ) : (
            <div className="space-y-1.5">
              <p className="px-1 text-[11px] font-mono text-[#64748B] tabular-nums">
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
                  className="w-full text-left p-2.5 rounded-xl border border-[#E2E8F0] bg-white hover:border-[#93C5FD] transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] font-mono font-semibold text-[#2563EB]">
                    <span className="truncate">{m.filePath}</span>
                    <span className="shrink-0 tabular-nums">L{m.lineNumber}</span>
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-[#334155] truncate">
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
        <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3 bg-white">
          <div className="min-w-0">
            <p className="font-mono text-xs sm:text-sm font-semibold text-[#0F172A] truncate">
              {selectedPath || 'Select a file'}
            </p>
            {fileContent && (
              <p className="text-[11px] font-mono text-[#64748B] mt-0.5 tabular-nums">
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
              className={`${SECONDARY_WHITE_BTN} px-3 py-1.5 text-xs`}
            >
              <Copy className="w-3.5 h-3.5 text-[#475569]" />
              <span>Copy</span>
            </button>
            <button
              type="button"
              disabled={!selectedPath}
              onClick={() =>
                selectedPath &&
                onAskAI(`Explain the responsibilities and edge cases of \`${selectedPath}\`.`, 'qa')
              }
              className={`${SECONDARY_WHITE_BTN} px-3 py-1.5 text-xs`}
            >
              <MessageSquareCode className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Ask in Chat</span>
            </button>
            <button
              type="button"
              disabled={!selectedPath || explaining}
              onClick={() => void handleExplainFile()}
              className={`${PRIMARY_BLUE_BTN} px-3.5 py-1.5 text-xs`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{explaining ? 'Explaining...' : 'Explain File'}</span>
            </button>
          </div>
        </div>

        {/* Deep Navy Code Viewport */}
        <div className="flex-1 overflow-auto bg-[#0B1F3A] flex flex-col">
          {explanation && (
            <div className="m-4 rounded-2xl border border-[#BFDBFE] bg-white p-5 shadow-lg">
              <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-[#E2E8F0]">
                <span className="text-xs font-semibold text-[#2563EB]">
                  Gemini File Analysis · {selectedPath}
                </span>
                <button
                  type="button"
                  onClick={() => setExplanation(null)}
                  className="text-[#64748B] hover:text-[#0F172A] p-0.5 rounded-md hover:bg-[#F8FAFC]"
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
                <div key={i} className="h-4 rounded bg-white/10 animate-pulse" />
              ))}
            </div>
          ) : fileError ? (
            <div className="p-6 text-sm text-[#FDA4AF]">{fileError}</div>
          ) : !fileContent ? (
            <div className="p-12 text-center text-xs text-[#94A3B8]">
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
                      isTarget
                        ? 'bg-[#2563EB]/30 text-white'
                        : 'text-[#E2E8F0] hover:bg-white/[0.04]'
                    }`}
                  >
                    <span className="w-11 pr-4 text-right select-none text-[#64748B] tabular-nums shrink-0">
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
