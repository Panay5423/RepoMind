import {
  Activity,
  Box,
  Braces,
  Cpu,
  Database,
  FileCode2,
  FolderTree,
  GitBranch,
  Globe,
  Layers,
  Lock,
  Package,
  Play,
  Radio,
  Server,
  Shield,
  Sliders,
  Terminal,
  Variable,
  Webhook,
  Workflow,
  Zap,
} from 'lucide-react';
import type {
  ArchitectureIntelligenceDTO,
  ArchitectureLayer,
  GraphEdgeDTO,
  GraphEdgeRelation,
  GraphNodeDTO,
  GraphNodeKind,
} from '../../../../shared/types.ts';

export type LayoutMode = 'hierarchical' | 'layered' | 'force' | 'circular' | 'grouped';

export interface NodeKindStyle {
  label: string;
  accentText: string;
  borderClass: string;
  bgClass: string;
  hexColor: string;
  icon: typeof Box;
}

export const NODE_KIND_META: Record<GraphNodeKind, NodeKindStyle> = {
  application: {
    label: 'Application',
    accentText: 'text-blue-400',
    borderClass: 'border-blue-500/40',
    bgClass: 'bg-[#0F172A]',
    hexColor: '#3B82F6',
    icon: Globe,
  },
  module: {
    label: 'Module',
    accentText: 'text-indigo-400',
    borderClass: 'border-indigo-500/40',
    bgClass: 'bg-[#11162B]',
    hexColor: '#6366F1',
    icon: FolderTree,
  },
  component: {
    label: 'Component',
    accentText: 'text-sky-400',
    borderClass: 'border-sky-500/40',
    bgClass: 'bg-[#0C1829]',
    hexColor: '#38BDF8',
    icon: Layers,
  },
  class: {
    label: 'Class',
    accentText: 'text-amber-400',
    borderClass: 'border-amber-500/40',
    bgClass: 'bg-[#1A1610]',
    hexColor: '#F59E0B',
    icon: Box,
  },
  function: {
    label: 'Function',
    accentText: 'text-violet-400',
    borderClass: 'border-violet-500/40',
    bgClass: 'bg-[#151229]',
    hexColor: '#8B5CF6',
    icon: Braces,
  },
  method: {
    label: 'Method',
    accentText: 'text-purple-400',
    borderClass: 'border-purple-500/40',
    bgClass: 'bg-[#171226]',
    hexColor: '#A855F7',
    icon: Play,
  },
  object: {
    label: 'Object',
    accentText: 'text-teal-400',
    borderClass: 'border-teal-500/40',
    bgClass: 'bg-[#0D1B1E]',
    hexColor: '#14B8A6',
    icon: Sliders,
  },
  variable: {
    label: 'Variable',
    accentText: 'text-slate-300',
    borderClass: 'border-slate-500/40',
    bgClass: 'bg-[#111827]',
    hexColor: '#94A3B8',
    icon: Variable,
  },
  constant: {
    label: 'Constant',
    accentText: 'text-cyan-300',
    borderClass: 'border-cyan-500/40',
    bgClass: 'bg-[#0D1A22]',
    hexColor: '#22D3EE',
    icon: Lock,
  },
  interface: {
    label: 'Interface',
    accentText: 'text-emerald-300',
    borderClass: 'border-emerald-500/40',
    bgClass: 'bg-[#0B1C18]',
    hexColor: '#34D399',
    icon: GitBranch,
  },
  type: {
    label: 'Type',
    accentText: 'text-lime-300',
    borderClass: 'border-lime-500/40',
    bgClass: 'bg-[#121C10]',
    hexColor: '#A3E635',
    icon: Terminal,
  },
  api_endpoint: {
    label: 'API Endpoint',
    accentText: 'text-fuchsia-400',
    borderClass: 'border-fuchsia-500/40',
    bgClass: 'bg-[#1C1024]',
    hexColor: '#E879F9',
    icon: Webhook,
  },
  controller: {
    label: 'Controller',
    accentText: 'text-blue-300',
    borderClass: 'border-blue-400/40',
    bgClass: 'bg-[#0F192B]',
    hexColor: '#60A5FA',
    icon: Cpu,
  },
  service: {
    label: 'Service',
    accentText: 'text-cyan-400',
    borderClass: 'border-cyan-500/40',
    bgClass: 'bg-[#0C1A26]',
    hexColor: '#06B6D4',
    icon: Server,
  },
  middleware: {
    label: 'Middleware',
    accentText: 'text-orange-400',
    borderClass: 'border-orange-500/40',
    bgClass: 'bg-[#1D150E]',
    hexColor: '#FB923C',
    icon: Shield,
  },
  database: {
    label: 'Database',
    accentText: 'text-emerald-400',
    borderClass: 'border-emerald-500/45',
    bgClass: 'bg-[#0B1D17]',
    hexColor: '#10B981',
    icon: Database,
  },
  collection: {
    label: 'Collection',
    accentText: 'text-emerald-400',
    borderClass: 'border-emerald-500/40',
    bgClass: 'bg-[#0C1D1A]',
    hexColor: '#10B981',
    icon: Database,
  },
  model: {
    label: 'Model',
    accentText: 'text-green-400',
    borderClass: 'border-green-500/40',
    bgClass: 'bg-[#0D1E14]',
    hexColor: '#22C55E',
    icon: Database,
  },
  route: {
    label: 'Route',
    accentText: 'text-violet-300',
    borderClass: 'border-violet-500/40',
    bgClass: 'bg-[#151226]',
    hexColor: '#A78BFA',
    icon: Workflow,
  },
  event: {
    label: 'Event',
    accentText: 'text-yellow-400',
    borderClass: 'border-yellow-500/40',
    bgClass: 'bg-[#1D190C]',
    hexColor: '#FACC15',
    icon: Zap,
  },
  socket: {
    label: 'Socket',
    accentText: 'text-pink-400',
    borderClass: 'border-pink-500/40',
    bgClass: 'bg-[#1F101B]',
    hexColor: '#F472B6',
    icon: Radio,
  },
  external_dependency: {
    label: 'External Pkg',
    accentText: 'text-rose-300',
    borderClass: 'border-rose-500/35',
    bgClass: 'bg-[#1C1217]',
    hexColor: '#FB7185',
    icon: Package,
  },
  background_worker: {
    label: 'Worker',
    accentText: 'text-amber-300',
    borderClass: 'border-amber-500/40',
    bgClass: 'bg-[#1B160D]',
    hexColor: '#FBBF24',
    icon: Activity,
  },
  file: {
    label: 'Source File',
    accentText: 'text-slate-300',
    borderClass: 'border-white/15',
    bgClass: 'bg-[#111827]',
    hexColor: '#64748B',
    icon: FileCode2,
  },
};

