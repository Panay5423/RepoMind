import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
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
      <div className="rounded-lg border border-[#202A3A] bg-[#101623] p-8 text-center">
        <div className="w-10 h-10 rounded-lg border border-[#202A3A] bg-[#0D111B] flex items-center justify-center mx-auto mb-3">
          <Workflow className="w-5 h-5 text-[#64748B]" />
        </div>
        <p className="text-[14px] font-semibold text-[#F1F5F9]">
          No static request or event flows detected
        </p>
        <p className="mt-1 text-[12px] text-[#94A3B8] max-w-md mx-auto">
          Execution chains are traced automatically from Express/NestJS routes, HTTP clients,
          WebSocket events, and background worker hooks.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-lg border border-[#202A3A] bg-[#101623] p-4 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[14px] font-semibold text-[#F1F5F9]">End-to-End Data Flow Tracer</h3>
          <p className="text-[12px] text-[#94A3B8]">
            Select a traced execution chain to highlight its complete path on the File canvas.
          </p>
        </div>

        <div className="inline-flex flex-wrap items-center gap-0.5 p-0.5 rounded-lg bg-[#080B12] border border-[#202A3A]">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`px-2.5 h-7 text-[11px] font-medium rounded-md transition-colors ${
              categoryFilter === 'all'
                ? 'bg-[#151D2B] text-[#F1F5F9] border border-[#60A5FA]/35'
                : 'text-[#94A3B8] hover:text-[#F1F5F9]'
            }`}
          >
            All ({flows.length})
          </button>
          {availableCategories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-2.5 h-7 text-[11px] font-medium rounded-md transition-colors ${
                categoryFilter === cat
                  ? 'bg-[#151D2B] text-[#F1F5F9] border border-[#60A5FA]/35'
                  : 'text-[#94A3B8] hover:text-[#F1F5F9]'
              }`}
            >
              {CATEGORY_LABELS[cat] || cat}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* Flow Selector List */}
        <div className="lg:col-span-4 max-h-60 overflow-y-auto space-y-1.5 pr-1">
          {filteredFlows.map((flow) => {
            const isSelected = activeFlow?.id === flow.id;
            return (
              <button
                key={flow.id}
                type="button"
                onClick={() => onSelectFlow(isSelected ? null : flow)}
                className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                  isSelected
                    ? 'border-[#22D3EE]/50 bg-[#151D2B] text-[#F1F5F9]'
                    : 'border-[#202A3A] bg-[#0D111B] text-[#94A3B8] hover:border-[#334155] hover:text-[#F1F5F9]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[12px] font-semibold truncate text-[#F1F5F9]">
                    {flow.title}
                  </span>
                  <span className="text-[10px] font-mono text-[#64748B] shrink-0 tabular-nums">
                    {flow.steps.length} steps
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] font-mono text-[#64748B] truncate">
                  {CATEGORY_LABELS[flow.category]} · {flow.entryPoint}
                </div>
              </button>
            );
          })}
        </div>

        {/* Visual Step Pipeline */}
        <div className="lg:col-span-8 rounded-lg border border-[#202A3A] bg-[#0D111B] p-4 flex flex-col justify-between">
          {activeFlow ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#202A3A] pb-2.5">
                <div className="min-w-0">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#22D3EE]">
                    {CATEGORY_LABELS[activeFlow.category]}
                  </span>
                  <h4 className="text-[13px] font-semibold text-[#F1F5F9] font-mono truncate">
                    {activeFlow.title}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectFlow(activeFlow)}
                  className="h-8 px-3 rounded-lg border border-[#22D3EE]/40 bg-[#22D3EE]/15 hover:bg-[#22D3EE]/20 text-[12px] font-medium text-[#22D3EE] transition-colors shrink-0"
                >
                  Highlight Path on Graph
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 py-1.5">
                {activeFlow.steps.map((step, idx) => {
                  const meta = NODE_KIND_META[step.kind] || NODE_KIND_META.file;
                  const Icon = meta.icon;
                  return (
                    <div key={`${step.nodeId}-${idx}`} className="flex items-center gap-2">
                      <div className="rounded-lg border border-[#202A3A] bg-[#101623] hover:bg-[#151D2B] px-3 py-2 min-w-[164px] max-w-[228px] transition-colors">
                        <div className={`inline-flex items-center gap-1 text-[10px] font-mono ${meta.accentText}`}>
                          <Icon className="w-3 h-3 shrink-0" />
                          <span>{meta.label}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onFocusNode(step.nodeId)}
                          className="mt-0.5 block w-full text-left text-[12px] font-semibold text-[#F1F5F9] hover:text-[#60A5FA] truncate transition-colors"
                        >
                          {step.name}
                        </button>
                        {step.filePath && (
                          <button
                            type="button"
                            onClick={() => onOpenFile(step.filePath!, step.line)}
                            className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-mono text-[#94A3B8] hover:text-[#60A5FA] truncate max-w-full transition-colors"
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
                        <div className="flex flex-col items-center px-0.5">
                          <span className="text-[9px] font-mono text-[#64748B]">
                            {step.relationToNext || 'NEXT'}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-[#22D3EE]" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-[12px] text-[#64748B] py-8 text-center">
              Select a flow from the left list to inspect each step.
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
