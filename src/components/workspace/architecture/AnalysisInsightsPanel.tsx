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

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-5"
    >
      {/* Static Complexity Metrics */}
      <section className="rounded-lg border border-[#202A3A] bg-[#101623] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-[15px] font-semibold text-[#F1F5F9]">
              Deterministic AST Code Complexity
            </h3>
            <p className="text-[12px] text-[#94A3B8]">
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
              className="rounded-lg border border-[#202A3A] bg-[#0D111B] px-3.5 py-2.5"
            >
              <div className="text-[11px] text-[#94A3B8] truncate">{item.label}</div>
              <div
                className={`mt-1 text-[18px] font-semibold font-mono tabular-nums ${
                  item.warn ? 'text-[#FB7185]' : 'text-[#F1F5F9]'
                }`}
              >
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Impact Analysis for Selected Node */}
      <section className="rounded-lg border border-[#202A3A] bg-[#101623] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-[15px] font-semibold text-[#F1F5F9]">
              Impact Analysis {impact ? `· ${impact.nodeName}` : ''}
            </h3>
            <p className="text-[12px] text-[#94A3B8]">
              Select any node in the graph or Highly Coupled list below to compute downstream
              breakage risk and affected files.
            </p>
          </div>
          {impact && (
            <span
              className={`text-[11px] font-mono uppercase font-semibold ${
                impact.riskLevel === 'high'
                  ? 'text-[#FB7185]'
                  : impact.riskLevel === 'medium'
                    ? 'text-[#FBBF24]'
                    : 'text-[#34D399]'
              }`}
            >
              {impact.riskLevel} coupling impact
            </span>
          )}
        </div>

        {impactLoading ? (
          <div className="h-24 rounded-lg border border-[#202A3A] bg-[#0D111B] animate-pulse" />
        ) : impact ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-[12px]">
            <div className="rounded-lg border border-[#202A3A] bg-[#0D111B] p-3.5 space-y-2">
              <div className="font-semibold text-[#F1F5F9]">
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
                      className="block w-full text-left text-[#60A5FA] hover:underline truncate"
                    >
                      {d.name} ({d.kind})
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-lg border border-[#202A3A] bg-[#0D111B] p-3.5 space-y-2">
              <div className="font-semibold text-[#F1F5F9]">
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
                      className="block w-full text-left text-[#A78BFA] hover:underline truncate"
                    >
                      {d.name} ({d.kind})
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-lg border border-[#202A3A] bg-[#0D111B] p-3.5 space-y-2">
              <div className="font-semibold text-[#F1F5F9]">
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
                    className="block w-full text-left text-[#94A3B8] hover:text-[#60A5FA] truncate transition-colors"
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
        <section className="rounded-lg border border-[#202A3A] bg-[#101623] p-5 space-y-3">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-[#F1F5F9]">
            <RefreshCw className="w-4 h-4 text-[#FB7185]" />
            <span>Circular Dependencies ({circularDependencies.length})</span>
          </div>
          {circularDependencies.length === 0 ? (
            <p className="text-[12px] text-[#34D399]">No circular import cycles detected.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {circularDependencies.map((cycle, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-[#FB7185]/30 bg-[#FB7185]/[0.06] p-3 font-mono text-[11px] text-[#F1F5F9] flex flex-wrap items-center gap-1.5"
                >
                  {cycle.map((fp, i) => (
                    <span key={`${fp}-${i}`} className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onOpenFile(fp)}
                        className="hover:underline text-[#F1F5F9]"
                      >
                        {fp}
                      </button>
                      {i < cycle.length - 1 && <span className="text-[#FB7185]">→</span>}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Highly Coupled Modules */}
        <section className="rounded-lg border border-[#202A3A] bg-[#101623] p-5 space-y-3">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-[#F1F5F9]">
            <Layers className="w-4 h-4 text-[#60A5FA]" />
            <span>Highly Coupled Files ({highlyCoupledNodes.length})</span>
          </div>
          <div className="space-y-1.5 max-h-60 overflow-y-auto text-[12px]">
            {highlyCoupledNodes.map((n) => (
              <button
                key={n.nodeId}
                type="button"
                onClick={() => onSelectNode(n.nodeId)}
                className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-[#202A3A] bg-[#0D111B] hover:border-[#60A5FA]/45 hover:bg-[#151D2B] text-left transition-colors"
              >
                <div className="min-w-0">
                  <div className="font-medium text-[#F1F5F9] truncate">{n.name}</div>
                  {n.filePath && (
                    <div className="font-mono text-[11px] text-[#64748B] truncate">
                      {n.filePath}
                    </div>
                  )}
                </div>
                <div className="font-mono text-[11px] text-[#94A3B8] shrink-0 tabular-nums">
                  {n.inDegree} in · {n.outDegree} out
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Unused Imports */}
        <section className="rounded-lg border border-[#202A3A] bg-[#101623] p-5 space-y-3">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-[#F1F5F9]">
            <AlertTriangle className="w-4 h-4 text-[#FBBF24]" />
            <span>Unused Imports ({unusedImports.length})</span>
          </div>
          {unusedImports.length === 0 ? (
            <p className="text-[12px] text-[#34D399]">No unused import identifiers detected.</p>
          ) : (
            <div className="space-y-1.5 max-h-60 overflow-y-auto text-[11px] font-mono">
              {unusedImports.map((u, idx) => (
                <button
                  key={`${u.filePath}-${u.line}-${u.identifier}-${idx}`}
                  type="button"
                  onClick={() => onOpenFile(u.filePath, u.line)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-[#202A3A] bg-[#0D111B] hover:border-[#FBBF24]/45 hover:bg-[#151D2B] text-left transition-colors"
                >
                  <span className="text-[#FBBF24] truncate">
                    {u.identifier}{' '}
                    <span className="text-[#64748B]">from &quot;{u.source}&quot;</span>
                  </span>
                  <span className="text-[#94A3B8] shrink-0">
                    {u.filePath}:{u.line}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Orphaned Modules */}
        <section className="rounded-lg border border-[#202A3A] bg-[#101623] p-5 space-y-3">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-[#F1F5F9]">
            <FileWarning className="w-4 h-4 text-[#94A3B8]" />
            <span>Orphaned Source Files ({orphanedFiles.length})</span>
          </div>
          {orphanedFiles.length === 0 ? (
            <p className="text-[12px] text-[#94A3B8]">
              All source files participate in the module graph.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-60 overflow-y-auto text-[11px] font-mono">
              {orphanedFiles.map((fp) => (
                <button
                  key={fp}
                  type="button"
                  onClick={() => onOpenFile(fp)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-[#202A3A] bg-[#0D111B] hover:border-[#60A5FA]/45 hover:bg-[#151D2B] text-left text-[#CBD5E1] transition-colors"
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
