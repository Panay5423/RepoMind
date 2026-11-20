import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Crosshair,
  ExternalLink,
  FileCode2,
  GitBranch,
  Layers,
  Search,
  Workflow,
  X,
} from 'lucide-react';
import type {
  ArchitectureIntelligenceDTO,
  GraphEdgeDTO,
  GraphNodeDTO,
  ImpactReportDTO,
} from '../../../../shared/types.ts';
import { useToast } from '../../../context/ToastContext.tsx';
import { NODE_KIND_META, RELATION_META } from './graphConstants.ts';

interface NodeInspectorSidebarProps {
  intelligence: ArchitectureIntelligenceDTO;
  selectedNode: GraphNodeDTO | null;
  selectedEdge: GraphEdgeDTO | null;
  activeEdges: GraphEdgeDTO[];
  nodeMap: Map<string, GraphNodeDTO>;
  impact: ImpactReportDTO | null;
  impactLoading: boolean;
  onSelectNode: (nodeId: string) => void;
  onClearEdge: () => void;
  onOpenFile: (path: string, startLine?: number, endLine?: number) => void;
  onFocusNode: (nodeId: string) => void;
  onFilterMode: (mode: 'all' | 'deps' | 'callers') => void;
  onTraceFlow: (node: GraphNodeDTO) => void;
  onFindReferences: (symbolName: string) => void;
  onDrillDown: (node: GraphNodeDTO) => void;
  onCloseMobile?: () => void;
}

type InspectorSectionKey =
  | 'overview'
  | 'dependencies'
  | 'relationships'
  | 'source'
  | 'references'
  | 'dataflow';

const KEYWORDS = new Set([
  'import',
  'export',
  'from',
  'const',
  'let',
  'var',
  'function',
  'async',
  'await',
  'return',
  'class',
  'extends',
  'implements',
  'interface',
  'type',
  'enum',
  'new',
  'if',
  'else',
  'for',
  'while',
  'switch',
  'case',
  'try',
  'catch',
  'throw',
  'default',
  'public',
  'private',
  'protected',
  'readonly',
  'def',
  'true',
  'false',
  'null',
  'undefined',
]);

function renderHighlightedLine(line: string) {
  const trimmed = line.trimStart();
  if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*')) {
    return <span className="text-[#64748B] italic">{line}</span>;
  }

  // Deterministic lightweight token split: strings, words, numbers, punctuation
  const tokens = line.split(/('[^']*'|"[^"]*"|`[^`]*`|\b[A-Za-z_][A-Za-z0-9_]*\b|\b\d+\b)/g);
  return tokens.map((tok, idx) => {
    if (!tok) return null;
    if (
      (tok.startsWith("'") && tok.endsWith("'")) ||
      (tok.startsWith('"') && tok.endsWith('"')) ||
      (tok.startsWith('`') && tok.endsWith('`'))
    ) {
      return (
        <span key={idx} className="text-[#34D399]">
          {tok}
        </span>
      );
    }
    if (KEYWORDS.has(tok)) {
      return (
        <span key={idx} className="text-[#A78BFA]">
          {tok}
        </span>
      );
    }
    if (/^\d+$/.test(tok)) {
      return (
        <span key={idx} className="text-[#FBBF24]">
          {tok}
        </span>
      );
    }
    if (/^[A-Z][A-Za-z0-9_]*$/.test(tok)) {
      return (
        <span key={idx} className="text-[#22D3EE]">
          {tok}
        </span>
      );
    }
    return (
      <span key={idx} className="text-[#E2E8F0]">
        {tok}
      </span>
    );
  });
}

