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
    ? 'border-[#2563EB] bg-white shadow-[0_0_0_2px_rgba(37,99,235,0.22),0_12px_28px_-6px_rgba(37,99,235,0.24)]'
    : data.isSearchMatch
      ? 'border-[#F59E0B] bg-[#FFFBEB]/45 shadow-[0_0_0_2px_rgba(245,158,11,0.22),0_10px_22px_-8px_rgba(217,119,6,0.2)]'
      : data.isConnectedToSelection
        ? 'border-[#60A5FA] bg-[#EFF6FF]/40 shadow-[0_4px_14px_-4px_rgba(37,99,235,0.14)]'
        : `${meta.borderClass} ${meta.bgClass} shadow-[0_2px_10px_-4px_rgba(15,23,42,0.08)] hover:shadow-[0_10px_22px_-8px_rgba(37,99,235,0.16)]`;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{
        opacity: data.isDimmed ? 0.26 : 1,
        scale: 1,
      }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={`group w-[248px] rounded-xl border px-3.5 py-2.5 transition-[border-color,background-color,box-shadow] duration-200 ${borderAndGlowClass}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-[#2563EB] !w-2 !h-2 !border !border-white !-left-[4.5px] opacity-80 group-hover:opacity-100 transition-opacity"
      />

      {/* Top Metadata Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 min-w-0">
          <span
            className={`w-5 h-5 rounded-md ${meta.iconBg} flex items-center justify-center shrink-0`}
          >
            <Icon className={`w-3 h-3 ${meta.accentText}`} />
          </span>
          <span className="text-[11px] font-medium text-[#64748B] truncate">{meta.label}</span>
        </div>

        {data.drillDownLevel && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              data.onDrillDown?.(data);
            }}
            title={`Drill down to ${data.drillDownLevel} architecture`}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-mono text-[#64748B] hover:text-[#2563EB] hover:bg-[#EFF6FF] transition-colors shrink-0"
          >
            <ArrowDownRight className="w-3 h-3" />
            <span>{data.drillDownLevel}</span>
          </button>
        )}
      </div>

      {/* Node Title */}
      <div
        className="mt-1.5 text-[13px] leading-snug font-semibold text-[#0F172A] truncate tracking-[-0.01em]"
        title={data.name}
      >
        {data.name}
      </div>

      {/* File Path or Description */}
      <div
        className="mt-0.5 text-[11px] font-mono text-[#64748B] truncate"
        title={data.filePath || data.description}
      >
        {data.filePath
          ? `${data.filePath}${data.line ? `:${data.line}` : ''}`
          : data.description}
      </div>

      {/* Footer Hairline */}
      <div className="mt-2 pt-2 border-t border-[#F1F5F9] flex items-center justify-between text-[10.5px] font-mono text-[#64748B] tabular-nums">
        <span className="truncate">{data.layer}</span>
        <span className="shrink-0">
          in {data.incomingCount} · out {data.outgoingCount}
        </span>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-[#3B82F6] !w-2 !h-2 !border !border-white !-right-[4.5px] opacity-80 group-hover:opacity-100 transition-opacity"
      />
    </motion.div>
  );
});

export const GroupContainerNode = memo(function GroupContainerNode({
  data,
}: NodeProps<GroupContainerRenderData>) {
  return (
    <div className="w-full h-full rounded-2xl border border-[#CBD5E1] bg-[#EFF6FF]/45 px-3.5 py-2.5 shadow-2xs">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          data.onToggle(data.groupKey);
        }}
        title={data.collapsed ? 'Expand module group' : 'Collapse module group'}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B1F3A] hover:text-[#2563EB] transition-colors"
      >
        <ChevronDown
          className={`w-3.5 h-3.5 text-[#2563EB] transition-transform duration-200 ${
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
