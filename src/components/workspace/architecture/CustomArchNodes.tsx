import { Handle, Position, type NodeProps } from 'reactflow';
import { ChevronDown, ChevronRight, ArrowDownRight } from 'lucide-react';
import type { GraphNodeDTO } from '../../../../shared/types.ts';
import { NODE_KIND_META } from './graphConstants.ts';

export interface ArchNodeRenderData extends GraphNodeDTO {
  isFocused?: boolean;
  isConnectedToSelection?: boolean;
  isDimmed?: boolean;
  isFlowHighlighted?: boolean;
  isMultiSelected?: boolean;
  onDrillDown?: (node: GraphNodeDTO) => void;
}

export interface GroupContainerRenderData {
  label: string;
  count: number;
  collapsed: boolean;
  onToggle: (groupKey: string) => void;
  groupKey: string;
}

export function ArchSymbolNode({ data, selected }: NodeProps<ArchNodeRenderData>) {
  const meta = NODE_KIND_META[data.kind] || NODE_KIND_META.file;
  const Icon = meta.icon;

  const activeHighlight =
    selected || data.isFocused || data.isFlowHighlighted || data.isMultiSelected;

  return (
    <div
      className={`w-[244px] rounded-lg border px-3.5 py-2.5 transition-opacity duration-150 ${meta.bgClass} ${
        activeHighlight
          ? 'border-blue-400 ring-1 ring-blue-400/60'
          : data.isConnectedToSelection
            ? 'border-violet-400/70'
            : meta.borderClass
      } ${data.isDimmed ? 'opacity-25' : 'opacity-100'}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-blue-400 !w-2 !h-2 !border-0"
      />

      <div className="flex items-center justify-between gap-2">
        <div className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${meta.accentText}`}>
          <Icon className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{meta.label}</span>
        </div>
        {data.drillDownLevel && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              data.onDrillDown?.(data);
            }}
            title={`Drill down to ${data.drillDownLevel} level`}
            className="inline-flex items-center gap-0.5 text-[10px] font-mono text-slate-400 hover:text-blue-300 transition-colors shrink-0"
          >
            <ArrowDownRight className="w-3 h-3" />
            <span>{data.drillDownLevel}</span>
          </button>
        )}
      </div>

      <div className="mt-1 text-sm font-semibold text-white truncate" title={data.name}>
        {data.name}
      </div>

      <div
        className="mt-0.5 text-[11px] font-mono text-slate-400 truncate"
        title={data.filePath || data.description}
      >
        {data.filePath
          ? `${data.filePath}${data.line ? `:${data.line}` : ''}`
          : data.description}
      </div>

      <div className="mt-2 pt-1.5 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-slate-500 tabular-nums">
        <span>{data.layer}</span>
        <span>
          in {data.incomingCount} · out {data.outgoingCount}
        </span>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-violet-400 !w-2 !h-2 !border-0"
      />
    </div>
  );
}

export function GroupContainerNode({ data }: NodeProps<GroupContainerRenderData>) {
  return (
    <div className="w-full h-full rounded-xl border border-white/[0.08] bg-[#0B0F19]/65 px-3 py-2">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          data.onToggle(data.groupKey);
        }}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white transition-colors"
      >
        {data.collapsed ? (
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        )}
        <span>{data.label}</span>
        <span className="font-mono text-[11px] text-slate-500 tabular-nums">
          · {data.count}
        </span>
      </button>
    </div>
  );
}
