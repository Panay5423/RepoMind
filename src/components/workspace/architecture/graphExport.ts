import { toPng } from 'html-to-image';
import { getNodesBounds, getViewportForBounds, type Node } from 'reactflow';
import type {
  GraphEdgeDTO,
  GraphEdgeRelation,
  GraphLevel,
  GraphNodeDTO,
} from '../../../../shared/types.ts';
import { NODE_KIND_META, RELATION_META, type LayoutMode } from './graphConstants.ts';

export type ArchitectureExportFormat = 'png' | 'svg';

export interface ExportArchitectureGraphOptions {
  format: ArchitectureExportFormat;
  repositoryName: string;
  level: GraphLevel;
  layoutMode: LayoutMode;
  nodes: GraphNodeDTO[];
  edges: GraphEdgeDTO[];
  basePositions: Map<string, { x: number; y: number }>;
  manualOffsets: Map<string, { x: number; y: number }>;
  rfNodes?: Node[];
  flowWrapperEl?: HTMLElement | null;
}

export interface ExportArchitectureResult {
  filename: string;
  format: ArchitectureExportFormat;
  method: 'svg' | 'dom-png' | 'svg-canvas-png';
}

const NODE_W = 244;
const NODE_H = 96;
const HEADER_H = 56;
const PADDING = 48;