export interface RelationStyle {
  color: string;
  dash?: string;
  animated?: boolean;
  description: string;
}

export const RELATION_META: Record<GraphEdgeRelation, RelationStyle> = {
  IMPORTS: { color: '#64748B', description: 'Static module import dependency' },
  EXPORTS: { color: '#818CF8', dash: '3 3', description: 'Symbol or member exported by module/class' },
  CALLS: { color: '#60A5FA', description: 'Direct function or method invocation' },
  USES: { color: '#38BDF8', dash: '5 3', description: 'Uses referenced symbol or utility' },
  EXTENDS: { color: '#F59E0B', dash: '6 3', description: 'Class inheritance relationship' },
  IMPLEMENTS: { color: '#34D399', dash: '4 4', description: 'Interface contract implementation' },
  INSTANTIATES: { color: '#A855F7', dash: '4 2', description: 'Constructs class instance with new' },
  READS: { color: '#10B981', animated: true, description: 'Database or state read operation' },
  WRITES: { color: '#F97316', animated: true, description: 'Database or state write/mutation' },
  DEPENDS_ON: { color: '#FB7185', dash: '2 4', description: 'External package or module dependency' },
  TRIGGERS: { color: '#FACC15', animated: true, description: 'Emits socket event or triggers job' },
  LISTENS_TO: { color: '#F472B6', dash: '5 3', description: 'Subscribes or listens to event/socket' },
  SENDS_DATA_TO: { color: '#3B82F6', animated: true, description: 'Transmits HTTP/API request payload' },
  RETURNS: { color: '#22D3EE', dash: '3 3', description: 'Returns response or computed data' },
  INJECTS: { color: '#C084FC', dash: '6 2', description: 'Dependency injection via constructor' },
  QUERIES: { color: '#10B981', animated: true, description: 'Executes database query' },
};

const LAYER_COLUMN_ORDER: Record<ArchitectureLayer, number> = {
  frontend: 0,
  realtime: 1,
  api: 1,
  backend: 2,
  service: 2,
  worker: 3,
  database: 4,
  shared: 3,
  config: 4,
  external: 5,
};

