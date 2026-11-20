import {
  Activity,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  Crosshair,
  ExternalLink,
  FileCode2,
  GitBranch,
  Search,
  Workflow,
} from 'lucide-react';
import type {
  ArchitectureIntelligenceDTO,
  GraphEdgeDTO,
  GraphNodeDTO,
  ImpactReportDTO,
} from '../../../../shared/types.ts';
import { NODE_KIND_META, RELATION_META } from './graphConstants.ts';

interface NodeInspectorSidebarProps {
  intelligence: ArchitectureIntelligenceDTO;
  selectedNode: GraphNodeDTO | null;
  selectedEdge: GraphEdgeDTO | null;
  activeEdges: GraphEdgeDTO[];
  nodeMap: Map<string, GraphNodeDTO>;
  impact: ImpactReportDTO | null;
  impactLoading: boolean;
  onSelectNode: (nodeId: string) => void;
  onClearEdge: () => void;
  onOpenFile: (path: string, startLine?: number, endLine?: number) => void;
  onFocusNode: (nodeId: string) => void;
  onFilterMode: (mode: 'all' | 'deps' | 'callers') => void;
  onTraceFlow: (node: GraphNodeDTO) => void;
  onFindReferences: (symbolName: string) => void;
  onDrillDown: (node: GraphNodeDTO) => void;
}

