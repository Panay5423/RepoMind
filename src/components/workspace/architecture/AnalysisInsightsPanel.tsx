import { motion } from 'motion/react';
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
    { label: 'Circular Cycles', value: m.circularDependencyCount, warn: m.circularDependencyCount > 0 },
  ];

  const sectionCardClass =
    'rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-10px_rgba(37,99,235,0.06)] p-5 space-y-4';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-5"
    >
      {/* Static Complexity Metrics */}
      <section className={sectionCardClass}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-[15px] font-semibold text-[#0F172A]">
              Deterministic AST Code Complexity
            </h3>
            <p className="text-[12px] text-[#64748B]">
              Parsed directly from source ASTs and dependency manifests without AI estimation.
            </p>
          </div>
          <div className="text-[11px] font-mono text-[#64748B] tabular-nums">
            {intelligence.cacheMeta.parsedFilesCount} parsed ·{' '}
            {intelligence.cacheMeta.reusedFilesCount} cached
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {statItems.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5"
            >
              <div className="text-[11px] font-medium text-[#64748B] truncate">{item.label}</div>
              <div
                className={`mt-1 text-[18px] font-bold font-mono tabular-nums ${
                  item.warn ? 'text-[#E11D48]' : 'text-[#0B1F3A]'
                }`}
              >
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Impact Analysis for Selected Node */}
      <section className={sectionCardClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-[15px] font-semibold text-[#0F172A]">
              Impact Analysis {impact ? `· ${impact.nodeName}` : ''}
            </h3>
            <p className="text-[12px] text-[#64748B]">
              Select any node in the graph or Highly Coupled list below to compute downstream
              breakage risk and affected files.
            </p>
          </div>
          {impact && (
            <span
              className={`text-[11px] font-mono uppercase font-semibold ${
                impact.riskLevel === 'high'
                  ? 'text-[#E11D48]'
                  : impact.riskLevel === 'medium'
                    ? 'text-[#D97706]'
                    : 'text-[#059669]'
              }`}
            >
              {impact.riskLevel} coupling impact
            </span>
          )}
        </div>

        {impactLoading ? (
          <div className="h-24 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] animate-pulse" />
        ) : impact ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-[12px]">
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 space-y-2">
              <div className="font-semibold text-[#0F172A]">
                Direct &amp; Transitive Dependents ({impact.transitiveDependents.length})
              </div>
              <div className="text-[11px] text-[#64748B]">What could break if this changes:</div>
              <div className="max-h-40 overflow-y-auto space-y-1 font-mono text-[11px]">
                {impact.transitiveDependents.length === 0 ? (
                  <p className="text-[#64748B]">No static dependents found at this level.</p>
                ) : (
                  impact.transitiveDependents.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => onSelectNode(d.id)}
                      className="block w-full text-left text-[#2563EB] hover:underline truncate"
                    >
                      {d.name} ({d.kind})
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 space-y-2">
              <div className="font-semibold text-[#0F172A]">
                Dependencies ({impact.transitiveDependencies.length})
              </div>
              <div className="text-[11px] text-[#64748B]">
                Direct: {impact.directDependencies.length} · Transitive:{' '}
                {impact.transitiveDependencies.length}
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1 font-mono text-[11px]">
                {impact.transitiveDependencies.length === 0 ? (
                  <p className="text-[#64748B]">No outgoing static dependencies.</p>
                ) : (
                  impact.transitiveDependencies.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => onSelectNode(d.id)}
                      className="block w-full text-left text-[#4F46E5] hover:underline truncate"
                    >
                      {d.name} ({d.kind})
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 space-y-2">
              <div className="font-semibold text-[#0F172A]">
                Affected Files ({impact.affectedFiles.length})
              </div>
              <div className="text-[11px] text-[#64748B]">
                APIs / Components affected: {impact.affectedApisAndComponents.length}
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1 font-mono text-[11px]">
                {impact.affectedFiles.map((fp) => (
                  <button
                    key={fp}
                    type="button"
                    onClick={() => onOpenFile(fp)}
                    className="block w-full text-left text-[#475569] hover:text-[#2563EB] truncate transition-colors"
                  >
                    {fp}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-[12px] text-[#64748B]">Select a node to inspect impact.</p>
        )}
      </section>

      {/* Dependency Diagnostics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Circular Dependencies */}
        <section className={sectionCardClass}>
          <div className="flex items-center gap-2 text-[14px] font-semibold text-[#0F172A]">
            <RefreshCw className="w-4 h-4 text-[#E11D48]" />
            <span>Circular Dependencies ({circularDependencies.length})</span>
          </div>
          {circularDependencies.length === 0 ? (
            <p className="text-[12px] font-medium text-[#059669]">
              No circular import cycles detected.
            </p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {circularDependencies.map((cycle, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-[#FECDD3] bg-[#FFF1F2] p-3 font-mono text-[11px] text-[#881337] flex flex-wrap items-center gap-1.5"
                >
                  {cycle.map((fp, i) => (
                    <span key={`${fp}-${i}`} className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onOpenFile(fp)}
                        className="hover:underline text-[#881337] font-medium"
                      >
                        {fp}
                      </button>
                      {i < cycle.length - 1 && <span className="text-[#E11D48]">→</span>}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Highly Coupled Modules */}
        <section className={sectionCardClass}>
          <div className="flex items-center gap-2 text-[14px] font-semibold text-[#0F172A]">
            <Layers className="w-4 h-4 text-[#2563EB]" />
            <span>Highly Coupled Files ({highlyCoupledNodes.length})</span>
          </div>
          <div className="space-y-1.5 max-h-60 overflow-y-auto text-[12px]">
            {highlyCoupledNodes.map((n) => (
              <button
                key={n.nodeId}
                type="button"
                onClick={() => onSelectNode(n.nodeId)}
                className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#93C5FD] hover:bg-[#EFF6FF]/60 text-left transition-colors"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-[#0F172A] truncate">{n.name}</div>
                  {n.filePath && (
                    <div className="font-mono text-[11px] text-[#64748B] truncate">
                      {n.filePath}
                    </div>
                  )}
                </div>
                <div className="font-mono text-[11px] text-[#475569] shrink-0 tabular-nums">
                  {n.inDegree} in · {n.outDegree} out
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Unused Imports */}
        <section className={sectionCardClass}>
          <div className="flex items-center gap-2 text-[14px] font-semibold text-[#0F172A]">
            <AlertTriangle className="w-4 h-4 text-[#D97706]" />
            <span>Unused Imports ({unusedImports.length})</span>
          </div>
          {unusedImports.length === 0 ? (
            <p className="text-[12px] font-medium text-[#059669]">
              No unused import identifiers detected.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-60 overflow-y-auto text-[11px] font-mono">
              {unusedImports.map((u, idx) => (
                <button
                  key={`${u.filePath}-${u.line}-${u.identifier}-${idx}`}
                  type="button"
                  onClick={() => onOpenFile(u.filePath, u.line)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#FCD34D] hover:bg-[#FFFBEB]/60 text-left transition-colors"
                >
                  <span className="text-[#B45309] font-medium truncate">
                    {u.identifier}{' '}
                    <span className="text-[#64748B] font-normal">from &quot;{u.source}&quot;</span>
                  </span>
                  <span className="text-[#64748B] shrink-0">
                    {u.filePath}:{u.line}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Orphaned Modules */}
        <section className={sectionCardClass}>
          <div className="flex items-center gap-2 text-[14px] font-semibold text-[#0F172A]">
            <FileWarning className="w-4 h-4 text-[#64748B]" />
            <span>Orphaned Source Files ({orphanedFiles.length})</span>
          </div>
          {orphanedFiles.length === 0 ? (
            <p className="text-[12px] text-[#64748B]">
              All source files participate in the module graph.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-60 overflow-y-auto text-[11px] font-mono">
              {orphanedFiles.map((fp) => (
                <button
                  key={fp}
                  type="button"
                  onClick={() => onOpenFile(fp)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#93C5FD] hover:bg-[#EFF6FF]/60 text-left text-[#334155] transition-colors"
                >
                  <span className="truncate">{fp}</span>
                  <GitBranch className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </motion.div>
  );
}
