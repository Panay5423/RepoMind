import { memo, useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from 'reactflow';

export interface ArchEdgeRenderData {
  relation: string;
  label?: string;
  color: string;
  dash?: string;
  isHighlighted?: boolean;
  isFlowEdge?: boolean;
  isDimmed?: boolean;
}

export const ArchRelationEdge = memo(function ArchRelationEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  selected,
  data,
}: EdgeProps<ArchEdgeRenderData>) {
  const [hovered, setHovered] = useState(false);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.28,
  });

  const isHighlighted = Boolean(selected || data?.isHighlighted || data?.isFlowEdge || hovered);
  const strokeColor = selected
    ? '#F59E0B'
    : data?.isFlowEdge
      ? '#0284C7'
      : data?.isHighlighted || hovered
        ? '#2563EB'
        : data?.color || '#64748B';

  const strokeOpacity = data?.isDimmed && !isHighlighted ? 0.16 : isHighlighted ? 0.96 : 0.72;
  const strokeWidth = selected ? 2.2 : isHighlighted ? 1.85 : 1.25;
  const displayLabel = data?.label || data?.relation || '';
  const showLabel = Boolean(displayLabel && (selected || data?.isHighlighted || data?.isFlowEdge || hovered));

  return (
    <g
      className="arch-edge-enter"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Invisible wide hit-area path for easy hover & click selection */}
      <path d={edgePath} fill="none" stroke="transparent" strokeWidth={14} className="cursor-pointer" />

      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray: data?.dash,
          strokeOpacity,
          transition: 'stroke 180ms ease, stroke-opacity 180ms ease, stroke-width 180ms ease',
        }}
      />

      {/* Directional flowing particle only on active/selected/flow edges to keep GPU idle otherwise */}
      {(selected || data?.isFlowEdge || data?.isHighlighted) && (
        <circle
          r={selected ? 2.9 : 2.3}
          fill={selected ? '#F59E0B' : data?.isFlowEdge ? '#0284C7' : '#2563EB'}
          opacity={0.92}
        >
          <animateMotion dur={data?.isFlowEdge ? '1.6s' : '2.2s'} repeatCount="indefinite" path={edgePath} />
        </circle>
      )}

      {showLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
            className={`pointer-events-none nodrag nopan px-2 py-0.5 rounded-md border text-[10px] font-mono leading-tight shadow-xs transition-opacity duration-150 ${
              selected
                ? 'bg-[#FFFBEB] border-[#FCD34D] text-[#B45309]'
                : data?.isFlowEdge
                  ? 'bg-[#F0F9FF] border-[#7DD3FC] text-[#0369A1]'
                  : 'bg-white/95 border-[#E2E8F0] text-[#0F172A]'
            }`}
          >
            {displayLabel}
          </div>
        </EdgeLabelRenderer>
      )}
    </g>
  );
});
