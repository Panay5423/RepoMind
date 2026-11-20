import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { ArrowDownRight, ChevronDown } from 'lucide-react';
import { motion } from 'motion/react';
import type { GraphNodeDTO } from '../../../../shared/types.ts';
import { NODE_KIND_META } from './graphConstants.ts';

export interface ArchNodeRenderData extends GraphNodeDTO {
  isFocused?: boolean;
  isConnectedToSelection?: boolean;
  isDimmed?: boolean;
  isFlowHighlighted?: boolean;
  isMultiSelected?: boolean;
  isSearchMatch?: boolean;
  onDrillDown?: (node: GraphNodeDTO) => void;
}

export interface GroupContainerRenderData {
  label: string;
  count: number;
  collapsed: boolean;
  onToggle: (groupKey: string) => void;
  groupKey: string;
}

export const ArchSymbolNode = memo(function ArchSymbolNode({
  data,
  selected,
}: NodeProps<ArchNodeRenderData>) {
  const meta = NODE_KIND_META[data.kind] || NODE_KIND_META.file;
  const Icon = meta.icon;

  const isSelectedOrFocused =
    selected || data.isFocused || data.isFlowHighlighted || data.isMultiSelected;

  const borderAndGlowClass = isSelectedOrFocused
    ? 'border-[#60A5FA] bg-[#151D2B] shadow-[0_0_0_1px_rgba(96,165,250,0.42),0_0_24px_rgba(96,165,250,0.14)]'
    : data.isSearchMatch
      ? 'border-[#FBBF24] bg-[#151D2B] shadow-[0_0_0_1px_rgba(251,191,36,0.38),0_0_18px_rgba(251,191,36,0.14)]'
      : data.isConnectedToSelection
        ? 'border-[#A78BFA]/65 bg-[#121928]'
        : `${meta.borderClass} ${meta.bgClass} hover:bg-[#151D2B]`;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{
        opacity: data.isDimmed ? 0.24 : 1,
        scale: 1,
      }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={`group w-[248px] rounded-lg border px-3.5 py-2.5 transition-[border-color,background-color,box-shadow] duration-200 ${borderAndGlowClass}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-[#60A5FA] !w-1.5 !h-1.5 !border-0 !-left-[4px] opacity-75 group-hover:opacity-100 transition-opacity"
      />

      {/* Top Metadata Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 min-w-0">
          <Icon className={`w-3.5 h-3.5 shrink-0 ${meta.accentText}`} />
          <span className="text-[11px] font-medium text-[#94A3B8] truncate">{meta.label}</span>
        </div>

        {data.drillDownLevel && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              data.onDrillDown?.(data);
            }}
            title={`Drill down to ${data.drillDownLevel} architecture`}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono text-[#64748B] hover:text-[#60A5FA] hover:bg-white/[0.04] transition-colors shrink-0"
          >
            <ArrowDownRight className="w-3 h-3" />
            <span>{data.drillDownLevel}</span>
          </button>
        )}
      </div>

      {/* Node Title */}
      <div
        className="mt-1.5 text-[13px] leading-snug font-semibold text-[#F1F5F9] truncate tracking-[-0.01em]"
        title={data.name}
      >
        {data.name}
      </div>

      {/* File Path or Description */}
      <div
        className="mt-0.5 text-[11px] font-mono text-[#94A3B8] truncate"
        title={data.filePath || data.description}
      >
        {data.filePath
          ? `${data.filePath}${data.line ? `:${data.line}` : ''}`
          : data.description}
      </div>

      {/* Footer Hairline */}
      <div className="mt-2.5 pt-2 border-t border-[#202A3A] flex items-center justify-between text-[10.5px] font-mono text-[#64748B] tabular-nums">
        <span className="truncate">{data.layer}</span>
        <span className="shrink-0">
          in {data.incomingCount} · out {data.outgoingCount}
        </span>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-[#A78BFA] !w-1.5 !h-1.5 !border-0 !-right-[4px] opacity-75 group-hover:opacity-100 transition-opacity"
      />
    </motion.div>
  );
});

export const GroupContainerNode = memo(function GroupContainerNode({
  data,
}: NodeProps<GroupContainerRenderData>) {
  return (
    <div className="w-full h-full rounded-xl border border-[#202A3A] bg-[#0D111B]/80 px-3.5 py-2.5">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          data.onToggle(data.groupKey);
        }}
        title={data.collapsed ? 'Expand module group' : 'Collapse module group'}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#CBD5E1] hover:text-[#F1F5F9] transition-colors"
      >
        <ChevronDown
          className={`w-3.5 h-3.5 text-[#64748B] transition-transform duration-200 ${
            data.collapsed ? '-rotate-90' : 'rotate-0'
          }`}
        />
        <span>{data.label}</span>
        <span className="font-mono text-[11px] text-[#64748B] tabular-nums">
          · {data.count}
        </span>
      </button>
    </div>
  );
});
