import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
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
      <span className="text-[#B45309] bg-[#FEF3C7] font-semibold rounded-sm px-0.5">{match}</span>
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

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

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

  useEffect(() => {
    onHighlightIdsChange?.(currentViewMatchIds);
  }, [currentViewMatchIds, onHighlightIdsChange]);

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
        <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
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
          placeholder="Search nodes or paths..."
          className={`h-8 w-52 sm:w-64 rounded-xl border bg-white pl-8 ${
            hasQuery ? 'pr-24' : 'pr-10'
          } text-xs text-[#0F172A] placeholder-[#64748B] focus:outline-none transition-all duration-150 ${
            hasQuery
              ? 'border-[#F59E0B] ring-2 ring-[#F59E0B]/15'
              : 'border-[#E2E8F0] hover:border-[#93C5FD] focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15'
          }`}
        />

        {!hasQuery ? (
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[#64748B] bg-[#F8FAFC] border border-[#E2E8F0] px-1.5 py-0.2 rounded">
            ⌘K
          </span>
        ) : (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            <span
              className={`text-[10px] font-mono tabular-nums font-medium ${
                currentViewMatchIds.size > 0 ? 'text-[#D97706]' : 'text-[#64748B]'
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
              className="text-[#64748B] hover:text-[#0F172A] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {open && hasQuery && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.985 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 sm:left-auto sm:right-0 mt-1.5 w-[22rem] sm:w-[27rem] rounded-2xl border border-[#E2E8F0] bg-white shadow-2xl shadow-[#0B1F3A]/12 z-50 overflow-hidden"
          >
            {/* Level Scope Filter Bar */}
            <div className="px-3 py-2 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                {(['all', 'system', 'module', 'file', 'code'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setLevelScope(lvl)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono capitalize transition-colors ${
                      levelScope === lvl
                        ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] font-semibold'
                        : 'text-[#64748B] hover:text-[#0F172A] hover:bg-white border border-transparent'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
              <span className="text-[10px] font-mono text-[#64748B] tabular-nums">
                {rankedResults.length} hit{rankedResults.length === 1 ? '' : 's'}
              </span>
            </div>

            {rankedResults.length === 0 ? (
              <div className="px-4 py-7 text-center">
                <FileCode2 className="w-5 h-5 text-[#64748B] mx-auto mb-2" />
                <p className="text-xs font-medium text-[#0F172A]">
                  No nodes match &ldquo;{query.trim()}&rdquo;
                </p>
                <p className="text-[11px] text-[#64748B] mt-0.5">
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
                      className={`w-full text-left px-2.5 py-2 rounded-xl transition-colors flex items-center justify-between gap-2.5 border ${
                        isActive
                          ? 'bg-[#EFF6FF] border-[#BFDBFE]'
                          : 'hover:bg-[#F8FAFC] border-transparent'
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span
                          className={`w-5 h-5 rounded-md ${meta.iconBg} flex items-center justify-center mt-0.5 shrink-0`}
                        >
                          <Icon className={`w-3 h-3 ${meta.accentText}`} />
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[#0F172A] truncate">
                            <HighlightedText text={res.name} query={query} />
                          </div>
                          <div className="text-[10.5px] font-mono text-[#64748B] truncate">
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
                          <span className="text-[#D97706] font-medium" title="Visible in current view">
                            in view
                          </span>
                        )}
                        <span className="text-[#64748B]">
                          {res.level} · <span className={meta.accentText}>{meta.label}</span>
                        </span>
                        {isActive && <CornerDownLeft className="w-3 h-3 text-[#2563EB]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="px-3 py-1.5 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between text-[10px] text-[#64748B] font-mono">
              <span>↑↓ navigate · Enter focus · Esc close</span>
              <span>Live canvas highlight</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