export function computeNodePositions(
  nodes: GraphNodeDTO[],
  edges: GraphEdgeDTO[],
  mode: LayoutMode
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  if (nodes.length === 0) return positions;

  if (mode === 'layered') {
    const byCol = new Map<number, GraphNodeDTO[]>();
    for (const n of nodes) {
      const col = LAYER_COLUMN_ORDER[n.layer] ?? 2;
      const list = byCol.get(col) || [];
      list.push(n);
      byCol.set(col, list);
    }
    const cols = Array.from(byCol.keys()).sort((a, b) => a - b);
    cols.forEach((col, cIdx) => {
      const items = (byCol.get(col) || []).sort((a, b) => b.usageCount - a.usageCount);
      items.forEach((n, rIdx) => {
        positions.set(n.id, { x: cIdx * 320 + 40, y: rIdx * 135 + 40 });
      });
    });
    return positions;
  }

  if (mode === 'hierarchical') {
    // Topological BFS rank starting from roots (0 incoming or frontend/endpoint)
    const inDeg = new Map<string, number>();
    const outAdj = new Map<string, string[]>();
    for (const n of nodes) {
      inDeg.set(n.id, 0);
      outAdj.set(n.id, []);
    }
    for (const e of edges) {
      if (inDeg.has(e.target) && outAdj.has(e.source)) {
        inDeg.set(e.target, (inDeg.get(e.target) || 0) + 1);
        outAdj.get(e.source)!.push(e.target);
      }
    }

    const rank = new Map<string, number>();
    const queue: string[] = [];
    for (const n of nodes) {
      if ((inDeg.get(n.id) || 0) === 0 || n.layer === 'frontend') {
        rank.set(n.id, 0);
        queue.push(n.id);
      }
    }
    if (queue.length === 0) {
      rank.set(nodes[0].id, 0);
      queue.push(nodes[0].id);
    }

    const visited = new Set<string>(queue);
    while (queue.length > 0) {
      const curr = queue.shift()!;
      const r = rank.get(curr) || 0;
      for (const next of outAdj.get(curr) || []) {
        const prevRank = rank.get(next);
        if (prevRank === undefined || (prevRank < r + 1 && r + 1 <= 7)) {
          rank.set(next, Math.min(7, r + 1));
        }
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
    for (const n of nodes) {
      if (!rank.has(n.id)) {
        rank.set(n.id, LAYER_COLUMN_ORDER[n.layer] ?? 2);
      }
    }

    const byRank = new Map<number, GraphNodeDTO[]>();
    for (const n of nodes) {
      const r = rank.get(n.id) || 0;
      const list = byRank.get(r) || [];
      list.push(n);
      byRank.set(r, list);
    }
    const maxColHeight = Math.max(...Array.from(byRank.values()).map((v) => v.length), 1);
    const ranks = Array.from(byRank.keys()).sort((a, b) => a - b);
    ranks.forEach((r, cIdx) => {
      const items = byRank.get(r) || [];
      const offsetY = ((maxColHeight - items.length) * 135) / 2;
      items.forEach((n, rIdx) => {
        positions.set(n.id, { x: cIdx * 320 + 40, y: offsetY + rIdx * 135 + 40 });
      });
    });
    return positions;
  }

  if (mode === 'circular') {
    const sorted = [...nodes].sort((a, b) => a.layer.localeCompare(b.layer));
    const radius = Math.max(260, sorted.length * 36);
    const cx = radius + 160;
    const cy = radius + 120;
    sorted.forEach((n, idx) => {
      const angle = (2 * Math.PI * idx) / Math.max(1, sorted.length) - Math.PI / 2;
      positions.set(n.id, {
        x: Math.round(cx + radius * Math.cos(angle)),
        y: Math.round(cy + radius * Math.sin(angle)),
      });
    });
    return positions;
  }

  if (mode === 'grouped') {
    const groups = new Map<string, GraphNodeDTO[]>();
    for (const n of nodes) {
      const g = n.moduleGroup || n.folder || n.layer || 'core';
      const list = groups.get(g) || [];
      list.push(n);
      groups.set(g, list);
    }
    const groupKeys = Array.from(groups.keys()).sort();
    let cursorX = 40;
    let cursorY = 40;
    let rowMaxH = 0;
    const maxRowWidth = 1480;

    for (const g of groupKeys) {
      const items = groups.get(g) || [];
      const cols = Math.min(2, items.length);
      const rows = Math.ceil(items.length / cols);
      const boxW = cols * 270 + 60;
      const boxH = rows * 125 + 60;

      if (cursorX + boxW > maxRowWidth && cursorX > 40) {
        cursorX = 40;
        cursorY += rowMaxH + 48;
        rowMaxH = 0;
      }

      items.forEach((n, idx) => {
        const c = idx % cols;
        const r = Math.floor(idx / cols);
        positions.set(n.id, {
          x: cursorX + 24 + c * 270,
          y: cursorY + 48 + r * 125,
        });
      });

      cursorX += boxW + 40;
      rowMaxH = Math.max(rowMaxH, boxH);
    }
    return positions;
  }

  // Deterministic Fruchterman-Reingold force-directed layout
  const nCount = nodes.length;
  const width = Math.max(1100, Math.sqrt(nCount) * 380);
  const height = Math.max(760, Math.sqrt(nCount) * 260);
  const pos = new Map<string, { x: number; y: number }>();

  nodes.forEach((n, idx) => {
    const angle = (2 * Math.PI * idx) / Math.max(1, nCount);
    const r = Math.min(width, height) * 0.36;
    pos.set(n.id, {
      x: width / 2 + r * Math.cos(angle),
      y: height / 2 + r * Math.sin(angle),
    });
  });

  const k = Math.sqrt((width * height) / Math.max(1, nCount)) * 1.15;
  const disp = new Map<string, { dx: number; dy: number }>();
  const validIds = new Set(nodes.map((n) => n.id));
  const activeEdges = edges.filter((e) => validIds.has(e.source) && validIds.has(e.target));

  for (let iter = 0; iter < 85; iter++) {
    for (const n of nodes) disp.set(n.id, { dx: 0, dy: 0 });

    // Repulsion
    for (let i = 0; i < nodes.length; i++) {
      const v = nodes[i];
      const pv = pos.get(v.id)!;
      const dv = disp.get(v.id)!;
      for (let j = i + 1; j < nodes.length; j++) {
        const u = nodes[j];
        const pu = pos.get(u.id)!;
        const du = disp.get(u.id)!;
        const rx = pv.x - pu.x;
        const ry = pv.y - pu.y;
        const dist = Math.max(24, Math.hypot(rx, ry));
        const force = (k * k) / dist;
        const fx = (rx / dist) * force;
        const fy = (ry / dist) * force;
        dv.dx += fx;
        dv.dy += fy;
        du.dx -= fx;
        du.dy -= fy;
      }
    }

    // Attraction
    for (const e of activeEdges) {
      const ps = pos.get(e.source);
      const pt = pos.get(e.target);
      if (!ps || !pt) continue;
      const ds = disp.get(e.source)!;
      const dt = disp.get(e.target)!;
      const ax = ps.x - pt.x;
      const ay = ps.y - pt.y;
      const dist = Math.max(24, Math.hypot(ax, ay));
      const force = (dist * dist) / k;
      const fx = (ax / dist) * force;
      const fy = (ay / dist) * force;
      ds.dx -= fx;
      ds.dy -= fy;
      dt.dx += fx;
      dt.dy += fy;
    }

    const temp = (width / 10) * (1 - iter / 90);
    for (const n of nodes) {
      const p = pos.get(n.id)!;
      const d = disp.get(n.id)!;
      const mag = Math.max(1, Math.hypot(d.dx, d.dy));
      p.x += (d.dx / mag) * Math.min(mag, temp);
      p.y += (d.dy / mag) * Math.min(mag, temp);
    }
  }

  // Normalize min coordinates & resolve close node overlap
  const list = Array.from(pos.entries());
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i][1];
        const b = list[j][1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        if (Math.abs(dx) < 260 && Math.abs(dy) < 115) {
          const pushY = dy >= 0 ? 60 : -60;
          b.y += pushY;
          a.y -= pushY / 2;
        }
      }
    }
  }

  const minX = Math.min(...list.map(([, p]) => p.x));
  const minY = Math.min(...list.map(([, p]) => p.y));
  for (const [id, p] of list) {
    positions.set(id, { x: Math.round(p.x - minX + 40), y: Math.round(p.y - minY + 40) });
  }
  return positions;
}