function sanitizeFilename(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'repomind';
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function mergeNodePositions(
  nodes: GraphNodeDTO[],
  basePositions: Map<string, { x: number; y: number }>,
  manualOffsets: Map<string, { x: number; y: number }>
): Map<string, { x: number; y: number }> {
  const merged = new Map<string, { x: number; y: number }>();
  for (const n of nodes) {
    const pos = manualOffsets.get(n.id) || basePositions.get(n.id) || { x: 40, y: 40 };
    merged.set(n.id, pos);
  }
  return merged;
}

export function buildArchitectureSvg(params: {
  repositoryName: string;
  level: GraphLevel;
  layoutMode: LayoutMode;
  nodes: GraphNodeDTO[];
  edges: GraphEdgeDTO[];
  positions: Map<string, { x: number; y: number }>;
}): { svg: string; width: number; height: number } {
  const { repositoryName, level, layoutMode, nodes, edges, positions } = params;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const n of nodes) {
    const p = positions.get(n.id) || { x: 40, y: 40 };
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + NODE_W);
    maxY = Math.max(maxY, p.y + NODE_H);
  }

  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 960;
    maxY = 540;
  }

  const offsetX = PADDING - minX;
  const offsetY = HEADER_H + PADDING - minY;
  const width = Math.max(960, Math.ceil(maxX - minX + PADDING * 2));
  const height = Math.max(580, Math.ceil(maxY - minY + HEADER_H + PADDING * 2));

  // Per-relation colored arrowheads
  const usedRelations = Array.from(
    new Set<GraphEdgeRelation>(edges.map((e) => e.relation))
  );
  const markerDefs = usedRelations
    .map((rel) => {
      const style = RELATION_META[rel] || RELATION_META.IMPORTS;
      return `<marker id="arrow-${rel}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="${style.color}" />
    </marker>`;
    })
    .join('\n    ');

  // Optional module group containers for grouped layout
  let groupBoxesSvg = '';
  if (layoutMode === 'grouped' && nodes.length > 0) {
    const groups = new Map<string, GraphNodeDTO[]>();
    for (const n of nodes) {
      const g = n.moduleGroup || n.folder || n.layer || 'core';
      const list = groups.get(g) || [];
      list.push(n);
      groups.set(g, list);
    }

    groupBoxesSvg = Array.from(groups.entries())
      .map(([groupName, items]) => {
        const pts = items.map((i) => positions.get(i.id) || { x: 40, y: 40 });
        const gx = Math.min(...pts.map((p) => p.x)) + offsetX - 18;
        const gy = Math.min(...pts.map((p) => p.y)) + offsetY - 36;
        const gw = Math.max(...pts.map((p) => p.x)) + offsetX + NODE_W + 18 - gx;
        const gh = Math.max(...pts.map((p) => p.y)) + offsetY + NODE_H + 18 - gy;
        return `<g>
  <rect x="${gx}" y="${gy}" width="${gw}" height="${gh}" rx="12" fill="#0B0F19" fill-opacity="0.7" stroke="#334155" stroke-opacity="0.45" stroke-width="1" />
  <text x="${gx + 12}" y="${gy + 20}" fill="#CBD5E1" font-family="ui-sans-serif, system-ui, sans-serif" font-weight="600" font-size="11">${escapeXml(groupName)} · ${items.length}</text>
</g>`;
      })
      .join('\n');
  }

  const edgeSvg = edges
    .map((e) => {
      const ps = positions.get(e.source);
      const pt = positions.get(e.target);
      if (!ps || !pt) return '';

      const sx = ps.x + offsetX;
      const sy = ps.y + offsetY;
      const tx = pt.x + offsetX;
      const ty = pt.y + offsetY;

      const x1 = sx + NODE_W;
      const y1 = sy + NODE_H / 2;
      const x2 = tx;
      const y2 = ty + NODE_H / 2;
      const dx = Math.max(60, Math.abs(x2 - x1) * 0.42);
      const rel = RELATION_META[e.relation] || RELATION_META.IMPORTS;
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2 - 7;
      const label = escapeXml((e.label || e.relation).slice(0, 28));

      return `<g>
  <path d="M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}" fill="none" stroke="${rel.color}" stroke-width="1.6" stroke-opacity="0.88" ${rel.dash ? `stroke-dasharray="${rel.dash}"` : ''} marker-end="url(#arrow-${e.relation})" />
  <rect x="${midX - label.length * 3.1 - 5}" y="${midY - 9}" width="${label.length * 6.2 + 10}" height="14" rx="3" fill="#070A12" fill-opacity="0.9" />
  <text x="${midX}" y="${midY + 1}" fill="#94A3B8" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="9.5" text-anchor="middle">${label}</text>
</g>`;
    })
    .join('\n');

  const nodeSvg = nodes
    .map((n) => {
      const p = positions.get(n.id) || { x: 40, y: 40 };
      const nx = p.x + offsetX;
      const ny = p.y + offsetY;
      const meta = NODE_KIND_META[n.kind] || NODE_KIND_META.file;
      const subtitle = n.filePath
        ? `${n.filePath}${n.line ? `:${n.line}` : ''}`
        : n.description;

      return `<g transform="translate(${nx}, ${ny})">
  <rect width="${NODE_W}" height="${NODE_H}" rx="8" fill="#111827" stroke="${meta.hexColor}" stroke-opacity="0.65" stroke-width="1.3" />
  <circle cx="8" cy="18" r="3" fill="${meta.hexColor}" />
  <text x="17" y="21" fill="${meta.hexColor}" font-family="ui-sans-serif, system-ui, sans-serif" font-weight="600" font-size="10.5">${escapeXml(meta.label)}</text>
  <text x="12" y="42" fill="#F8FAFC" font-family="ui-sans-serif, system-ui, sans-serif" font-weight="600" font-size="13">${escapeXml(n.name.slice(0, 27))}</text>
  <text x="12" y="60" fill="#94A3B8" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="10">${escapeXml(subtitle.slice(0, 34))}</text>
  <line x1="10" y1="71" x2="${NODE_W - 10}" y2="71" stroke="#FFFFFF" stroke-opacity="0.06" stroke-width="1" />
  <text x="12" y="85" fill="#64748B" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="9.5">${escapeXml(n.layer)}</text>
  <text x="${NODE_W - 12}" y="85" fill="#64748B" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="9.5" text-anchor="end">in ${n.incomingCount} · out ${n.outgoingCount}</text>
</g>`;
    })
    .join('\n');

  const subtitle = `${level.toUpperCase()} ARCHITECTURE · ${layoutMode.toUpperCase()} LAYOUT · ${nodes.length} NODES · ${edges.length} EDGES`;
  const timestamp = new Date().toISOString().slice(0, 10);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="0.8" fill="#94A3B8" fill-opacity="0.16" />
    </pattern>
    ${markerDefs}
  </defs>
  <rect width="100%" height="100%" fill="#070A12" />
  <rect y="${HEADER_H}" width="100%" height="${height - HEADER_H}" fill="url(#grid)" />
  <rect width="100%" height="${HEADER_H}" fill="#0B0F19" />
  <line x1="0" y1="${HEADER_H}" x2="${width}" y2="${HEADER_H}" stroke="#FFFFFF" stroke-opacity="0.08" stroke-width="1" />
  <text x="24" y="25" fill="#F8FAFC" font-family="ui-sans-serif, system-ui, sans-serif" font-weight="700" font-size="14">${escapeXml(repositoryName)}</text>
  <text x="24" y="42" fill="#94A3B8" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="10">${escapeXml(subtitle)}</text>
  <text x="${width - 24}" y="33" fill="#64748B" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="10" text-anchor="end">RepoMind · ${timestamp}</text>
  ${groupBoxesSvg}
  ${edgeSvg}
  ${nodeSvg}
