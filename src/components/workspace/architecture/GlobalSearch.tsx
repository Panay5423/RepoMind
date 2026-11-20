import { useEffect, useMemo, useRef, useState } from 'react';
import { CornerDownLeft, FileCode2, Search, X } from 'lucide-react';
import type {
  ArchitectureIntelligenceDTO,
  GraphLevel,
  GraphNodeKind,
} from '../../../../shared/types.ts';
import { NODE_KIND_META } from './graphConstants.ts';

export interface GlobalSearchResult {
  id: string;
  name: string;
  kind: GraphNodeKind;
  level: GraphLevel;
  filePath?: string;
  line?: number;
  moduleGroup?: string;
  description: string;
  inCurrentView: boolean;
  requiresCodeSlice?: boolean;
  score: number;
}

interface GlobalSearchProps {
  intelligence: ArchitectureIntelligenceDTO;
  currentLevel: GraphLevel;
  visibleNodeIds: Set<string>;
  query: string;
  onQueryChange: (query: string) => void;
  onSelectResult: (result: GlobalSearchResult) => void;
  onHighlightIdsChange?: (ids: Set<string>) => void;
}

const LEVEL_ORDER: Record<GraphLevel, number> = {
  system: 0,
  module: 1,
  file: 2,
  code: 3,
};

function HighlightedText({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const lower = text.toLowerCase();
  const qLower = q.toLowerCase();
  const idx = lower.indexOf(qLower);
  if (idx === -1) return <>{text}</>;

  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + q.length);
  const after = text.slice(idx + q.length);

  return (
    <>
      {before}
      <span className="text-amber-300 bg-amber-400/15 rounded-sm px-0.5">{match}</span>
      {after}
    </>
  );
}

