import { useMemo, useState } from 'react';
import { Box, Braces, Crosshair, ExternalLink, Search, Sliders, Variable } from 'lucide-react';
import type { ArchitectureIntelligenceDTO } from '../../../../shared/types.ts';

interface SymbolExplorerPanelProps {
  intelligence: ArchitectureIntelligenceDTO;
  initialSearch?: string;
  onOpenFile: (path: string, startLine?: number, endLine?: number) => void;
  onLocateSymbolInGraph: (symbolId: string, filePath: string) => void;
}

type SymbolCategory = 'functions' | 'classes' | 'objects' | 'variables';

export function SymbolExplorerPanel({
  intelligence,
  initialSearch = '',
  onOpenFile,
  onLocateSymbolInGraph,
}: SymbolExplorerPanelProps) {
  const [category, setCategory] = useState<SymbolCategory>('functions');
  const [query, setQuery] = useState(initialSearch);
  const [exportedOnly, setExportedOnly] = useState(false);

  const q = query.trim().toLowerCase();

  const filteredFunctions = useMemo(
    () =>
      intelligence.symbols.functions.filter((f) => {
        if (exportedOnly && !f.exported) return false;
        if (!q) return true;
        return f.name.toLowerCase().includes(q) || f.filePath.toLowerCase().includes(q);
      }),
    [intelligence.symbols.functions, exportedOnly, q]
  );

  const filteredClasses = useMemo(
    () =>
      intelligence.symbols.classes.filter((c) => {
        if (exportedOnly && !c.exported) return false;
        if (!q) return true;
        return c.name.toLowerCase().includes(q) || c.filePath.toLowerCase().includes(q);
      }),
    [intelligence.symbols.classes, exportedOnly, q]
  );

  const filteredObjects = useMemo(
    () =>
      intelligence.symbols.objects.filter((o) => {
        if (exportedOnly && !o.exported) return false;
        if (!q) return true;
        return o.name.toLowerCase().includes(q) || o.filePath.toLowerCase().includes(q);
      }),
    [intelligence.symbols.objects, exportedOnly, q]
  );

  const filteredVariables = useMemo(
    () =>
      intelligence.symbols.variables.filter((v) => {
        if (exportedOnly && !v.exported) return false;
        if (!q) return true;
        return v.name.toLowerCase().includes(q) || v.filePath.toLowerCase().includes(q);
      }),
    [intelligence.symbols.variables, exportedOnly, q]
  );

  const tabs: Array<{ id: SymbolCategory; label: string; count: number; icon: typeof Braces }> = [
    { id: 'functions', label: 'Functions & Hooks', count: filteredFunctions.length, icon: Braces },
    { id: 'classes', label: 'Classes', count: filteredClasses.length, icon: Box },
    { id: 'objects', label: 'Objects', count: filteredObjects.length, icon: Sliders },
    { id: 'variables', label: 'Variables & Types', count: filteredVariables.length, icon: Variable },
  ];

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#111827] overflow-hidden">
      {/* Controls Header */}
      <div className="p-4 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-3 bg-[#0B0F19]/40">
        <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#0B0F19] border border-white/[0.08]">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = category === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setCategory(t.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  active ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
                <span className="font-mono text-[11px] opacity-80 tabular-nums">({t.count})</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={exportedOnly}
              onChange={(e) => setExportedOnly(e.target.checked)}
              className="rounded border-white/20 bg-[#0B0F19] text-blue-500"
            />
            <span>Exported only</span>
          </label>
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter symbol or file path..."
              className="w-full rounded-lg border border-white/10 bg-[#0B0F19] pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Results List */}
      <div className="p-4 max-h-[600px] overflow-y-auto space-y-3">
        {category === 'functions' &&
          (filteredFunctions.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">No matching functions detected.</p>
          ) : (
            filteredFunctions.slice(0, 80).map((fn) => (
              <div
                key={fn.id}
                className="rounded-lg border border-white/[0.07] bg-[#0B0F19] p-4 space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-white">
                        {fn.isAsync ? 'async ' : ''}
                        {fn.name}(
                        {fn.parameters.map((p) => `${p.name}${p.type ? `: ${p.type}` : ''}`).join(', ')}
                        ){fn.returnType ? `: ${fn.returnType}` : ''}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono">
                      <span>{fn.kind}</span>
                      <span>·</span>
                      <span>{fn.exported ? 'exported' : 'internal'}</span>
                      <span>·</span>
                      <button
                        type="button"
                        onClick={() => onOpenFile(fn.filePath, fn.line, fn.endLine)}
                        className="text-blue-400 hover:underline"
                      >
                        {fn.filePath}:{fn.line}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onLocateSymbolInGraph(fn.id, fn.filePath)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-white/10 text-xs text-slate-300 hover:text-white hover:border-blue-500/40"
                    >
                      <Crosshair className="w-3 h-3 text-blue-400" />
                      <span>Locate</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenFile(fn.filePath, fn.line, fn.endLine)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-white/10 text-xs text-slate-300 hover:text-white"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Source</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-white/[0.06] text-xs">
                  <div>
                    <div className="text-slate-500 mb-1">Calls ({fn.calls.length})</div>
                    <div className="font-mono text-slate-300 break-words">
                      {fn.calls.length > 0 ? fn.calls.slice(0, 8).join(', ') : 'None'}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 mb-1">Called By ({fn.calledBy.length})</div>
                    <div className="font-mono text-slate-300 break-words">
                      {fn.calledBy.length > 0 ? fn.calledBy.slice(0, 8).join(', ') : 'No static callers'}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 mb-1">
                      Variables &amp; Deps ({fn.variablesUsed.length})
                    </div>
                    <div className="font-mono text-slate-400 break-words">
                      {fn.variablesUsed.length > 0
                        ? fn.variablesUsed.slice(0, 10).join(', ')
                        : 'None'}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ))}

        {category === 'classes' &&
          (filteredClasses.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">No classes detected in repository.</p>
          ) : (
            filteredClasses.slice(0, 80).map((cls) => (
              <div
                key={cls.id}
                className="rounded-lg border border-white/[0.07] bg-[#0B0F19] p-4 space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-mono text-sm font-semibold text-amber-300">
                      class {cls.name}
                      {cls.extendsClass ? ` extends ${cls.extendsClass}` : ''}
                      {cls.implementsInterfaces.length > 0
                        ? ` implements ${cls.implementsInterfaces.join(', ')}`
                        : ''}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono">
                      <span>{cls.exported ? 'exported' : 'internal'}</span>
                      {cls.decorators.length > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-violet-300">@{cls.decorators.join(' @')}</span>
                        </>
                      )}
                      <span>·</span>
                      <button
                        type="button"
                        onClick={() => onOpenFile(cls.filePath, cls.line, cls.endLine)}
                        className="text-blue-400 hover:underline"
                      >
                        {cls.filePath}:{cls.line}
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onLocateSymbolInGraph(cls.id, cls.filePath)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-white/10 text-xs text-slate-300 hover:text-white hover:border-blue-500/40"
                  >
                    <Crosshair className="w-3 h-3 text-blue-400" />
                    <span>Locate</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-white/[0.06] text-xs">
                  <div>
                    <div className="text-slate-500 mb-1">Properties ({cls.properties.length})</div>
                    <div className="font-mono text-slate-300">
                      {cls.properties.length > 0
                        ? cls.properties.map((p) => `${p.name}${p.type ? `: ${p.type}` : ''}`).join(', ')
                        : 'None'}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 mb-1">
                      Constructor ({cls.constructorParams.length})
                    </div>
                    <div className="font-mono text-slate-300">
                      {cls.constructorParams.length > 0
                        ? cls.constructorParams
                            .map((p) => `${p.name}${p.type ? `: ${p.type}` : ''}`)
                            .join(', ')
                        : 'Default'}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 mb-1">Methods ({cls.methods.length})</div>
                    <div className="font-mono text-slate-300">
                      {cls.methods.length > 0 ? cls.methods.join(', ') : 'None'}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ))}

        {category === 'objects' &&
          (filteredObjects.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">No object literals detected.</p>
          ) : (
            filteredObjects.slice(0, 80).map((obj) => (
              <div
                key={obj.id}
                className="rounded-lg border border-white/[0.07] bg-[#0B0F19] p-4 space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-mono text-sm font-semibold text-teal-300">{obj.name}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono">
                      <span>{obj.exported ? 'exported' : 'module-local'}</span>
                      <span>·</span>
                      <button
                        type="button"
                        onClick={() => onOpenFile(obj.createdAt.filePath, obj.createdAt.line)}
                        className="text-blue-400 hover:underline"
                      >
                        Created at {obj.createdAt.filePath}:{obj.createdAt.line}
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onLocateSymbolInGraph(obj.id, obj.filePath)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-white/10 text-xs text-slate-300 hover:text-white"
                  >
                    <Crosshair className="w-3 h-3 text-blue-400" />
                    <span>Locate</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-white/[0.06] text-xs">
                  <div>
                    <div className="text-slate-500 mb-1">Properties ({obj.properties.length})</div>
                    <div className="font-mono text-slate-300">
                      {obj.properties.join(', ') || 'None'}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 mb-1">Methods ({obj.methods.length})</div>
                    <div className="font-mono text-slate-300">
                      {obj.methods.join(', ') || 'None'}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 mb-1">References ({obj.references.length})</div>
                    <div className="font-mono text-slate-400 space-y-0.5">
                      {obj.references.slice(0, 4).map((r, i) => (
                        <button
                          key={`${r.filePath}-${r.line}-${i}`}
                          type="button"
                          onClick={() => onOpenFile(r.filePath, r.line)}
                          className="block text-left text-blue-300 hover:underline truncate w-full"
                        >
                          {r.filePath}:{r.line} ({r.context})
                        </button>
                      ))}
                      {obj.references.length === 0 && <span>Only declared locally</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ))}

        {category === 'variables' &&
          (filteredVariables.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">
              No variables, constants, interfaces, or types detected.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08] text-slate-500">
                    <th className="py-2 pr-3 font-medium">Name</th>
                    <th className="py-2 px-3 font-medium">Kind</th>
                    <th className="py-2 px-3 font-medium">Type</th>
                    <th className="py-2 px-3 font-medium">Scope</th>
                    <th className="py-2 px-3 font-medium">Declaration</th>
                    <th className="py-2 pl-3 font-medium text-right">Refs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05] font-mono">
                  {filteredVariables.slice(0, 120).map((v) => (
                    <tr key={v.id} className="hover:bg-white/[0.02]">
                      <td className="py-2 pr-3 text-white font-semibold">{v.name}</td>
                      <td className="py-2 px-3 text-slate-400">{v.kind}</td>
                      <td className="py-2 px-3 text-blue-300 max-w-[180px] truncate">
                        {v.dataType || 'inferred'}
                      </td>
                      <td className="py-2 px-3 text-slate-400">
                        {v.scope} · {v.exported ? 'exported' : 'local'}
                      </td>
                      <td className="py-2 px-3">
                        <button
                          type="button"
                          onClick={() => onOpenFile(v.filePath, v.line)}
                          className="text-blue-400 hover:underline"
                        >
                          {v.filePath}:{v.line}
                        </button>
                      </td>
                      <td className="py-2 pl-3 text-right text-slate-300 tabular-nums">
                        {v.references.length}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </div>
    </div>
  );
}