</svg>`;

  return { svg, width, height };
}

async function renderSvgStringToPngDataUrl(
  svgString: string,
  width: number,
  height: number,
  pixelRatio = 2
): Promise<string> {
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const blobUrl = URL.createObjectURL(svgBlob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Failed to load generated SVG for PNG rasterization.'));
      image.src = blobUrl;
    });

    const maxCanvasDim = 8192;
    const scale = Math.min(
      pixelRatio,
      maxCanvasDim / Math.max(1, width),
      maxCanvasDim / Math.max(1, height)
    );

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable.');

    ctx.fillStyle = '#070A12';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, width, height);

    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

function triggerDownload(href: string, filename: string): void {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function exportArchitectureGraph(
  options: ExportArchitectureGraphOptions
): Promise<ExportArchitectureResult> {
  const {
    format,
    repositoryName,
    level,
    layoutMode,
    nodes,
    edges,
    basePositions,
    manualOffsets,
    rfNodes = [],
    flowWrapperEl,
  } = options;

  const baseName = `${sanitizeFilename(repositoryName)}-${level}-architecture`;
  const mergedPositions = mergeNodePositions(nodes, basePositions, manualOffsets);

  if (format === 'svg') {
    const { svg } = buildArchitectureSvg({
      repositoryName,
      level,
      layoutMode,
      nodes,
      edges,
      positions: mergedPositions,
    });
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const filename = `${baseName}.svg`;
    try {
      triggerDownload(url, filename);
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    return { filename, format: 'svg', method: 'svg' };
  }

  // PNG export: capture the entire React Flow graph viewport cleanly without controls/minimap
  const filename = `${baseName}.png`;
  const viewportEl = flowWrapperEl?.querySelector('.react-flow__viewport') as HTMLElement | null;

  if (viewportEl && rfNodes.length > 0) {
    try {
      const normalizedNodes: Node[] = rfNodes.map((n) => ({
        ...n,
        width: n.width ?? (n.type === 'groupNode' ? Number(n.style?.width || 280) : NODE_W),
        height: n.height ?? (n.type === 'groupNode' ? Number(n.style?.height || 120) : NODE_H),
      }));
      const bounds = getNodesBounds(normalizedNodes);
      const imageWidth = Math.max(1200, Math.min(3600, Math.ceil(bounds.width + 160)));
      const imageHeight = Math.max(720, Math.min(2600, Math.ceil(bounds.height + 160)));
      const viewport = getViewportForBounds(bounds, imageWidth, imageHeight, 0.2, 1.5, 0.12);

      const dataUrl = await toPng(viewportEl, {
        backgroundColor: '#070A12',
        width: imageWidth,
        height: imageHeight,
        pixelRatio: 2,
        skipFonts: true,
        style: {
          width: `${imageWidth}px`,
          height: `${imageHeight}px`,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        },
      });

      triggerDownload(dataUrl, filename);
      return { filename, format: 'png', method: 'dom-png' };
    } catch {
      // Fall through to deterministic SVG -> Canvas PNG rasterization
    }
  }

  // Deterministic SVG -> Canvas PNG rasterizer fallback (also works when canvas tab is inactive)
  const { svg, width, height } = buildArchitectureSvg({
    repositoryName,
    level,
    layoutMode,
    nodes,
    edges,
    positions: mergedPositions,
  });
  const pngDataUrl = await renderSvgStringToPngDataUrl(svg, width, height, 2);
  triggerDownload(pngDataUrl, filename);
  return { filename, format: 'png', method: 'svg-canvas-png' };
}