function AccordionSection({
  title,
  count,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  count?: number;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-[#202A3A]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="w-full py-3 flex items-center justify-between text-left group transition-colors"
      >
        <div className="flex items-center gap-2">
          <ChevronDown
            className={`w-3.5 h-3.5 text-[#64748B] group-hover:text-[#F1F5F9] transition-transform duration-200 ${
              isOpen ? 'rotate-0' : '-rotate-90'
            }`}
          />
          <span className="text-xs font-semibold text-[#F1F5F9] group-hover:text-white tracking-[-0.01em]">
            {title}
          </span>
        </div>
        {typeof count === 'number' && (
          <span className="text-[11px] font-mono text-[#64748B] tabular-nums">{count}</span>
        )}
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="pb-4"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function NodeInspectorSidebar({
  intelligence,
  selectedNode,
  selectedEdge,
  activeEdges,
  nodeMap,
  impact,
  impactLoading,
  onSelectNode,
  onClearEdge,
  onOpenFile,
  onFocusNode,
  onFilterMode,
  onTraceFlow,
  onFindReferences,
  onDrillDown,
  onCloseMobile,
}: NodeInspectorSidebarProps) {
  const { notify } = useToast();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<InspectorSectionKey, boolean>>({
    overview: true,
    dependencies: true,
    relationships: true,
    source: true,
    references: false,
    dataflow: true,
  });

  const toggleSection = (key: InspectorSectionKey) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCopy = async (text: string, key: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    notify(`Copied ${label} to clipboard.`, 'success');
    setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 1600);
  };

  if (selectedEdge) {
    const src = nodeMap.get(selectedEdge.source);
    const tgt = nodeMap.get(selectedEdge.target);
    const relStyle = RELATION_META[selectedEdge.relation] || RELATION_META.IMPORTS;

    return (
      <aside className="rounded-xl border border-[#202A3A] bg-[#101623] p-5 flex flex-col justify-between h-full overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedEdge.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono text-[#60A5FA]">Relationship Edge</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClearEdge}
                  className="text-xs text-[#94A3B8] hover:text-[#F1F5F9] transition-colors"
                >
                  Back to Node
                </button>
                {onCloseMobile && (
                  <button
                    type="button"
                    onClick={onCloseMobile}
                    aria-label="Close inspector"
                    className="lg:hidden p-1 text-[#64748B] hover:text-[#F1F5F9]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-display text-lg font-semibold text-[#F1F5F9] tracking-[-0.015em]">
                {selectedEdge.relation}
              </h3>
              <p className="mt-1 text-[13px] text-[#94A3B8] leading-relaxed">{relStyle.description}</p>
            </div>

            <div className="space-y-2.5 border-t border-[#202A3A] pt-4 text-xs">
              <div>
                <p className="text-[#64748B] mb-1">Source Node</p>
                <button
                  type="button"
                  onClick={() => {
                    onClearEdge();
                    onSelectNode(selectedEdge.source);
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-lg border border-[#202A3A] bg-[#0D111B] hover:border-[#60A5FA]/50 hover:bg-[#151D2B] text-[#F1F5F9] transition-colors"
                >
                  <div className="font-medium truncate">{src?.name || selectedEdge.source}</div>
                  {src?.filePath && (
                    <div className="font-mono text-[11px] text-[#64748B] truncate mt-0.5">
                      {src.filePath}
                    </div>
                  )}
                </button>
              </div>

              <div className="flex justify-center py-0.5">
                <ArrowRight className="w-3.5 h-3.5 text-[#64748B] rotate-90" />
              </div>

              <div>
                <p className="text-[#64748B] mb-1">Target Node</p>
                <button
                  type="button"
                  onClick={() => {
                    onClearEdge();
                    onSelectNode(selectedEdge.target);
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-lg border border-[#202A3A] bg-[#0D111B] hover:border-[#60A5FA]/50 hover:bg-[#151D2B] text-[#F1F5F9] transition-colors"
                >
                  <div className="font-medium truncate">{tgt?.name || selectedEdge.target}</div>
                  {tgt?.filePath && (
                    <div className="font-mono text-[11px] text-[#64748B] truncate mt-0.5">
                      {tgt.filePath}
                    </div>
                  )}
                </button>
              </div>
            </div>

            <div className="border-t border-[#202A3A] pt-4 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#64748B]">Edge Label</span>
                <span className="font-mono text-[#F1F5F9]">{selectedEdge.label || selectedEdge.relation}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Occurrences</span>
                <span className="font-mono text-[#F1F5F9] tabular-nums">
                  {selectedEdge.weight || 1}
                </span>
              </div>
              {selectedEdge.filePath && (
                <button
                  type="button"
                  onClick={() => onOpenFile(selectedEdge.filePath!, selectedEdge.line)}
                  className="w-full mt-2 flex items-center justify-between px-3 py-2 rounded-lg border border-[#202A3A] bg-[#0D111B] hover:border-[#60A5FA]/50 text-[#60A5FA] font-mono transition-colors"
                >
                  <span className="truncate">
                    {selectedEdge.filePath}
                    {selectedEdge.line ? `:${selectedEdge.line}` : ''}
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                </button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </aside>
    );
  }

  if (!selectedNode) {
    return (
      <aside className="rounded-xl border border-[#202A3A] bg-[#101623] p-5 flex flex-col justify-between h-full">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-[#94A3B8]">
              <Layers className="w-4 h-4 text-[#60A5FA]" />
              <span>Inspector</span>
            </div>
            {onCloseMobile && (
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="Close inspector"
                className="lg:hidden p-1 text-[#64748B] hover:text-[#F1F5F9]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <h3 className="font-display text-sm font-semibold text-[#F1F5F9]">
            Select a node or edge
          </h3>
          <p className="text-[13px] text-[#94A3B8] leading-relaxed">
            Click any architecture node or connection edge to inspect dependencies, caller chains,
            syntax-highlighted source previews, references, and traced data flows.
          </p>
        </div>

        <div className="pt-4 border-t border-[#202A3A] text-xs text-[#64748B] space-y-1.5 font-mono">
          <p>Double-click a module or file to drill down</p>
          <p>Shift + drag to multi-select nodes</p>
          <p>⌘K to search symbols or file paths</p>
        </div>
      </aside>
    );
  }

  const meta = NODE_KIND_META[selectedNode.kind] || NODE_KIND_META.file;
  const Icon = meta.icon;
  const incoming = activeEdges.filter((e) => e.target === selectedNode.id);
  const outgoing = activeEdges.filter((e) => e.source === selectedNode.id);

  const relatedFunctions = selectedNode.filePath
    ? intelligence.symbols.functions.filter((f) => f.filePath === selectedNode.filePath).slice(0, 10)
    : [];
  const relatedClasses = selectedNode.filePath
    ? intelligence.symbols.classes.filter((c) => c.filePath === selectedNode.filePath).slice(0, 8)
    : [];
  const matchingFlows = intelligence.dataFlows.filter(
    (f) =>
      f.nodeIds.includes(selectedNode.id) ||
      (selectedNode.filePath && f.steps.some((s) => s.filePath === selectedNode.filePath))
  );

  const pathSegments = selectedNode.filePath
    ? selectedNode.filePath.split('/').filter(Boolean)
    : [];

  return (
    <aside className="rounded-xl border border-[#202A3A] bg-[#101623] p-5 h-full overflow-y-auto">
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedNode.id}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Node Header + Breadcrumb */}
          <div className="pb-4">
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-medium">
                <Icon className={`w-3.5 h-3.5 ${meta.accentText}`} />
                <span className={meta.accentText}>{meta.label}</span>
                <span className="text-[#64748B]">·</span>
                <span className="text-[#94A3B8] font-mono">{selectedNode.layer}</span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void handleCopy(selectedNode.name, 'name', 'symbol name')}
                  title="Copy node name"
                  className="p-1.5 rounded-md text-[#64748B] hover:text-[#F1F5F9] hover:bg-[#151D2B] transition-colors"
                >
                  {copiedKey === 'name' ? (
                    <Check className="w-3.5 h-3.5 text-[#34D399]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                {onCloseMobile && (
                  <button
                    type="button"
                    onClick={onCloseMobile}
                    aria-label="Close inspector"
                    className="lg:hidden p-1.5 rounded-md text-[#64748B] hover:text-[#F1F5F9]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <h3 className="mt-1.5 font-display text-[16px] font-semibold text-[#F1F5F9] tracking-[-0.015em] break-words">
              {selectedNode.name}
            </h3>

            {/* File path breadcrumbs */}
            {selectedNode.filePath && (
              <div className="mt-2.5 flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border border-[#202A3A] bg-[#0D111B]">
                <button
                  type="button"
                  onClick={() =>
                    onOpenFile(selectedNode.filePath!, selectedNode.line, selectedNode.endLine)
                  }
                  className="flex items-center flex-wrap gap-1 min-w-0 text-left text-[11px] font-mono text-[#94A3B8] hover:text-[#60A5FA] transition-colors"
                  title="Open source file at exact line"
                >
                  <FileCode2 className="w-3.5 h-3.5 text-[#60A5FA] shrink-0 mr-0.5" />
                  {pathSegments.map((seg, i) => (
                    <span key={`${seg}-${i}`} className="inline-flex items-center gap-1 min-w-0">
                      <span
                        className={`truncate ${
                          i === pathSegments.length - 1 ? 'text-[#F1F5F9]' : 'text-[#64748B]'
                        }`}
                      >
                        {seg}
                      </span>
                      {i < pathSegments.length - 1 && (
                        <ChevronRight className="w-2.5 h-2.5 text-[#475569] shrink-0" />
                      )}
                    </span>
                  ))}
                  {selectedNode.line && (
                    <span className="text-[#60A5FA] shrink-0">:{selectedNode.line}</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void handleCopy(
                      `${selectedNode.filePath}${selectedNode.line ? `:${selectedNode.line}` : ''}`,
                      'path',
                      'file path'
                    )
                  }
                  title="Copy file path"
                  className="p-1 rounded text-[#64748B] hover:text-[#F1F5F9] transition-colors shrink-0"
                >
                  {copiedKey === 'path' ? (
                    <Check className="w-3 h-3 text-[#34D399]" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
            )}
          </div>

          {/* 1. OVERVIEW */}
          <AccordionSection
            title="Overview"
            isOpen={openSections.overview}
            onToggle={() => toggleSection('overview')}
          >
            <p className="text-[13px] text-[#94A3B8] leading-relaxed">{selectedNode.description}</p>

            {/* Tabular metrics */}
            <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg border border-[#202A3A] bg-[#0D111B] p-2.5 text-xs font-mono tabular-nums">
              <div>
                <div className="text-[10.5px] text-[#64748B]">Incoming</div>
                <div className="mt-0.5 text-sm font-semibold text-[#F1F5F9]">
                  {selectedNode.incomingCount}
                </div>
              </div>
              <div>
                <div className="text-[10.5px] text-[#64748B]">Outgoing</div>
                <div className="mt-0.5 text-sm font-semibold text-[#F1F5F9]">
                  {selectedNode.outgoingCount}
                </div>
              </div>
              <div>
                <div className="text-[10.5px] text-[#64748B]">Usage</div>
                <div className="mt-0.5 text-sm font-semibold text-[#F1F5F9]">
                  {selectedNode.usageCount}
                </div>
              </div>
            </div>

            {/* AST Signature if present */}
            {(selectedNode.metadata?.parameters?.length ||
              selectedNode.metadata?.returnType ||
              selectedNode.metadata?.extendsClass) && (
              <div className="mt-3 space-y-1 text-[11.5px] font-mono rounded-lg border border-[#202A3A] bg-[#080B12] p-2.5">
                {selectedNode.metadata.parameters && selectedNode.metadata.parameters.length > 0 && (
                  <div className="text-[#94A3B8] break-words">
                    params:{' '}
                    <span className="text-[#F1F5F9]">
                      (
                      {selectedNode.metadata.parameters
                        .map((p) => `${p.name}${p.type ? `: ${p.type}` : ''}`)
                        .join(', ')}
                      )
                    </span>
                  </div>
                )}
                {selectedNode.metadata.returnType && (
                  <div className="text-[#94A3B8]">
                    returns: <span className="text-[#60A5FA]">{selectedNode.metadata.returnType}</span>
                  </div>
                )}
                {selectedNode.metadata.extendsClass && (
                  <div className="text-[#94A3B8]">
                    extends:{' '}
                    <span className="text-[#FBBF24]">{selectedNode.metadata.extendsClass}</span>
                  </div>
                )}
              </div>
            )}

            {/* Quick Action Grid */}
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => onFocusNode(selectedNode.id)}
                className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-[#202A3A] bg-[#0D111B] hover:border-[#60A5FA]/50 hover:bg-[#151D2B] text-xs text-[#F1F5F9] transition-colors"
              >
                <Crosshair className="w-3.5 h-3.5 text-[#60A5FA] shrink-0" />
                <span className="truncate">Focus Node</span>
              </button>
              <button
                type="button"
                onClick={() => onFilterMode('deps')}
                className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-[#202A3A] bg-[#0D111B] hover:border-[#A78BFA]/50 hover:bg-[#151D2B] text-xs text-[#F1F5F9] transition-colors"
              >
                <ArrowRight className="w-3.5 h-3.5 text-[#A78BFA] shrink-0" />
                <span className="truncate">Dependencies</span>
              </button>
              <button
                type="button"
                onClick={() => onFilterMode('callers')}
                className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-[#202A3A] bg-[#0D111B] hover:border-[#34D399]/50 hover:bg-[#151D2B] text-xs text-[#F1F5F9] transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-[#34D399] shrink-0" />
                <span className="truncate">Callers</span>
              </button>
              <button
                type="button"
                onClick={() => onTraceFlow(selectedNode)}
                className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-[#202A3A] bg-[#0D111B] hover:border-[#22D3EE]/50 hover:bg-[#151D2B] text-xs text-[#F1F5F9] transition-colors"
              >
                <Workflow className="w-3.5 h-3.5 text-[#22D3EE] shrink-0" />
                <span className="truncate">Trace Flow</span>
              </button>
              {selectedNode.filePath && (
                <button
                  type="button"
                  onClick={() =>
                    onOpenFile(selectedNode.filePath!, selectedNode.line, selectedNode.endLine)
                  }
                  className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-[#202A3A] bg-[#0D111B] hover:border-[#FBBF24]/50 hover:bg-[#151D2B] text-xs text-[#F1F5F9] transition-colors"
                >
                  <FileCode2 className="w-3.5 h-3.5 text-[#FBBF24] shrink-0" />
                  <span className="truncate">View Source</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onFindReferences(selectedNode.name)}
                className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-[#202A3A] bg-[#0D111B] hover:border-[#60A5FA]/50 hover:bg-[#151D2B] text-xs text-[#F1F5F9] transition-colors"
              >
                <Search className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                <span className="truncate">Find Refs</span>
              </button>
              {selectedNode.drillDownLevel && (
                <button
                  type="button"
                  onClick={() => onDrillDown(selectedNode)}
                  className="col-span-2 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#60A5FA]/12 border border-[#60A5FA]/35 hover:bg-[#60A5FA]/20 text-xs font-medium text-[#60A5FA] transition-colors"
                >
                  <ArrowDownRight className="w-3.5 h-3.5" />
                  <span>Drill Down to {selectedNode.drillDownLevel} level</span>
                </button>
              )}
            </div>
          </AccordionSection>

          {/* 2. DEPENDENCIES & IMPACT */}
          <AccordionSection
            title="Dependencies & Impact"
            count={impact ? impact.transitiveDependencies.length + impact.transitiveDependents.length : undefined}
            isOpen={openSections.dependencies}
            onToggle={() => toggleSection('dependencies')}
          >
            {impactLoading ? (
              <div className="space-y-2">
                <div className="h-4 w-2/3 rounded bg-[#151D2B] animate-pulse" />
                <div className="h-12 rounded-lg bg-[#151D2B] animate-pulse" />
              </div>
            ) : impact ? (
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-[#94A3B8]">
                    <Activity className="w-3.5 h-3.5 text-[#FBBF24]" />
                    <span>Blast radius</span>
                  </span>
                  <span
                    className={`font-mono text-[11px] uppercase font-medium ${
                      impact.riskLevel === 'high'
                        ? 'text-[#FB7185]'
                        : impact.riskLevel === 'medium'
                          ? 'text-[#FBBF24]'
                          : 'text-[#34D399]'
                    }`}
                  >
                    {impact.riskLevel} risk
                  </span>
                </div>

                <div className="text-[#94A3B8] font-mono text-[11px] tabular-nums">
                  Dependents: <span className="text-[#F1F5F9]">{impact.transitiveDependents.length}</span>
                  <span className="mx-1.5 text-[#64748B]">·</span>
                  Files: <span className="text-[#F1F5F9]">{impact.affectedFiles.length}</span>
                  <span className="mx-1.5 text-[#64748B]">·</span>
                  Deps: <span className="text-[#F1F5F9]">{impact.transitiveDependencies.length}</span>
                </div>

                {impact.affectedApisAndComponents.length > 0 && (
                  <div className="rounded-lg border border-[#202A3A] bg-[#0D111B] p-2.5 space-y-1">
                    <div className="text-[11px] text-[#64748B]">Affected entry points</div>
                    <div className="flex flex-wrap gap-x-2 gap-y-1 font-mono text-[11px]">
                      {impact.affectedApisAndComponents.slice(0, 6).map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => onSelectNode(a.id)}
                          className="text-[#60A5FA] hover:underline truncate max-w-full"
                        >
                          {a.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-[#64748B]">No transitive dependency report available.</p>
            )}
          </AccordionSection>

          {/* 3. RELATIONSHIPS */}
          <AccordionSection
            title="Relationships"
            count={outgoing.length + incoming.length}
            isOpen={openSections.relationships}
            onToggle={() => toggleSection('relationships')}
          >
            {outgoing.length === 0 && incoming.length === 0 ? (
              <p className="text-xs text-[#64748B]">No direct connections in current level view.</p>
            ) : (
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5 text-xs">
                {outgoing.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => onSelectNode(e.target)}
                    className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border border-[#202A3A] bg-[#0D111B] hover:border-[#60A5FA]/45 hover:bg-[#151D2B] text-left transition-colors"
                  >
                    <span className="flex items-center gap-1.5 text-[#F1F5F9] truncate">
                      <ArrowRight className="w-3 h-3 text-[#A78BFA] shrink-0" />
                      <span className="truncate">{nodeMap.get(e.target)?.name || e.target}</span>
                    </span>
                    <span className="font-mono text-[10px] text-[#64748B] shrink-0">
                      {e.relation}
                    </span>
                  </button>
                ))}
                {incoming.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => onSelectNode(e.source)}
                    className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border border-[#202A3A] bg-[#0D111B] hover:border-[#60A5FA]/45 hover:bg-[#151D2B] text-left transition-colors"
                  >
                    <span className="flex items-center gap-1.5 text-[#CBD5E1] truncate">
                      <ArrowLeft className="w-3 h-3 text-[#60A5FA] shrink-0" />
                      <span className="truncate">{nodeMap.get(e.source)?.name || e.source}</span>
                    </span>
                    <span className="font-mono text-[10px] text-[#64748B] shrink-0">
                      {e.relation}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </AccordionSection>

          {/* 4. SOURCE CODE (Syntax-Highlighted Preview) */}
          {selectedNode.codePreview && (
            <AccordionSection
              title="Source Code"
              isOpen={openSections.source}
              onToggle={() => toggleSection('source')}
            >
              <div className="rounded-lg border border-[#202A3A] bg-[#080B12] overflow-hidden">
                <div className="px-3 py-1.5 border-b border-[#202A3A] bg-[#0D111B] flex items-center justify-between text-[11px] font-mono text-[#64748B]">
                  <span className="truncate">
                    {selectedNode.filePath || 'snippet'}
                    {selectedNode.line ? `:${selectedNode.line}` : ''}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        void handleCopy(selectedNode.codePreview!, 'snippet', 'source preview')
                      }
                      className="text-[#94A3B8] hover:text-[#F1F5F9] transition-colors inline-flex items-center gap-1"
                    >
                      {copiedKey === 'snippet' ? (
                        <Check className="w-3 h-3 text-[#34D399]" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>Copy</span>
                    </button>
                    {selectedNode.filePath && (
                      <button
                        type="button"
                        onClick={() =>
                          onOpenFile(selectedNode.filePath!, selectedNode.line, selectedNode.endLine)
                        }
                        className="text-[#60A5FA] hover:underline"
                      >
                        Open
                      </button>
                    )}
                  </div>
                </div>
                <div className="p-3 overflow-x-auto text-[11.5px] font-mono leading-[1.6]">
                  {selectedNode.codePreview.split('\n').map((lineText, idx) => (
                    <div key={idx} className="flex gap-3">
                      <span className="w-6 text-right select-none text-[#475569] tabular-nums shrink-0">
                        {(selectedNode.line || 1) + idx}
                      </span>
                      <span className="whitespace-pre">{renderHighlightedLine(lineText)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </AccordionSection>
          )}

          {/* 5. REFERENCES & SYMBOLS IN FILE */}
          <AccordionSection
            title="References"
            count={relatedClasses.length + relatedFunctions.length}
            isOpen={openSections.references}
            onToggle={() => toggleSection('references')}
          >
            {relatedClasses.length === 0 && relatedFunctions.length === 0 ? (
              <p className="text-xs text-[#64748B]">No AST symbol definitions attached to this node.</p>
            ) : (
              <div className="space-y-1 text-xs font-mono">
                {relatedClasses.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onOpenFile(c.filePath, c.line, c.endLine)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md bg-[#0D111B] border border-[#202A3A] hover:border-[#FBBF24]/45 text-[#F1F5F9] hover:text-[#FBBF24] text-left transition-colors"
                  >
                    <span className="inline-flex items-center gap-1.5 truncate">
                      <GitBranch className="w-3 h-3 text-[#FBBF24] shrink-0" />
                      <span className="truncate">class {c.name}</span>
                    </span>
                    <span className="text-[10px] text-[#64748B] tabular-nums">L{c.line}</span>
                  </button>
                ))}
                {relatedFunctions.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onOpenFile(f.filePath, f.line, f.endLine)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md bg-[#0D111B] border border-[#202A3A] hover:border-[#60A5FA]/45 text-[#CBD5E1] hover:text-[#60A5FA] text-left transition-colors"
                  >
                    <span className="truncate">{f.name}()</span>
                    <span className="text-[10px] text-[#64748B] tabular-nums">L{f.line}</span>
                  </button>
                ))}
              </div>
            )}
          </AccordionSection>

          {/* 6. DATA FLOW */}
          <AccordionSection
            title="Data Flow"
            count={matchingFlows.length}
            isOpen={openSections.dataflow}
            onToggle={() => toggleSection('dataflow')}
          >
            {matchingFlows.length === 0 ? (
              <p className="text-xs text-[#64748B]">
                No end-to-end request or event flows pass through this node.
              </p>
            ) : (
              <div className="space-y-1.5">
                {matchingFlows.slice(0, 5).map((flow) => (
                  <button
                    key={flow.id}
                    type="button"
                    onClick={() => onTraceFlow(selectedNode)}
                    className="w-full text-left px-3 py-2 rounded-lg border border-[#202A3A] bg-[#0D111B] hover:border-[#22D3EE]/50 hover:bg-[#151D2B] transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-mono font-medium text-[#F1F5F9] truncate">
                        {flow.title}
                      </span>
                      <span className="font-mono text-[10px] text-[#22D3EE] shrink-0 tabular-nums">
                        {flow.steps.length} steps
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] font-mono text-[#64748B] truncate">
                      {flow.entryPoint}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </AccordionSection>
        </motion.div>
      </AnimatePresence>
    </aside>
  );
}
