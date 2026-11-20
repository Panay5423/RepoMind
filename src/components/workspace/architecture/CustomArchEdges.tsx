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
    ? '#FBBF24'
    : data?.isFlowEdge
      ? '#22D3EE'
      : data?.isHighlighted || hovered
        ? '#60A5FA'
        : data?.color || '#475569';

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
        <circle r={selected ? 2.8 : 2.2} fill={selected ? '#FBBF24' : '#60A5FA'} opacity={0.9}>
          <animateMotion dur={data?.isFlowEdge ? '1.6s' : '2.2s'} repeatCount="indefinite" path={edgePath} />
        </circle>
      )}

      {showLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
            className={`pointer-events-none nodrag nopan px-2 py-0.5 rounded border text-[10px] font-mono leading-tight transition-opacity duration-150 ${
              selected
                ? 'bg-[#151D2B] border-[#FBBF24]/50 text-[#FBBF24]'
                : data?.isFlowEdge
                  ? 'bg-[#151D2B] border-[#22D3EE]/45 text-[#22D3EE]'
                  : 'bg-[#0D111B]/95 border-[#202A3A] text-[#CBD5E1]'
            }`}
          >
            {displayLabel}
          </div>
        </EdgeLabelRenderer>
      )}
    </g>
  );
});