export function buildStandaloneSvg(
  nodes: GraphNodeDTO[],
  edges: GraphEdgeDTO[],
  positions: Map<string, { x: number; y: number }>,
  title: string
): string {
  const nodeW = 240;
  const nodeH = 88;
  let maxX = 900;
  let maxY = 600;

  for (const n of nodes) {
    const p = positions.get(n.id) || { x: 40, y: 40 };
    maxX = Math.max(maxX, p.x + nodeW + 60);
    maxY = Math.max(maxY, p.y + nodeH + 60);
  }

  const escapeXml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const edgeSvg = edges
    .map((e) => {
      const ps = positions.get(e.source);
      const pt = positions.get(e.target);
      if (!ps || !pt) return '';
      const x1 = ps.x + nodeW;
      const y1 = ps.y + nodeH / 2;
      const x2 = pt.x;
      const y2 = pt.y + nodeH / 2;
      const rel = RELATION_META[e.relation] || RELATION_META.IMPORTS;
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2 - 6;
      return `<path d="M ${x1} ${y1} C ${x1 + 60} ${y1}, ${x2 - 60} ${y2}, ${x2} ${y2}" fill="none" stroke="${rel.color}" stroke-width="1.6" ${rel.dash ? `stroke-dasharray="${rel.dash}"` : ''} marker-end="url(#arrow)" />
<text x="${midX}" y="${midY}" fill="#94A3B8" font-family="monospace" font-size="10" text-anchor="middle">${escapeXml(e.label || e.relation)}</text>`;
    })
    .join('\n');

  const nodeSvg = nodes
    .map((n) => {
      const p = positions.get(n.id) || { x: 40, y: 40 };
      const meta = NODE_KIND_META[n.kind] || NODE_KIND_META.file;
      return `<g transform="translate(${p.x}, ${p.y})">
  <rect width="${nodeW}" height="${nodeH}" rx="8" fill="#111827" stroke="${meta.hexColor}" stroke-opacity="0.65" stroke-width="1.2" />
  <text x="12" y="22" fill="${meta.hexColor}" font-family="monospace" font-size="10">${escapeXml(meta.label)}</text>
  <text x="12" y="42" fill="#F8FAFC" font-family="sans-serif" font-weight="600" font-size="13">${escapeXml(n.name.slice(0, 26))}</text>
  <text x="12" y="62" fill="#94A3B8" font-family="monospace" font-size="10">${escapeXml((n.filePath || n.description).slice(0, 32))}</text>
  <text x="12" y="77" fill="#64748B" font-family="monospace" font-size="9">in:${n.incomingCount} out:${n.outgoingCount}</text>
</g>`;
    })
    .join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${maxX}" height="${maxY}" viewBox="0 0 ${maxX} ${maxY}">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#64748B" />
    </marker>
  </defs>
  <rect width="100%" height="100%" fill="#070A12" />
  <text x="24" y="26" fill="#E2E8F0" font-family="sans-serif" font-weight="600" font-size="14">${escapeXml(title)}</text>
  ${edgeSvg}
  ${nodeSvg}
</svg>`;
}

export function buildDependencyReportMarkdown(intel: ArchitectureIntelligenceDTO): string {
  const m = intel.complexityMetrics;
  const lines = [
    `# Deterministic Dependency & Architecture Report: ${intel.repositoryName}`,
    `Generated: ${intel.generatedAt}`,
    '',
    `## Complexity & Structural Metrics`,
    `- Files Parsed: ${m.fileCount}`,
    `- Functions: ${m.functionCount} | Methods: ${m.methodCount} | Classes: ${m.classCount} | Objects: ${m.objectCount}`,
    `- Interfaces & Types: ${m.interfaceAndTypeCount} | Variables & Constants: ${m.variableAndConstantCount}`,
    `- Imports: ${m.importCount} | External Dependencies: ${m.dependencyCount}`,
    `- API Endpoints: ${m.endpointCount} | Database Models: ${m.modelCount} | Socket Events: ${m.socketEventCount}`,
    `- Circular Dependency Cycles: ${m.circularDependencyCount}`,
    `- Unused Imports: ${m.unusedImportCount}`,
    `- Orphaned Files: ${m.orphanedFileCount}`,
    '',
    `## Circular Dependencies (${intel.dependencyAnalysis.circularDependencies.length})`,
    ...(intel.dependencyAnalysis.circularDependencies.length === 0
      ? ['- None detected.']
      : intel.dependencyAnalysis.circularDependencies.map((c) => `- ${c.join(' -> ')}`)),
    '',
    `## Highly Coupled Modules`,
    ...intel.dependencyAnalysis.highlyCoupledNodes.map(
      (n) => `- **${n.name}** (${n.kind}) — ${n.inDegree} incoming, ${n.outDegree} outgoing (${n.filePath || 'virtual'})`
    ),
    '',
    `## Unused Imports (${intel.dependencyAnalysis.unusedImports.length})`,
    ...intel.dependencyAnalysis.unusedImports
      .slice(0, 40)
      .map((u) => `- \`${u.filePath}:${u.line}\` — \`${u.identifier}\` from \`${u.source}\``),
    '',
    `## Orphaned Source Files (${intel.dependencyAnalysis.orphanedFiles.length})`,
    ...intel.dependencyAnalysis.orphanedFiles.map((f) => `- \`${f}\``),
  ];
  return lines.join('\n');
}
