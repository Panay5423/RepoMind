import { useMemo, useState } from 'react';
import { ArrowRight, ExternalLink, Workflow } from 'lucide-react';
import type { DataFlowChain } from '../../../../shared/types.ts';
import { NODE_KIND_META } from './graphConstants.ts';

interface DataFlowPanelProps {
  flows: DataFlowChain[];
  activeFlowId: string | null;
  onSelectFlow: (flow: DataFlowChain | null) => void;
  onOpenFile: (path: string, startLine?: number) => void;
  onFocusNode: (nodeId: string) => void;
}

const CATEGORY_LABELS: Record<DataFlowChain['category'], string> = {
  express_api: 'Express / API Route',
  frontend_api: 'Frontend → Backend',
  angular_http: 'Angular HTTP',
  database_rw: 'Database R/W',
  websocket: 'WebSocket Event',
  worker_job: 'Background Worker',
  event: 'Event Flow',
};

export function DataFlowPanel({
  flows,
  activeFlowId,
  onSelectFlow,
  onOpenFile,
  onFocusNode,
}: DataFlowPanelProps) {
  const [categoryFilter, setCategoryFilter] = useState<'all' | DataFlowChain['category']>('all');

  const availableCategories = useMemo(
    () => Array.from(new Set(flows.map((f) => f.category))),
    [flows]
  );

  const filteredFlows = useMemo(
    () =>
      categoryFilter === 'all' ? flows : flows.filter((f) => f.category === categoryFilter),
    [flows, categoryFilter]
  );

  const activeFlow =
    filteredFlows.find((f) => f.id === activeFlowId) || filteredFlows[0] || null;

  if (flows.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-[#111827] p-8 text-center">
        <Workflow className="w-7 h-7 text-slate-500 mx-auto mb-2.5" />
        <p className="text-sm font-medium text-white">No static request or event flows detected</p>
        <p className="mt-1 text-xs text-slate-400">
          Flows are detected automatically from Express/NestJS routes, HTTP clients, WebSocket events,
          and background worker hooks.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#111827] p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">End-to-End Data Flow Tracer</h3>
          <p className="text-xs text-slate-400">
            Select a traced execution chain to highlight its full path on the File graph above.
          </p>
        </div>

        <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#0B0F19] border border-white/[0.08]">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              categoryFilter === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            All ({flows.length})
          </button>
          {availableCategories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                categoryFilter === cat
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {CATEGORY_LABELS[cat] || cat}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Flow Selector List */}
        <div className="lg:col-span-4 max-h-64 overflow-y-auto space-y-1.5 pr-1">
          {filteredFlows.map((flow) => {
            const isSelected = activeFlow?.id === flow.id;
            return (
              <button
                key={flow.id}
                type="button"
                onClick={() => onSelectFlow(isSelected ? null : flow)}
                className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                  isSelected
                    ? 'border-blue-500/50 bg-blue-600/15 text-white'
                    : 'border-white/[0.06] bg-[#0B0F19] text-slate-300 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold truncate">{flow.title}</span>
                  <span className="text-[10px] font-mono text-slate-500 shrink-0 tabular-nums">
                    {flow.steps.length} steps
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] font-mono text-slate-500 truncate">
                  {CATEGORY_LABELS[flow.category]} · {flow.entryPoint}
                </div>
              </button>
            );
          })}
        </div>

        {/* Visual Step Pipeline */}
        <div className="lg:col-span-8 rounded-lg border border-white/[0.06] bg-[#0B0F19] p-4 flex flex-col justify-between">
          {activeFlow ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-2.5">
                <div>
                  <span className="text-xs font-mono text-blue-400">
                    {CATEGORY_LABELS[activeFlow.category]}
                  </span>
                  <h4 className="text-sm font-semibold text-white font-mono">
                    {activeFlow.title}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectFlow(activeFlow)}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white transition-colors"
                >
                  Highlight Path on Graph
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 py-2">
                {activeFlow.steps.map((step, idx) => {
                  const meta = NODE_KIND_META[step.kind] || NODE_KIND_META.file;
                  const Icon = meta.icon;
                  return (
                    <div key={`${step.nodeId}-${idx}`} className="flex items-center gap-2">
                      <div className="rounded-lg border border-white/10 bg-[#111827] px-3 py-2 min-w-[165px] max-w-[230px]">
                        <div className={`inline-flex items-center gap-1 text-[10px] font-medium ${meta.accentText}`}>
                          <Icon className="w-3 h-3 shrink-0" />
                          <span>{meta.label}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onFocusNode(step.nodeId)}
                          className="mt-0.5 block w-full text-left text-xs font-semibold text-white hover:text-blue-300 truncate"
                        >
                          {step.name}
                        </button>
                        {step.filePath && (
                          <button
                            type="button"
                            onClick={() => onOpenFile(step.filePath!, step.line)}
                            className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-mono text-slate-400 hover:text-blue-300 truncate max-w-full"
                          >
                            <span className="truncate">
                              {step.filePath}
                              {step.line ? `:${step.line}` : ''}
                            </span>
                            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                          </button>
                        )}
                      </div>
                      {idx < activeFlow.steps.length - 1 && (
                        <div className="flex flex-col items-center px-1">
                          <span className="text-[9px] font-mono text-slate-500">
                            {step.relationToNext || 'NEXT'}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500 py-8 text-center">
              Select a flow from the left list to inspect each step.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