export function GlobalSearch({
  intelligence,
  currentLevel,
  visibleNodeIds,
  query,
  onQueryChange,
  onSelectResult,
  onHighlightIdsChange,
}: GlobalSearchProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [levelScope, setLevelScope] = useState<'all' | GraphLevel>('all');

  // Keyboard shortcut: Cmd/Ctrl + K focuses global architecture search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
          if (e.target !== inputRef.current) return;
        }
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  // Build searchable unified index across all 4 graph levels + full symbol catalog
  const unifiedIndex = useMemo(() => {
    const seen = new Map<string, Omit<GlobalSearchResult, 'inCurrentView' | 'score'>>();

    const levels: GraphLevel[] = ['system', 'module', 'file', 'code'];
    for (const lvl of levels) {
      for (const n of intelligence.levels[lvl].nodes) {
        if (!seen.has(n.id)) {
          seen.set(n.id, {
            id: n.id,
            name: n.name,
            kind: n.kind,
            level: n.level,
            filePath: n.filePath,
            line: n.line,
            moduleGroup: n.moduleGroup,
            description: n.description,
            requiresCodeSlice: false,
          });
        }
      }
    }

    // Include symbols that may have been truncated from the default L4 graph slice
    for (const fn of intelligence.symbols.functions) {
      if (!seen.has(fn.id)) {
        seen.set(fn.id, {
          id: fn.id,
          name: fn.name,
          kind: fn.kind === 'method' ? 'method' : 'function',
          level: 'code',
          filePath: fn.filePath,
          line: fn.line,
          description: `${fn.kind} in ${fn.filePath}:${fn.line}`,
          requiresCodeSlice: true,
        });
      }
    }
    for (const cls of intelligence.symbols.classes) {
      if (!seen.has(cls.id)) {
        seen.set(cls.id, {
          id: cls.id,
          name: cls.name,
          kind: 'class',
          level: 'code',
          filePath: cls.filePath,
          line: cls.line,
          description: `Class in ${cls.filePath}:${cls.line}`,
          requiresCodeSlice: true,
        });
      }
    }
    for (const obj of intelligence.symbols.objects) {
      if (!seen.has(obj.id)) {
        seen.set(obj.id, {
          id: obj.id,
          name: obj.name,
          kind: 'object',
          level: 'code',
          filePath: obj.filePath,
          line: obj.line,
          description: `Object in ${obj.filePath}:${obj.line}`,
          requiresCodeSlice: true,
        });
      }
    }
    for (const v of intelligence.symbols.variables) {
      if (!seen.has(v.id)) {
        seen.set(v.id, {
          id: v.id,
          name: v.name,
          kind: v.kind === 'enum' ? 'type' : v.kind,
          level: 'code',
          filePath: v.filePath,
          line: v.line,
          description: `${v.kind} in ${v.filePath}:${v.line}`,
          requiresCodeSlice: true,
        });
      }
    }

    return Array.from(seen.values());
  }, [intelligence]);

  // Rank results by relevance (exact name > prefix > name substring > filePath match > current level boost)
  const { rankedResults, currentViewMatchIds } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const viewMatches = new Set<string>();
    if (!q) {
      return { rankedResults: [] as GlobalSearchResult[], currentViewMatchIds: viewMatches };
    }

    const results: GlobalSearchResult[] = [];

    for (const item of unifiedIndex) {
      const nameLower = item.name.toLowerCase();
      const pathLower = (item.filePath || '').toLowerCase();
      const modLower = (item.moduleGroup || '').toLowerCase();
      const kindLabel = (NODE_KIND_META[item.kind]?.label || item.kind).toLowerCase();

      const matchesName = nameLower.includes(q);
      const matchesPath = pathLower.includes(q);
      const matchesMod = modLower.includes(q);
      const matchesKind = kindLabel.includes(q);

      if (!matchesName && !matchesPath && !matchesMod && !matchesKind) continue;

      const inCurrentView = visibleNodeIds.has(item.id);
      if (inCurrentView) {
        viewMatches.add(item.id);
      }

      if (levelScope !== 'all' && item.level !== levelScope) continue;

      let score = 0;
      if (nameLower === q) score += 120;
      else if (nameLower.startsWith(q)) score += 90;
      else if (matchesName) score += 65;

      if (pathLower.endsWith(`/${q}`) || pathLower === q) score += 55;
      else if (matchesPath) score += 40;

      if (matchesMod) score += 20;
      if (matchesKind) score += 10;
      if (item.level === currentLevel) score += 15;
      if (inCurrentView) score += 10;

      results.push({
        ...item,
        inCurrentView,
        score,
      });
    }

    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (LEVEL_ORDER[a.level] !== LEVEL_ORDER[b.level]) {
        return LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level];
      }
      return a.name.localeCompare(b.name);
    });

    return {
      rankedResults: results.slice(0, 24),
      currentViewMatchIds: viewMatches,
    };
  }, [query, unifiedIndex, visibleNodeIds, levelScope, currentLevel]);

  // Notify canvas whenever highlighted node IDs in current view change
  useEffect(() => {
    onHighlightIdsChange?.(currentViewMatchIds);
  }, [currentViewMatchIds, onHighlightIdsChange]);

  // Reset active index when query or results change
  useEffect(() => {
    setActiveIndex(0);
  }, [query, levelScope]);

  const handleSelect = (res: GlobalSearchResult) => {
    setOpen(false);
    onSelectResult(res);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (open) {
        setOpen(false);
      } else if (query) {
        onQueryChange('');
      }
      inputRef.current?.blur();
      return;
    }

    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (rankedResults.length > 0) {
        setActiveIndex((prev) => (prev + 1) % rankedResults.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (rankedResults.length > 0) {
        setActiveIndex((prev) => (prev - 1 + rankedResults.length) % rankedResults.length);
      }
    } else if (e.key === 'Enter') {
      if (rankedResults.length > 0) {
        e.preventDefault();
        const picked = rankedResults[Math.min(activeIndex, rankedResults.length - 1)];
        if (picked) handleSelect(picked);
      }
    }
  };

  const hasQuery = query.trim().length > 0;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center">
        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open && hasQuery}
          aria-label="Search architecture nodes by name or file path"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onQueryChange(e.target.value);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search nodes or paths (⌘K)..."
          className={`w-52 sm:w-64 rounded-lg border bg-[#0B0F19] pl-8 ${
            hasQuery ? 'pr-24' : 'pr-3'
          } py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors ${
            hasQuery
              ? 'border-amber-400/50 focus:border-amber-400'
              : 'border-white/10 focus:border-blue-500'
          }`}
        />

        {hasQuery && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            <span
              className={`text-[10px] font-mono tabular-nums ${
                currentViewMatchIds.size > 0 ? 'text-amber-300' : 'text-slate-500'
              }`}
              title="Matching nodes highlighted in current view"
            >
              {currentViewMatchIds.size} in view
            </span>
            <button
              type="button"
              onClick={() => {
                onQueryChange('');
                setOpen(false);
              }}
              aria-label="Clear search"
              className="text-slate-500 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {open && hasQuery && (
        <div className="absolute right-0 mt-1.5 w-[22rem] sm:w-[26rem] rounded-xl border border-white/10 bg-[#0F172A] shadow-2xl z-50 overflow-hidden">
          {/* Level Scope Filter Bar */}
          <div className="px-3 py-2 border-b border-white/[0.08] bg-[#0B0F19]/80 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {(['all', 'system', 'module', 'file', 'code'] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setLevelScope(lvl)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase transition-colors ${
                    levelScope === lvl
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                  }`}
                >
                  {lvl === 'all' ? 'All' : lvl}
                </button>
              ))}
            </div>
            <span className="text-[10px] font-mono text-slate-500 tabular-nums">
              {rankedResults.length} hit{rankedResults.length === 1 ? '' : 's'}
            </span>
          </div>

          {rankedResults.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <FileCode2 className="w-5 h-5 text-slate-500 mx-auto mb-1.5" />
              <p className="text-xs text-slate-300">No nodes match &ldquo;{query.trim()}&rdquo;</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Try a file path, module name, function, or class.
              </p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto p-1.5 space-y-0.5">
              {rankedResults.map((res, idx) => {
                const meta = NODE_KIND_META[res.kind] || NODE_KIND_META.file;
                const Icon = meta.icon;
                const isActive = idx === activeIndex;

                return (
                  <button
                    key={`${res.level}:${res.id}`}
                    type="button"
                    onMouseEnter={() => setActiveIndex(idx)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(res);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors flex items-center justify-between gap-2.5 ${
                      isActive ? 'bg-blue-600/20 border border-blue-500/35' : 'hover:bg-white/[0.05] border border-transparent'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${meta.accentText}`} />
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-white truncate">
                          <HighlightedText text={res.name} query={query} />
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 truncate">
                          {res.filePath ? (
                            <>
                              <HighlightedText text={res.filePath} query={query} />
                              {res.line ? `:${res.line}` : ''}
                            </>
                          ) : (
                            res.description
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 text-[10px] font-mono">
                      {res.inCurrentView && (
                        <span className="text-amber-300" title="Visible in current view">
                          in view
                        </span>
                      )}
                      <span className={meta.accentText}>
                        {res.level.toUpperCase()} · {meta.label}
                      </span>
                      {isActive && <CornerDownLeft className="w-3 h-3 text-blue-300" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="px-3 py-1.5 border-t border-white/[0.06] bg-[#0B0F19]/80 flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <span>↑↓ navigate · Enter focus · Esc close</span>
            <span>Highlights live on canvas</span>
          </div>
        </div>
      )}
    </div>
  );
}
