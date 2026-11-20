import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
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
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-lg border border-[#202A3A] bg-[#101623] overflow-hidden"
    >
      {/* Controls Header */}
      <div className="px-4 py-3 border-b border-[#202A3A] flex flex-wrap items-center justify-between gap-3 bg-[#0D111B]">
        <div className="inline-flex flex-wrap items-center gap-0.5 p-0.5 rounded-lg bg-[#080B12] border border-[#202A3A]">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = category === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setCategory(t.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 h-7 text-[12px] font-medium rounded-md transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#151D2B] text-[#F1F5F9] border border-[#60A5FA]/35'
                    : 'text-[#94A3B8] hover:text-[#F1F5F9]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-[#60A5FA]' : 'text-[#64748B]'}`} />
                <span>{t.label}</span>
                <span className="font-mono text-[10px] text-[#64748B] tabular-nums">{t.count}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-[12px] text-[#94A3B8] hover:text-[#F1F5F9] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={exportedOnly}
              onChange={(e) => setExportedOnly(e.target.checked)}
              className="rounded border-[#202A3A] bg-[#080B12] text-[#60A5FA] focus:ring-0"
            />
            <span>Exported only</span>
          </label>
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter symbol or file path..."
              className="w-full h-8 rounded-lg border border-[#202A3A] bg-[#080B12] pl-8 pr-3 text-[12px] text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:border-[#60A5FA]/50 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Results List */}
      <div className="p-4 max-h-[640px] overflow-y-auto space-y-2.5">
        {category === 'functions' &&
          (filteredFunctions.length === 0 ? (
            <p className="text-[12px] text-[#64748B] py-10 text-center">
              No matching functions detected.
            </p>
          ) : (
            filteredFunctions.slice(0, 80).map((fn) => (
              <div
                key={fn.id}
                className="rounded-lg border border-[#202A3A] bg-[#0D111B] hover:border-[#334155] p-3.5 space-y-2.5 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-mono text-[13px] font-semibold text-[#F1F5F9] break-all">
                      {fn.isAsync ? <span className="text-[#A78BFA]">async </span> : null}
                      {fn.name}(
                      <span className="text-[#94A3B8]">
                        {fn.parameters
                          .map((p) => `${p.name}${p.type ? `: ${p.type}` : ''}`)
                          .join(', ')}
                      </span>
                      ){fn.returnType ? <span className="text-[#22D3EE]">: {fn.returnType}</span> : ''}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#64748B] font-mono">
                      <span>{fn.kind}</span>
                      <span>·</span>
                      <span className={fn.exported ? 'text-[#34D399]' : ''}>
                        {fn.exported ? 'exported' : 'internal'}
                      </span>
                      <span>·</span>
                      <button
                        type="button"
                        onClick={() => onOpenFile(fn.filePath, fn.line, fn.endLine)}
                        className="text-[#60A5FA] hover:underline"
                      >
                        {fn.filePath}:{fn.line}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onLocateSymbolInGraph(fn.id, fn.filePath)}
                      className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-[#202A3A] bg-[#101623] hover:bg-[#151D2B] text-[11px] text-[#94A3B8] hover:text-[#F1F5F9] hover:border-[#60A5FA]/40 transition-colors"
                    >
                      <Crosshair className="w-3 h-3 text-[#60A5FA]" />
                      <span>Locate</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenFile(fn.filePath, fn.line, fn.endLine)}
                      className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-[#202A3A] bg-[#101623] hover:bg-[#151D2B] text-[11px] text-[#94A3B8] hover:text-[#F1F5F9] transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Source</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-[#202A3A] text-[11px]">
                  <div>
                    <div className="text-[#64748B] mb-1 font-mono">Calls ({fn.calls.length})</div>
                    <div className="font-mono text-[#CBD5E1] break-words">
                      {fn.calls.length > 0 ? fn.calls.slice(0, 8).join(', ') : 'None'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[#64748B] mb-1 font-mono">
                      Called By ({fn.calledBy.length})
                    </div>
                    <div className="font-mono text-[#CBD5E1] break-words">
                      {fn.calledBy.length > 0 ? fn.calledBy.slice(0, 8).join(', ') : 'No static callers'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[#64748B] mb-1 font-mono">
                      Variables &amp; Deps ({fn.variablesUsed.length})
                    </div>
                    <div className="font-mono text-[#94A3B8] break-words">
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
            <p className="text-[12px] text-[#64748B] py-10 text-center">
              No classes detected in repository.
            </p>
          ) : (
            filteredClasses.slice(0, 80).map((cls) => (
              <div
                key={cls.id}
                className="rounded-lg border border-[#202A3A] bg-[#0D111B] hover:border-[#334155] p-3.5 space-y-2.5 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-mono text-[13px] font-semibold text-[#FBBF24]">
                      class {cls.name}
                      {cls.extendsClass ? ` extends ${cls.extendsClass}` : ''}
                      {cls.implementsInterfaces.length > 0
                        ? ` implements ${cls.implementsInterfaces.join(', ')}`
                        : ''}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#64748B] font-mono">
                      <span>{cls.exported ? 'exported' : 'internal'}</span>
                      {cls.decorators.length > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-[#A78BFA]">@{cls.decorators.join(' @')}</span>
                        </>
                      )}
                      <span>·</span>
                      <button
                        type="button"
                        onClick={() => onOpenFile(cls.filePath, cls.line, cls.endLine)}
                        className="text-[#60A5FA] hover:underline"
                      >
                        {cls.filePath}:{cls.line}
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onLocateSymbolInGraph(cls.id, cls.filePath)}
                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-[#202A3A] bg-[#101623] hover:bg-[#151D2B] text-[11px] text-[#94A3B8] hover:text-[#F1F5F9] hover:border-[#60A5FA]/40 transition-colors"
                  >
                    <Crosshair className="w-3 h-3 text-[#60A5FA]" />
                    <span>Locate</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-[#202A3A] text-[11px]">
                  <div>
                    <div className="text-[#64748B] mb-1 font-mono">
                      Properties ({cls.properties.length})
                    </div>
                    <div className="font-mono text-[#CBD5E1]">
                      {cls.properties.length > 0
                        ? cls.properties
                            .map((p) => `${p.name}${p.type ? `: ${p.type}` : ''}`)
                            .join(', ')
                        : 'None'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[#64748B] mb-1 font-mono">
                      Constructor ({cls.constructorParams.length})
                    </div>
                    <div className="font-mono text-[#CBD5E1]">
                      {cls.constructorParams.length > 0
                        ? cls.constructorParams
                            .map((p) => `${p.name}${p.type ? `: ${p.type}` : ''}`)
                            .join(', ')
                        : 'Default'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[#64748B] mb-1 font-mono">
                      Methods ({cls.methods.length})
                    </div>
                    <div className="font-mono text-[#CBD5E1]">
                      {cls.methods.length > 0 ? cls.methods.join(', ') : 'None'}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ))}

        {category === 'objects' &&
          (filteredObjects.length === 0 ? (
            <p className="text-[12px] text-[#64748B] py-10 text-center">
              No object literals detected.
            </p>
          ) : (
            filteredObjects.slice(0, 80).map((obj) => (
              <div
                key={obj.id}
                className="rounded-lg border border-[#202A3A] bg-[#0D111B] hover:border-[#334155] p-3.5 space-y-2.5 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-mono text-[13px] font-semibold text-[#22D3EE]">
                      {obj.name}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#64748B] font-mono">
                      <span>{obj.exported ? 'exported' : 'module-local'}</span>
                      <span>·</span>
                      <button
                        type="button"
                        onClick={() => onOpenFile(obj.createdAt.filePath, obj.createdAt.line)}
                        className="text-[#60A5FA] hover:underline"
                      >
                        Created at {obj.createdAt.filePath}:{obj.createdAt.line}
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onLocateSymbolInGraph(obj.id, obj.filePath)}
                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-[#202A3A] bg-[#101623] hover:bg-[#151D2B] text-[11px] text-[#94A3B8] hover:text-[#F1F5F9] transition-colors"
                  >
                    <Crosshair className="w-3 h-3 text-[#60A5FA]" />
                    <span>Locate</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-[#202A3A] text-[11px]">
                  <div>
                    <div className="text-[#64748B] mb-1 font-mono">
                      Properties ({obj.properties.length})
                    </div>
                    <div className="font-mono text-[#CBD5E1]">
                      {obj.properties.join(', ') || 'None'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[#64748B] mb-1 font-mono">
                      Methods ({obj.methods.length})
                    </div>
                    <div className="font-mono text-[#CBD5E1]">
                      {obj.methods.join(', ') || 'None'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[#64748B] mb-1 font-mono">
                      References ({obj.references.length})
                    </div>
                    <div className="font-mono text-[#94A3B8] space-y-0.5">
                      {obj.references.slice(0, 4).map((r, i) => (
                        <button
                          key={`${r.filePath}-${r.line}-${i}`}
                          type="button"
                          onClick={() => onOpenFile(r.filePath, r.line)}
                          className="block text-left text-[#60A5FA] hover:underline truncate w-full"
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
            <p className="text-[12px] text-[#64748B] py-10 text-center">
              No variables, constants, interfaces, or types detected.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="border-b border-[#202A3A] text-[#64748B]">
                    <th className="py-2 pr-3 font-medium">Name</th>
                    <th className="py-2 px-3 font-medium">Kind</th>
                    <th className="py-2 px-3 font-medium">Type</th>
                    <th className="py-2 px-3 font-medium">Scope</th>
                    <th className="py-2 px-3 font-medium">Declaration</th>
                    <th className="py-2 pl-3 font-medium text-right">Refs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#202A3A]/70 font-mono">
                  {filteredVariables.slice(0, 120).map((v) => (
                    <tr key={v.id} className="hover:bg-[#151D2B]/60 transition-colors">
                      <td className="py-2 pr-3 text-[#F1F5F9] font-semibold">{v.name}</td>
                      <td className="py-2 px-3 text-[#94A3B8]">{v.kind}</td>
                      <td className="py-2 px-3 text-[#22D3EE] max-w-[180px] truncate">
                        {v.dataType || 'inferred'}
                      </td>
                      <td className="py-2 px-3 text-[#94A3B8]">
                        {v.scope} · {v.exported ? 'exported' : 'local'}
                      </td>
                      <td className="py-2 px-3">
                        <button
                          type="button"
                          onClick={() => onOpenFile(v.filePath, v.line)}
                          className="text-[#60A5FA] hover:underline"
                        >
                          {v.filePath}:{v.line}
                        </button>
                      </td>
                      <td className="py-2 pl-3 text-right text-[#F1F5F9] tabular-nums">
                        {v.references.length}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </div>
    </motion.div>
  );
}
