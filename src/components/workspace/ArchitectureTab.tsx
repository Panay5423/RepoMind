import { useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  type Edge,
  type Node,
  type NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { FileCode2, Layers } from 'lucide-react';
import type { ArchitectureGraph, ArchitectureNode } from '../../../shared/types.ts';

interface ArchitectureTabProps {
  graph: ArchitectureGraph;
  onOpenFile: (path: string) => void;
}

const LAYER_STYLES: Record<
  ArchitectureNode['layer'],
  { border: string; labelColor: string; bg: string; order: number }
> = {
  frontend: {
    border: 'border-blue-500/40',
    labelColor: 'text-blue-400',
    bg: 'bg-[#0F172A]',
    order: 0,
  },
  api: {
    border: 'border-violet-500/40',
    labelColor: 'text-violet-400',
    bg: 'bg-[#131126]',
    order: 1,
  },
  backend: {
    border: 'border-indigo-500/40',
    labelColor: 'text-indigo-400',
    bg: 'bg-[#111827]',
    order: 2,
  },
  service: {
    border: 'border-cyan-500/40',
    labelColor: 'text-cyan-400',
    bg: 'bg-[#0D1A26]',
    order: 2,
  },
  database: {
    border: 'border-emerald-500/40',
    labelColor: 'text-emerald-400',
    bg: 'bg-[#0C1D1A]',
    order: 3,
  },
  config: {
    border: 'border-slate-500/40',
    labelColor: 'text-slate-400',
    bg: 'bg-[#111827]',
    order: 3,
  },
};

function ModuleNode({ data, selected }: NodeProps<ArchitectureNode>) {
  const style = LAYER_STYLES[data.layer] || LAYER_STYLES.service;
  return (
    <div
      className={`w-60 rounded-lg border px-4 py-3 transition-colors ${style.bg} ${
        selected ? 'border-blue-400 ring-1 ring-blue-400/50' : style.border
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-blue-400 !w-2 !h-2" />
      <div className={`text-[10px] font-mono uppercase tracking-wider ${style.labelColor}`}>
        {data.layer}
      </div>
      <div className="mt-0.5 text-sm font-semibold text-white truncate">{data.label}</div>
      <div className="mt-1 text-xs text-slate-400 line-clamp-2">{data.description}</div>
      <div className="mt-2 text-[11px] font-mono text-slate-500 tabular-nums">
        {data.files.length} linked file{data.files.length === 1 ? '' : 's'}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-violet-400 !w-2 !h-2" />
    </div>
  );
}

const nodeTypes = { moduleNode: ModuleNode };

export function ArchitectureTab({ graph, onOpenFile }: ArchitectureTabProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    graph.nodes[0]?.id || null
  );

  const { nodes, edges } = useMemo(() => {
    const byColumn = new Map<number, ArchitectureNode[]>();
    for (const n of graph.nodes) {
      const col = LAYER_STYLES[n.layer]?.order ?? 2;
      const list = byColumn.get(col) || [];
      list.push(n);
      byColumn.set(col, list);
    }

    const flowNodes: Node<ArchitectureNode>[] = [];
    for (const [col, items] of byColumn.entries()) {
      items.forEach((item, rowIdx) => {
        flowNodes.push({
          id: item.id,
          type: 'moduleNode',
          position: { x: col * 310 + 40, y: rowIdx * 155 + 40 },
          data: item,
        });
      });
    }

    const flowEdges: Edge[] = graph.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      animated: false,
      style: { stroke: '#475569', strokeWidth: 1.5 },
      labelStyle: { fill: '#94A3B8', fontSize: 11, fontFamily: 'JetBrains Mono' },
      labelBgStyle: { fill: '#0B0F19', fillOpacity: 0.9 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#64748B',
      },
    }));

    return { nodes: flowNodes, edges: flowEdges };
  }, [graph]);

  const selectedNode = graph.nodes.find((n) => n.id === selectedNodeId) || null;

  if (graph.nodes.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-[#111827] p-12 text-center">
        <Layers className="w-8 h-8 text-slate-500 mx-auto mb-3" />
        <p className="text-sm font-medium text-white">No architecture graph data available</p>
        <p className="mt-1 text-xs text-slate-400">
          Re-analyze this repository to generate module nodes and dependency connections.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-8 h-[600px] rounded-xl border border-white/[0.08] bg-[#070A12] overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          onNodeClick={(_e, node) => setSelectedNodeId(node.id)}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="rgba(148,163,184,0.12)" gap={24} />
          <Controls />
          <MiniMap
            nodeColor={() => '#3B82F6'}
            maskColor="rgba(11, 15, 25, 0.75)"
          />
        </ReactFlow>
      </div>

      <aside className="lg:col-span-4 rounded-xl border border-white/[0.08] bg-[#111827] p-5 flex flex-col justify-between">
        {selectedNode ? (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-mono uppercase text-blue-400">{selectedNode.layer}</p>
              <h3 className="mt-1 font-display text-lg font-semibold text-white">
                {selectedNode.label}
              </h3>
              <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                {selectedNode.description}
              </p>
            </div>

            {selectedNode.responsibilities.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-300 mb-2">Responsibilities</h4>
                <ul className="space-y-1.5 text-xs text-slate-400">
                  {selectedNode.responsibilities.map((r) => (
                    <li key={r} className="flex items-start gap-2">
                      <span className="text-blue-400">·</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <h4 className="text-xs font-semibold text-slate-300 mb-2">
                Linked Files ({selectedNode.files.length})
              </h4>
              {selectedNode.files.length === 0 ? (
                <p className="text-xs text-slate-500">Logical grouping across repository.</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {selectedNode.files.map((fp) => (
                    <button
                      key={fp}
                      type="button"
                      onClick={() => onOpenFile(fp)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-white/[0.06] bg-[#0B0F19] hover:border-blue-500/40 text-left text-xs font-mono text-blue-300 transition-colors"
                    >
                      <FileCode2 className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{fp}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-sm text-slate-400">
            Select any module node on the canvas to inspect its responsibilities and linked files.
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-white/[0.08] text-xs text-slate-500">
          Scroll to zoom, drag background to pan, click any node to inspect connections.
        </div>
      </aside>
    </div>
  );
}