export function NodeInspectorSidebar({
  intelligence,
  selectedNode,
  selectedEdge,
  activeEdges,
  nodeMap,
  impact,
  impactLoading,
  onSelectNode,
  onClearEdge,
  onOpenFile,
  onFocusNode,
  onFilterMode,
  onTraceFlow,
  onFindReferences,
  onDrillDown,
}: NodeInspectorSidebarProps) {
  if (selectedEdge) {
    const src = nodeMap.get(selectedEdge.source);
    const tgt = nodeMap.get(selectedEdge.target);
    const relStyle = RELATION_META[selectedEdge.relation] || RELATION_META.IMPORTS;

    return (
      <aside className="rounded-xl border border-white/[0.08] bg-[#111827] p-5 flex flex-col justify-between h-full overflow-y-auto">
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-mono text-blue-400">Relationship Connection</span>
            <button
              type="button"
              onClick={onClearEdge}
              className="text-xs text-slate-400 hover:text-white transition-colors"
            >
              Close
            </button>
          </div>

          <div>
            <h3 className="font-display text-lg font-semibold text-white">
              {selectedEdge.relation}
            </h3>
            <p className="mt-1 text-xs text-slate-400">{relStyle.description}</p>
          </div>

          <div className="space-y-2 border-t border-white/[0.08] pt-4 text-xs">
            <div>
              <p className="text-slate-500 mb-1">Source Node</p>
              <button
                type="button"
                onClick={() => {
                  onClearEdge();
                  onSelectNode(selectedEdge.source);
                }}
                className="w-full text-left px-3 py-2 rounded-lg border border-white/[0.08] bg-[#0B0F19] hover:border-blue-500/40 text-slate-200 transition-colors"
              >
                <div className="font-medium truncate">{src?.name || selectedEdge.source}</div>
                {src?.filePath && (
                  <div className="font-mono text-[11px] text-slate-500 truncate">
                    {src.filePath}
                  </div>
                )}
              </button>
            </div>

            <div className="flex justify-center py-0.5">
              <ArrowRight className="w-4 h-4 text-slate-500 rotate-90" />
            </div>

            <div>
              <p className="text-slate-500 mb-1">Target Node</p>
              <button
                type="button"
                onClick={() => {
                  onClearEdge();
                  onSelectNode(selectedEdge.target);
                }}
                className="w-full text-left px-3 py-2 rounded-lg border border-white/[0.08] bg-[#0B0F19] hover:border-blue-500/40 text-slate-200 transition-colors"
              >
                <div className="font-medium truncate">{tgt?.name || selectedEdge.target}</div>
                {tgt?.filePath && (
                  <div className="font-mono text-[11px] text-slate-500 truncate">
                    {tgt.filePath}
                  </div>
                )}
              </button>
            </div>
          </div>

          <div className="border-t border-white/[0.08] pt-4 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Edge Label</span>
              <span className="font-mono text-slate-200">{selectedEdge.label}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Occurrences</span>
              <span className="font-mono text-slate-200 tabular-nums">
                {selectedEdge.weight || 1}
              </span>
            </div>
            {selectedEdge.filePath && (
              <button
                type="button"
                onClick={() => onOpenFile(selectedEdge.filePath!, selectedEdge.line)}
                className="w-full mt-2 flex items-center justify-between px-3 py-2 rounded-lg border border-white/[0.08] bg-[#0B0F19] hover:border-blue-500/40 text-blue-300 font-mono transition-colors"
              >
                <span className="truncate">
                  {selectedEdge.filePath}
                  {selectedEdge.line ? `:${selectedEdge.line}` : ''}
                </span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              </button>
            )}
          </div>
        </div>
      </aside>
    );
  }

  if (!selectedNode) {
    return (
      <aside className="rounded-xl border border-white/[0.08] bg-[#111827] p-5 flex flex-col justify-between h-full">
        <div className="space-y-2">
          <h3 className="font-display text-sm font-semibold text-white">Node Inspector</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Click any node or connection line on the canvas to inspect its source preview,
            dependencies, callers, related functions/classes, and change impact.
          </p>
        </div>
        <div className="pt-4 border-t border-white/[0.08] text-xs text-slate-500 space-y-1">
          <p>Double-click any module or file node to drill down one level.</p>
          <p>Hold Shift + drag on canvas to multi-select nodes.</p>
        </div>
      </aside>
    );
  }

  const meta = NODE_KIND_META[selectedNode.kind] || NODE_KIND_META.file;
  const Icon = meta.icon;
  const incoming = activeEdges.filter((e) => e.target === selectedNode.id);
  const outgoing = activeEdges.filter((e) => e.source === selectedNode.id);

  const relatedFunctions = selectedNode.filePath
    ? intelligence.symbols.functions.filter((f) => f.filePath === selectedNode.filePath).slice(0, 8)
    : [];
  const relatedClasses = selectedNode.filePath
    ? intelligence.symbols.classes.filter((c) => c.filePath === selectedNode.filePath).slice(0, 6)
    : [];

  return (
    <aside className="rounded-xl border border-white/[0.08] bg-[#111827] p-5 flex flex-col gap-5 h-full overflow-y-auto">
      {/* Header */}
      <div>
        <div className={`inline-flex items-center gap-1.5 text-xs font-medium ${meta.accentText}`}>
          <Icon className="w-3.5 h-3.5" />
          <span>{meta.label}</span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-400 font-mono">{selectedNode.layer}</span>
        </div>

        <h3 className="mt-1 font-display text-lg font-semibold text-white break-words">
          {selectedNode.name}
        </h3>
        <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">{selectedNode.description}</p>

        {selectedNode.filePath && (
          <button
            type="button"
            onClick={() =>
              onOpenFile(selectedNode.filePath!, selectedNode.line, selectedNode.endLine)
            }
            className="mt-3 w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-white/[0.08] bg-[#0B0F19] hover:border-blue-500/40 text-left text-xs font-mono text-blue-300 transition-colors"
          >
            <span className="flex items-center gap-2 min-w-0">
              <FileCode2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {selectedNode.filePath}
                {selectedNode.line ? `:${selectedNode.line}` : ''}
              </span>
            </span>
            <ExternalLink className="w-3 h-3 shrink-0 text-slate-400" />
          </button>
        )}

        {/* Counters */}
        <div className="mt-3 grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.06] text-xs font-mono tabular-nums">
          <div>
            <div className="text-[11px] text-slate-500">Incoming</div>
            <div className="text-sm font-semibold text-white">{selectedNode.incomingCount}</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500">Outgoing</div>
            <div className="text-sm font-semibold text-white">{selectedNode.outgoingCount}</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500">Usage</div>
            <div className="text-sm font-semibold text-white">{selectedNode.usageCount}</div>
          </div>
        </div>
      </div>

      {/* Actions Grid */}
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => onFocusNode(selectedNode.id)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 bg-[#0B0F19] hover:border-blue-500/40 text-xs text-slate-200 transition-colors"
        >
          <Crosshair className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="truncate">Focus Node</span>
        </button>
        <button
          type="button"
          onClick={() => onFilterMode('deps')}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 bg-[#0B0F19] hover:border-blue-500/40 text-xs text-slate-200 transition-colors"
        >
          <ArrowRight className="w-3.5 h-3.5 text-violet-400 shrink-0" />
          <span className="truncate">Dependencies</span>
        </button>
        <button
          type="button"
          onClick={() => onFilterMode('callers')}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 bg-[#0B0F19] hover:border-blue-500/40 text-xs text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="truncate">Show Callers</span>
        </button>
        <button
          type="button"
          onClick={() => onTraceFlow(selectedNode)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 bg-[#0B0F19] hover:border-blue-500/40 text-xs text-slate-200 transition-colors"
        >
          <Workflow className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="truncate">Trace Data Flow</span>
        </button>
        {selectedNode.filePath && (
          <button
            type="button"
            onClick={() =>
              onOpenFile(selectedNode.filePath!, selectedNode.line, selectedNode.endLine)
            }
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 bg-[#0B0F19] hover:border-blue-500/40 text-xs text-slate-200 transition-colors"
          >
            <FileCode2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">View Source</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => onFindReferences(selectedNode.name)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 bg-[#0B0F19] hover:border-blue-500/40 text-xs text-slate-200 transition-colors"
        >
          <Search className="w-3.5 h-3.5 text-slate-300 shrink-0" />
          <span className="truncate">Find References</span>
        </button>
        {selectedNode.drillDownLevel && (
          <button
            type="button"
            onClick={() => onDrillDown(selectedNode)}
            className="col-span-2 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/15 border border-blue-500/35 hover:bg-blue-600/25 text-xs font-medium text-blue-300 transition-colors"
          >
            <ArrowDownRight className="w-3.5 h-3.5" />
            <span>Drill Down to {selectedNode.drillDownLevel} level</span>
          </button>
        )}
      </div>

      {/* Impact Summary */}
      <div className="border-t border-white/[0.08] pt-4 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-200 inline-flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            <span>Impact Analysis</span>
          </span>
          {impact && (
            <span
              className={`font-mono text-[11px] uppercase ${
                impact.riskLevel === 'high'
                  ? 'text-rose-400'
                  : impact.riskLevel === 'medium'
                    ? 'text-amber-400'
                    : 'text-emerald-400'
              }`}
            >
              {impact.riskLevel} risk
            </span>
          )}
        </div>
        {impactLoading ? (
          <div className="h-10 rounded bg-white/[0.04] animate-pulse" />
        ) : impact ? (
          <div className="text-xs text-slate-400 space-y-1 tabular-nums">
            <div>
              Transitive dependents:{' '}
              <span className="text-white font-mono">{impact.transitiveDependents.length}</span> ·
              Affected files:{' '}
              <span className="text-white font-mono">{impact.affectedFiles.length}</span>
            </div>
            {impact.affectedApisAndComponents.length > 0 && (
              <div className="text-[11px] text-slate-400 truncate">
                Impacts:{' '}
                <span className="text-slate-200 font-mono">
                  {impact.affectedApisAndComponents.map((a) => a.name).join(', ')}
                </span>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Signature / Metadata if available */}
      {(selectedNode.metadata?.parameters?.length ||
        selectedNode.metadata?.returnType ||
        selectedNode.metadata?.extendsClass) && (
        <div className="border-t border-white/[0.08] pt-4 space-y-1.5 text-xs font-mono">
          <div className="font-sans font-semibold text-slate-300">AST Metadata</div>
          {selectedNode.metadata.parameters && selectedNode.metadata.parameters.length > 0 && (
            <div className="text-slate-400 break-words">
              params:{' '}
              <span className="text-slate-200">
                ({selectedNode.metadata.parameters.map((p) => `${p.name}${p.type ? `: ${p.type}` : ''}`).join(', ')})
              </span>
            </div>
          )}
          {selectedNode.metadata.returnType && (
            <div className="text-slate-400">
              returns: <span className="text-blue-300">{selectedNode.metadata.returnType}</span>
            </div>
          )}
          {selectedNode.metadata.extendsClass && (
            <div className="text-slate-400">
              extends: <span className="text-amber-300">{selectedNode.metadata.extendsClass}</span>
            </div>
          )}
        </div>
      )}

      {/* Connections */}
      {(outgoing.length > 0 || incoming.length > 0) && (
        <div className="border-t border-white/[0.08] pt-4 space-y-2.5">
          <h4 className="text-xs font-semibold text-slate-300">
            Connections ({outgoing.length + incoming.length})
          </h4>
          <div className="space-y-1.5 text-xs max-h-48 overflow-y-auto">
            {outgoing.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => onSelectNode(e.target)}
                className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border border-white/[0.06] bg-[#0B0F19] hover:border-blue-500/40 text-left transition-colors"
              >
                <span className="flex items-center gap-1.5 text-slate-200 truncate">
                  <ArrowRight className="w-3 h-3 text-violet-400 shrink-0" />
                  <span className="truncate">{nodeMap.get(e.target)?.name || e.target}</span>
                </span>
                <span className="font-mono text-[10px] text-slate-500 shrink-0">{e.relation}</span>
              </button>
            ))}
            {incoming.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => onSelectNode(e.source)}
                className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border border-white/[0.06] bg-[#0B0F19] hover:border-blue-500/40 text-left transition-colors"
              >
                <span className="flex items-center gap-1.5 text-slate-300 truncate">
                  <ArrowLeft className="w-3 h-3 text-blue-400 shrink-0" />
                  <span className="truncate">{nodeMap.get(e.source)?.name || e.source}</span>
                </span>
                <span className="font-mono text-[10px] text-slate-500 shrink-0">{e.relation}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Related Symbols in File */}
      {(relatedFunctions.length > 0 || relatedClasses.length > 0) && (
        <div className="border-t border-white/[0.08] pt-4 space-y-2">
          <h4 className="text-xs font-semibold text-slate-300 inline-flex items-center gap-1.5">
            <GitBranch className="w-3.5 h-3.5 text-violet-400" />
            <span>Symbols in File</span>
          </h4>
          <div className="space-y-1 text-xs font-mono">
            {relatedClasses.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onOpenFile(c.filePath, c.line, c.endLine)}
                className="w-full flex items-center justify-between px-2.5 py-1 rounded bg-[#0B0F19] hover:text-amber-300 text-slate-300 text-left transition-colors"
              >
                <span className="truncate">class {c.name}</span>
                <span className="text-[10px] text-slate-500">L{c.line}</span>
              </button>
            ))}
            {relatedFunctions.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onOpenFile(f.filePath, f.line, f.endLine)}
                className="w-full flex items-center justify-between px-2.5 py-1 rounded bg-[#0B0F19] hover:text-blue-300 text-slate-300 text-left transition-colors"
              >
                <span className="truncate">{f.name}()</span>
                <span className="text-[10px] text-slate-500">L{f.line}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Source Code Preview */}
      {selectedNode.codePreview && (
        <div className="border-t border-white/[0.08] pt-4 space-y-2">
          <h4 className="text-xs font-semibold text-slate-300">Source Preview</h4>
          <pre className="p-3 rounded-lg border border-white/[0.06] bg-[#070A12] text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed">
            {selectedNode.codePreview}
          </pre>
        </div>
      )}
    </aside>
  );
}
