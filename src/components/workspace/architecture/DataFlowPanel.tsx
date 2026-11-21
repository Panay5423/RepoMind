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
      <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-2xs p-8 text-center">
        <div className="w-10 h-10 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-center mx-auto mb-3">
          <Workflow className="w-5 h-5 text-[#2563EB]" />
        </div>
        <p className="text-[14px] font-semibold text-[#0F172A]">
          No static request or event flows detected
        </p>
        <p className="mt-1 text-[12px] text-[#64748B] max-w-md mx-auto">
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
      className="rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-10px_rgba(37,99,235,0.06)] p-4 sm:p-5 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-[14px] font-semibold text-[#0F172A]">
            End-to-End Data Flow Tracer
          </h3>
          <p className="text-[12px] text-[#64748B]">
            Select a traced execution chain to highlight its complete path on the File canvas.
          </p>
        </div>

        <div className="inline-flex flex-wrap items-center gap-0.5 p-1 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`px-2.5 h-7 text-[11px] font-medium rounded-lg transition-colors whitespace-nowrap ${
              categoryFilter === 'all'
                ? 'bg-white text-[#2563EB] border border-[#BFDBFE] shadow-2xs font-semibold'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            All ({flows.length})
          </button>
          {availableCategories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-2.5 h-7 text-[11px] font-medium rounded-lg transition-colors whitespace-nowrap ${
                categoryFilter === cat
                  ? 'bg-white text-[#2563EB] border border-[#BFDBFE] shadow-2xs font-semibold'
                  : 'text-[#64748B] hover:text-[#0F172A]'
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
                className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors ${
                  isSelected
                    ? 'border-[#2563EB] bg-[#EFF6FF]/70 text-[#0F172A] shadow-2xs'
                    : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B] hover:border-[#93C5FD] hover:bg-white hover:text-[#0F172A]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[12px] font-semibold truncate text-[#0F172A]">
                    {flow.title}
                  </span>
                  <span className="text-[10px] font-mono text-[#2563EB] font-medium shrink-0 tabular-nums">
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
        <div className="lg:col-span-8 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 flex flex-col justify-between">
          {activeFlow ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] pb-2.5">
                <div className="min-w-0">
                  <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-[#0284C7]">
                    {CATEGORY_LABELS[activeFlow.category]}
                  </span>
                  <h4 className="text-[13px] font-semibold text-[#0F172A] font-mono truncate">
                    {activeFlow.title}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectFlow(activeFlow)}
                  className="h-8 px-3 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[12px] font-semibold text-[#1D4ED8] transition-colors shrink-0 whitespace-nowrap"
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
                      <div className="rounded-xl border border-[#E2E8F0] bg-white hover:border-[#93C5FD] shadow-2xs px-3 py-2 min-w-[164px] max-w-[228px] transition-colors">
                        <div className={`inline-flex items-center gap-1 text-[10px] font-mono font-medium ${meta.accentText}`}>
                          <Icon className="w-3 h-3 shrink-0" />
                          <span>{meta.label}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onFocusNode(step.nodeId)}
                          className="mt-0.5 block w-full text-left text-[12px] font-semibold text-[#0F172A] hover:text-[#2563EB] truncate transition-colors"
                        >
                          {step.name}
                        </button>
                        {step.filePath && (
                          <button
                            type="button"
                            onClick={() => onOpenFile(step.filePath!, step.line)}
                            className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-mono text-[#64748B] hover:text-[#2563EB] truncate max-w-full transition-colors"
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
                          <ArrowRight className="w-3.5 h-3.5 text-[#2563EB]" />
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
