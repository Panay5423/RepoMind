import { AlertTriangle, FileWarning, GitBranch, Layers, RefreshCw } from 'lucide-react';
import type { ArchitectureIntelligenceDTO, ImpactReportDTO } from '../../../../shared/types.ts';

interface AnalysisInsightsPanelProps {
  intelligence: ArchitectureIntelligenceDTO;
  selectedNodeId: string | null;
  impact: ImpactReportDTO | null;
  impactLoading: boolean;
  onSelectNode: (nodeId: string) => void;
  onOpenFile: (path: string, startLine?: number) => void;
}

export function AnalysisInsightsPanel({
  intelligence,
  impact,
  impactLoading,
  onSelectNode,
  onOpenFile,
}: AnalysisInsightsPanelProps) {
  const m = intelligence.complexityMetrics;
  const { circularDependencies, unusedImports, orphanedFiles, highlyCoupledNodes } =
    intelligence.dependencyAnalysis;

  const statItems = [
    { label: 'Source Files', value: m.fileCount },
    { label: 'Functions', value: m.functionCount },
    { label: 'Methods', value: m.methodCount },
    { label: 'Classes', value: m.classCount },
    { label: 'Objects', value: m.objectCount },
    { label: 'Interfaces / Types', value: m.interfaceAndTypeCount },
    { label: 'Vars / Constants', value: m.variableAndConstantCount },
    { label: 'Import Statements', value: m.importCount },
    { label: 'Dependencies', value: m.dependencyCount },
    { label: 'API Endpoints', value: m.endpointCount },
    { label: 'DB Models', value: m.modelCount },
    { label: 'Circular Cycles', value: m.circularDependencyCount },
  ];

  return (
    <div className="space-y-6">
      {/* Static Complexity Metrics */}
      <section className="rounded-xl border border-white/[0.08] bg-[#111827] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-base font-semibold text-white">
              Deterministic AST Code Complexity
            </h3>
            <p className="text-xs text-slate-400">
              Parsed directly from source ASTs and dependency manifests without AI estimation.
            </p>
          </div>
          <div className="text-xs font-mono text-slate-500 tabular-nums">
            {intelligence.cacheMeta.parsedFilesCount} parsed ·{' '}
            {intelligence.cacheMeta.reusedFilesCount} cached
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {statItems.map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-white/[0.06] bg-[#0B0F19] px-3.5 py-2.5"
            >
              <div className="text-[11px] text-slate-400 truncate">{item.label}</div>
              <div className="mt-1 text-lg font-bold font-mono text-white tabular-nums">
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Impact Analysis for Selected Node */}
      <section className="rounded-xl border border-white/[0.08] bg-[#111827] p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold text-white">
              Impact Analysis {impact ? `· ${impact.nodeName}` : ''}
            </h3>
            <p className="text-xs text-slate-400">
              Select any node in the graph or Highly Coupled list below to compute downstream
              breakage risk and affected files.
            </p>
          </div>
          {impact && (
            <span
              className={`text-xs font-mono uppercase font-semibold ${
                impact.riskLevel === 'high'
                  ? 'text-rose-400'
                  : impact.riskLevel === 'medium'
                    ? 'text-amber-400'
                    : 'text-emerald-400'
              }`}
            >
              {impact.riskLevel} coupling impact
            </span>
          )}
        </div>

        {impactLoading ? (
          <div className="h-24 rounded-lg bg-white/[0.04] animate-pulse" />
        ) : impact ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="rounded-lg border border-white/[0.06] bg-[#0B0F19] p-3.5 space-y-2">
              <div className="font-semibold text-slate-200">
                Direct &amp; Transitive Dependents ({impact.transitiveDependents.length})
              </div>
              <div className="text-slate-400">What could break if this changes:</div>
              <div className="max-h-40 overflow-y-auto space-y-1 font-mono">
                {impact.transitiveDependents.length === 0 ? (
                  <p className="text-slate-500">No static dependents found at this level.</p>
                ) : (
                  impact.transitiveDependents.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => onSelectNode(d.id)}
                      className="block w-full text-left text-blue-300 hover:underline truncate"
                    >
                      {d.name} ({d.kind})
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-lg border border-white/[0.06] bg-[#0B0F19] p-3.5 space-y-2">
              <div className="font-semibold text-slate-200">
                Dependencies ({impact.transitiveDependencies.length})
              </div>
              <div className="text-slate-400">
                Direct: {impact.directDependencies.length} · Transitive:{' '}
                {impact.transitiveDependencies.length}
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1 font-mono">
                {impact.transitiveDependencies.length === 0 ? (
                  <p className="text-slate-500">No outgoing static dependencies.</p>
                ) : (
                  impact.transitiveDependencies.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => onSelectNode(d.id)}
                      className="block w-full text-left text-violet-300 hover:underline truncate"
                    >
                      {d.name} ({d.kind})
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-lg border border-white/[0.06] bg-[#0B0F19] p-3.5 space-y-2">
              <div className="font-semibold text-slate-200">
                Affected Files ({impact.affectedFiles.length})
              </div>
              <div className="text-slate-400">
                APIs / Components affected: {impact.affectedApisAndComponents.length}
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1 font-mono">
                {impact.affectedFiles.map((fp) => (
                  <button
                    key={fp}
                    type="button"
                    onClick={() => onOpenFile(fp)}
                    className="block w-full text-left text-slate-300 hover:text-blue-300 truncate"
                  >
                    {fp}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500">Select a node to inspect impact.</p>
        )}
      </section>

      {/* Dependency Diagnostics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Circular Dependencies */}
        <section className="rounded-xl border border-white/[0.08] bg-[#111827] p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <RefreshCw className="w-4 h-4 text-rose-400" />
            <span>Circular Dependencies ({circularDependencies.length})</span>
          </div>
          {circularDependencies.length === 0 ? (
            <p className="text-xs text-emerald-400">No circular import cycles detected.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {circularDependencies.map((cycle, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-rose-500/25 bg-rose-500/[0.06] p-3 font-mono text-xs text-rose-200 flex flex-wrap items-center gap-1.5"
                >
                  {cycle.map((fp, i) => (
                    <span key={`${fp}-${i}`} className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onOpenFile(fp)}
                        className="hover:underline text-white"
                      >
                        {fp}
                      </button>
                      {i < cycle.length - 1 && <span className="text-rose-400">→</span>}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Highly Coupled Modules */}
        <section className="rounded-xl border border-white/[0.08] bg-[#111827] p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Layers className="w-4 h-4 text-blue-400" />
            <span>Highly Coupled Files ({highlyCoupledNodes.length})</span>
          </div>
          <div className="space-y-1.5 max-h-60 overflow-y-auto text-xs">
            {highlyCoupledNodes.map((n) => (
              <button
                key={n.nodeId}
                type="button"
                onClick={() => onSelectNode(n.nodeId)}
                className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-white/[0.06] bg-[#0B0F19] hover:border-blue-500/40 text-left transition-colors"
              >
                <div className="min-w-0">
                  <div className="font-medium text-white truncate">{n.name}</div>
                  {n.filePath && (
                    <div className="font-mono text-[11px] text-slate-500 truncate">
                      {n.filePath}
                    </div>
                  )}
                </div>
                <div className="font-mono text-[11px] text-slate-300 shrink-0 tabular-nums">
                  {n.inDegree} in · {n.outDegree} out
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Unused Imports */}
        <section className="rounded-xl border border-white/[0.08] bg-[#111827] p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Unused Imports ({unusedImports.length})</span>
          </div>
          {unusedImports.length === 0 ? (
            <p className="text-xs text-emerald-400">No unused import identifiers detected.</p>
          ) : (
            <div className="space-y-1.5 max-h-60 overflow-y-auto text-xs font-mono">
              {unusedImports.map((u, idx) => (
                <button
                  key={`${u.filePath}-${u.line}-${u.identifier}-${idx}`}
                  type="button"
                  onClick={() => onOpenFile(u.filePath, u.line)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-white/[0.06] bg-[#0B0F19] hover:border-amber-500/40 text-left"
                >
                  <span className="text-amber-300 truncate">
                    {u.identifier}{' '}
                    <span className="text-slate-500">from &quot;{u.source}&quot;</span>
                  </span>
                  <span className="text-slate-400 shrink-0">
                    {u.filePath}:{u.line}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Orphaned Modules */}
        <section className="rounded-xl border border-white/[0.08] bg-[#111827] p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <FileWarning className="w-4 h-4 text-slate-400" />
            <span>Orphaned Source Files ({orphanedFiles.length})</span>
          </div>
          {orphanedFiles.length === 0 ? (
            <p className="text-xs text-slate-400">All source files participate in the module graph.</p>
          ) : (
            <div className="space-y-1.5 max-h-60 overflow-y-auto text-xs font-mono">
              {orphanedFiles.map((fp) => (
                <button
                  key={fp}
                  type="button"
                  onClick={() => onOpenFile(fp)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-white/[0.06] bg-[#0B0F19] hover:border-blue-500/40 text-left text-slate-300"
                >
                  <span className="truncate">{fp}</span>
                  <GitBranch className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
