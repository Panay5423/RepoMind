import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Activity,
  Braces,
  ChevronRight,
  Download,
  EyeOff,
  Filter,
  Layers,
  Maximize2,
  Minimize2,
  RefreshCw,
  RotateCcw,
  Scan,
  Share2,
  Workflow,
} from 'lucide-react';
import type {
  ArchitectureIntelligenceDTO,
  ChatMode,
  DataFlowChain,
  GraphEdgeDTO,
  GraphEdgeRelation,
  GraphLevel,
  GraphNodeDTO,
  GraphNodeKind,
  ImpactReportDTO,
  LevelGraphDTO,
} from '../../../shared/types.ts';
import { api } from '../../lib/api.ts';
import { useToast } from '../../context/ToastContext.tsx';
import {
  ArchSymbolNode,
  GroupContainerNode,
  type ArchNodeRenderData,
} from './architecture/CustomArchNodes.tsx';
import {
  buildDependencyReportMarkdown,
  computeNodePositions,
  NODE_KIND_META,
  RELATION_META,
  type LayoutMode,
} from './architecture/graphConstants.ts';
import {
  exportArchitectureGraph,
  type ArchitectureExportFormat,
} from './architecture/graphExport.ts';
import { NodeInspectorSidebar } from './architecture/NodeInspectorSidebar.tsx';
import { SymbolExplorerPanel } from './architecture/SymbolExplorerPanel.tsx';
import { DataFlowPanel } from './architecture/DataFlowPanel.tsx';
import { AnalysisInsightsPanel } from './architecture/AnalysisInsightsPanel.tsx';
import { GlobalSearch, type GlobalSearchResult } from './architecture/GlobalSearch.tsx';
import { ErrorBoundary } from '../ErrorBoundary.tsx';

interface ArchitectureTabProps {
  repositoryId: string;
  repositoryName: string;
  onOpenFile: (path: string, startLine?: number, endLine?: number) => void;
  onAskAI?: (prompt: string, mode?: ChatMode) => void;
}

type ViewMode = 'graph' | 'flow' | 'symbols' | 'analysis';

const nodeTypes = {
  archNode: ArchSymbolNode,
  groupNode: GroupContainerNode,
};

const LEVEL_LABELS: Array<{ id: GraphLevel; label: string; short: string }> = [
  { id: 'system', label: 'L1 System', short: 'System' },
  { id: 'module', label: 'L2 Module', short: 'Module' },
  { id: 'file', label: 'L3 File', short: 'File' },
  { id: 'code', label: 'L4 Code', short: 'Code' },
];

const LAYOUT_OPTIONS: Array<{ id: LayoutMode; label: string }> = [
  { id: 'hierarchical', label: 'Hierarchical' },
  { id: 'layered', label: 'Layered' },
  { id: 'force', label: 'Force-Directed' },
  { id: 'circular', label: 'Circular' },
  { id: 'grouped', label: 'Grouped by Module' },
];

function ArchitectureCanvasWorkspace({
  repositoryId,
  repositoryName,
  onOpenFile,
}: ArchitectureTabProps) {
  const { notify } = useToast();
  const { fitView, setCenter, getNode } = useReactFlow();
  const [searchParams, setSearchParams] = useSearchParams();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const flowWrapperRef = useRef<HTMLDivElement | null>(null);
  const initialLevel = (searchParams.get('level') as GraphLevel) || 'module';
  const initialView = (searchParams.get('view') as ViewMode) || 'graph';
  const initialLayout = (searchParams.get('layout') as LayoutMode) || 'hierarchical';
  const initialNode = searchParams.get('node');
  const pendingCenterNodeIdRef = useRef<string | null>(initialNode);

  const [intelligence, setIntelligence] = useState<ArchitectureIntelligenceDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [level, setLevel] = useState<GraphLevel>(
    ['system', 'module', 'file', 'code'].includes(initialLevel) ? initialLevel : 'module'
  );
  const [viewMode, setViewMode] = useState<ViewMode>(
    ['graph', 'flow', 'symbols', 'analysis'].includes(initialView) ? initialView : 'graph'
  );
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(
    ['hierarchical', 'layered', 'force', 'circular', 'grouped'].includes(initialLayout)
      ? initialLayout
      : 'hierarchical'
  );

  const [scopedCodeGraph, setScopedCodeGraph] = useState<LevelGraphDTO | null>(null);
  const [codeScopeLabel, setCodeScopeLabel] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ level: GraphLevel; label: string }>>([
    { level: 'system', label: 'System' },
  ]);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialNode);
  const [multiSelectedIds, setMultiSelectedIds] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [relationFilterMode, setRelationFilterMode] = useState<'all' | 'deps' | 'callers'>('all');
  const [hideUnrelated, setHideUnrelated] = useState(false);

  const [activeFlow, setActiveFlow] = useState<DataFlowChain | null>(null);
  const [impact, setImpact] = useState<ImpactReportDTO | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);

  // Filters & Export
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<ArchitectureExportFormat | null>(null);
  const [kindFilter, setKindFilter] = useState<'all' | GraphNodeKind>('all');
  const [languageFilter, setLanguageFilter] = useState<string>('all');
  const [folderFilter, setFolderFilter] = useState<string>('all');
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [edgeRelationFilter, setEdgeRelationFilter] = useState<'all' | GraphEdgeRelation>('all');
  const [scopeSideFilter, setScopeSideFilter] = useState<'all' | 'frontend' | 'backend'>('all');
  const [depOriginFilter, setDepOriginFilter] = useState<'all' | 'internal' | 'external'>('all');

  // Search & Explorer link
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHighlightIds, setSearchHighlightIds] = useState<Set<string>>(new Set());
  const [symbolInitialSearch, setSymbolInitialSearch] = useState('');

  // Collapsed module groups in Grouped layout
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [manualOffsets, setManualOffsets] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [layoutNonce, setLayoutNonce] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const loadIntelligence = useCallback(
    async (refresh = false) => {
      setLoading(true);
      setError('');
      try {
        const res = await api.architecture.get(repositoryId, refresh);
        setIntelligence(res.intelligence);
        setScopedCodeGraph(null);
        setCodeScopeLabel(null);
        setSelectedNodeId((prev) => {
          if (prev) return prev;
          const activeLvl = res.intelligence.levels[level];
          return activeLvl.nodes[0]?.id || null;
        });
        if (refresh) {
          notify('Rebuilt AST architecture graph from repository files.', 'success');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to analyze repository architecture.');
      } finally {
        setLoading(false);
      }
    },
    [repositoryId, level, notify]
  );

  useEffect(() => {
    void loadIntelligence(false);
  }, [repositoryId]);

  const handleHighlightIdsChange = useCallback((nextSet: Set<string>) => {
    setSearchHighlightIds((prev) => {
      if (prev.size === nextSet.size) {
        let same = true;
        for (const item of nextSet) {
          if (!prev.has(item)) {
            same = false;
            break;
          }
        }
        if (same) return prev;
      }
      return nextSet;
    });
  }, []);

  // Sync URL query parameters for shareable graph state
  useEffect(() => {
    if (searchParams.get('tab') !== 'architecture') return;
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'architecture');
    next.set('level', level);
    next.set('view', viewMode);
    next.set('layout', layoutMode);
    if (selectedNodeId) next.set('node', selectedNodeId);
    else next.delete('node');
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [level, viewMode, layoutMode, selectedNodeId, searchParams, setSearchParams]);

  // Fetch impact report on node selection
  useEffect(() => {
    if (!selectedNodeId || !intelligence) {
      setImpact(null);
      return;
    }
    let active = true;
    setImpactLoading(true);
    api.architecture
      .impact(repositoryId, selectedNodeId)
      .then((res) => {
        if (active) setImpact(res.impact);
      })
      .catch(() => {
        if (active) setImpact(null);
      })
      .finally(() => {
        if (active) setImpactLoading(false);
      });
    return () => {
      active = false;
    };
  }, [repositoryId, selectedNodeId, intelligence]);

  // Fullscreen listener
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const currentLevelData: LevelGraphDTO = useMemo(() => {
    if (!intelligence) return { level, nodes: [], edges: [] };
    if (level === 'code' && scopedCodeGraph) return scopedCodeGraph;
    return intelligence.levels[level];
  }, [intelligence, level, scopedCodeGraph]);

  // Filter dropdown options derived from actual graph data
  const filterOptions = useMemo(() => {
    const kinds = new Set<GraphNodeKind>();
    const langs = new Set<string>();
    const folders = new Set<string>();
    const modules = new Set<string>();
    const relations = new Set<GraphEdgeRelation>();

    for (const n of currentLevelData.nodes) {
      kinds.add(n.kind);
      if (n.language) langs.add(n.language);
      if (n.folder && n.folder !== '.') folders.add(n.folder);
      if (n.moduleGroup) modules.add(n.moduleGroup);
    }
    for (const e of currentLevelData.edges) {
      relations.add(e.relation);
    }

    return {
      kinds: Array.from(kinds),
      languages: Array.from(langs).sort(),
      folders: Array.from(folders).sort(),
      modules: Array.from(modules).sort(),
      relations: Array.from(relations),
    };
  }, [currentLevelData]);

  // Apply active filters + focus/unrelated isolation
  const { visibleGraphNodes, visibleGraphEdges, connectedNodeIds, flowNodeSet, flowEdgeSet } =
    useMemo(() => {
      const baseNodes = currentLevelData.nodes.filter((n) => {
        if (kindFilter !== 'all' && n.kind !== kindFilter) return false;
        if (languageFilter !== 'all' && n.language !== languageFilter) return false;
        if (folderFilter !== 'all' && n.folder !== folderFilter) return false;
        if (moduleFilter !== 'all' && n.moduleGroup !== moduleFilter) return false;
        if (scopeSideFilter === 'frontend' && n.layer !== 'frontend') return false;
        if (scopeSideFilter === 'backend' && n.layer === 'frontend') return false;
        if (depOriginFilter === 'internal' && n.isExternal) return false;
        if (depOriginFilter === 'external' && !n.isExternal) return false;
        return true;
      });

      const baseNodeIds = new Set(baseNodes.map((n) => n.id));
      let baseEdges = currentLevelData.edges.filter((e) => {
        if (!baseNodeIds.has(e.source) || !baseNodeIds.has(e.target)) return false;
        if (edgeRelationFilter !== 'all' && e.relation !== edgeRelationFilter) return false;
        return true;
      });

      const anchorId = focusedNodeId || selectedNodeId;
      const connIds = new Set<string>();
      if (anchorId && baseNodeIds.has(anchorId)) {
        connIds.add(anchorId);
        for (const e of baseEdges) {
          if (relationFilterMode === 'deps') {
            if (e.source === anchorId) connIds.add(e.target);
          } else if (relationFilterMode === 'callers') {
            if (e.target === anchorId) connIds.add(e.source);
          } else {
            if (e.source === anchorId) connIds.add(e.target);
            if (e.target === anchorId) connIds.add(e.source);
          }
        }
      }

      if (relationFilterMode !== 'all' && anchorId) {
        baseEdges = baseEdges.filter((e) =>
          relationFilterMode === 'deps' ? e.source === anchorId : e.target === anchorId
        );
      }

      const fNodeSet = new Set<string>(activeFlow?.nodeIds || []);
      const fEdgeSet = new Set<string>(activeFlow?.edgeIds || []);

      let finalNodes = baseNodes;
      if (hideUnrelated && anchorId && connIds.size > 0) {
        finalNodes = baseNodes.filter((n) => connIds.has(n.id));
        const finalIds = new Set(finalNodes.map((n) => n.id));
        baseEdges = baseEdges.filter((e) => finalIds.has(e.source) && finalIds.has(e.target));
      }

      return {
        visibleGraphNodes: finalNodes,
        visibleGraphEdges: baseEdges,
        connectedNodeIds: connIds,
        flowNodeSet: fNodeSet,
        flowEdgeSet: fEdgeSet,
      };
    }, [
      currentLevelData,
      kindFilter,
      languageFilter,
      folderFilter,
      moduleFilter,
      scopeSideFilter,
      depOriginFilter,
      edgeRelationFilter,
      focusedNodeId,
      selectedNodeId,
      relationFilterMode,
      hideUnrelated,
      activeFlow,
    ]);

  const handleToggleGroup = useCallback((groupKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }, []);

  const handleDrillDown = useCallback(
    async (node: GraphNodeDTO) => {
      if (!node.drillDownLevel) return;
      const targetLevel = node.drillDownLevel;
      setLevel(targetLevel);
      setViewMode('graph');
      setSelectedEdgeId(null);
      setFocusedNodeId(null);
      setHideUnrelated(false);
      setManualOffsets(new Map());

      setBreadcrumbs((prev) => {
        const idx = prev.findIndex((b) => b.level === targetLevel);
        const base = idx >= 0 ? prev.slice(0, idx) : prev;
        return [...base, { level: targetLevel, label: node.name }];
      });

      if (targetLevel === 'code' && (node.filePath || node.moduleGroup)) {
        try {
          const res = await api.architecture.codeSlice(repositoryId, {
            filePath: node.level === 'file' ? node.filePath : undefined,
            moduleGroup: node.level === 'module' ? node.moduleGroup : undefined,
            limit: 160,
          });
          setScopedCodeGraph(res.graph);
          setCodeScopeLabel(node.filePath || node.name);
          if (res.graph.nodes[0]) {
            setSelectedNodeId(res.graph.nodes[0].id);
          }
        } catch {
          // fallback to default code graph
        }
      } else if (intelligence) {
        const child = intelligence.levels[targetLevel].nodes.find(
          (n) =>
            n.parentId === node.id ||
            (node.filePath && n.filePath === node.filePath) ||
            (node.moduleGroup && n.moduleGroup === node.moduleGroup)
        );
        if (child) setSelectedNodeId(child.id);
      }

      setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 80);
    },
    [repositoryId, intelligence, fitView]
  );

  // Build positioned React Flow nodes & edges
  const basePositions = useMemo(
    () => computeNodePositions(visibleGraphNodes, visibleGraphEdges, layoutMode),
    [visibleGraphNodes, visibleGraphEdges, layoutMode, layoutNonce]
  );

  const computedFlow = useMemo(() => {
    const flowNodes: Node[] = [];
    const anchorId = focusedNodeId || selectedNodeId;
    const activeFlowActive = Boolean(activeFlow && flowNodeSet.size > 0);

    if (layoutMode === 'grouped') {
      const groups = new Map<string, GraphNodeDTO[]>();
      for (const n of visibleGraphNodes) {
        const g = n.moduleGroup || n.folder || n.layer || 'core';
        const list = groups.get(g) || [];
        list.push(n);
        groups.set(g, list);
      }

      let collapsedY = 40;
      for (const [groupKey, items] of groups.entries()) {
        const isCollapsed = collapsedGroups.has(groupKey);
        if (isCollapsed) {
          flowNodes.push({
            id: `group:${groupKey}`,
            type: 'groupNode',
            position: { x: 40, y: collapsedY },
            style: { width: 280, height: 48 },
            data: {
              label: groupKey,
              count: items.length,
              collapsed: true,
              groupKey,
              onToggle: handleToggleGroup,
            },
          });
          collapsedY += 68;
          continue;
        }

        const itemPositions = items.map((i) => basePositions.get(i.id) || { x: 40, y: 40 });
        const minX = Math.min(...itemPositions.map((p) => p.x)) - 20;
        const minY = Math.min(...itemPositions.map((p) => p.y)) - 42;
        const maxX = Math.max(...itemPositions.map((p) => p.x)) + 268;
        const maxY = Math.max(...itemPositions.map((p) => p.y)) + 115;

        flowNodes.push({
          id: `group:${groupKey}`,
          type: 'groupNode',
          position: { x: minX, y: minY },
          style: { width: maxX - minX, height: maxY - minY, zIndex: -1 },
          selectable: false,
          draggable: false,
          data: {
            label: groupKey,
            count: items.length,
            collapsed: false,
            groupKey,
            onToggle: handleToggleGroup,
          },
        });

        for (const item of items) {
          const p = manualOffsets.get(item.id) || basePositions.get(item.id) || { x: 40, y: 40 };
          const isConn = connectedNodeIds.has(item.id);
          const isFlowNode = flowNodeSet.has(item.id);
          const isSearchMatch = searchHighlightIds.has(item.id);
          const searchFilteringCanvas = searchQuery.trim().length > 0 && searchHighlightIds.size > 0;
          const dimmed =
            (activeFlowActive && !isFlowNode) ||
            (searchFilteringCanvas && !isSearchMatch && item.id !== selectedNodeId) ||
            (!activeFlowActive && !searchFilteringCanvas && Boolean(anchorId) && !isConn);

          flowNodes.push({
            id: item.id,
            type: 'archNode',
            position: p,
            selected: item.id === selectedNodeId,
            data: {
              ...item,
              isFocused: item.id === focusedNodeId,
              isConnectedToSelection: isConn && item.id !== selectedNodeId,
              isDimmed: dimmed,
              isFlowHighlighted: isFlowNode,
              isSearchMatch,
              onDrillDown: handleDrillDown,
            } satisfies ArchNodeRenderData,
          });
        }
      }
    } else {
      for (const item of visibleGraphNodes) {
        const p = manualOffsets.get(item.id) || basePositions.get(item.id) || { x: 40, y: 40 };
        const isConn = connectedNodeIds.has(item.id);
        const isFlowNode = flowNodeSet.has(item.id);
        const isSearchMatch = searchHighlightIds.has(item.id);
        const searchFilteringCanvas = searchQuery.trim().length > 0 && searchHighlightIds.size > 0;
        const dimmed =
          (activeFlowActive && !isFlowNode) ||
          (searchFilteringCanvas && !isSearchMatch && item.id !== selectedNodeId) ||
          (!activeFlowActive && !searchFilteringCanvas && Boolean(anchorId) && !isConn);

        flowNodes.push({
          id: item.id,
          type: 'archNode',
          position: p,
          selected: item.id === selectedNodeId,
          data: {
            ...item,
            isFocused: item.id === focusedNodeId,
            isConnectedToSelection: isConn && item.id !== selectedNodeId,
            isDimmed: dimmed,
            isFlowHighlighted: isFlowNode,
            isSearchMatch,
            onDrillDown: handleDrillDown,
          } satisfies ArchNodeRenderData,
        });
      }
    }

    const visibleFlowIds = new Set(flowNodes.map((n) => n.id));
    const flowEdges: Edge[] = visibleGraphEdges
      .filter((e) => visibleFlowIds.has(e.source) && visibleFlowIds.has(e.target))
      .map((e) => {
        const relStyle = RELATION_META[e.relation] || RELATION_META.IMPORTS;
        const isDirectlyConnected = anchorId === e.source || anchorId === e.target;
        const isFlowEdge =
          flowEdgeSet.has(e.id) || (flowNodeSet.has(e.source) && flowNodeSet.has(e.target));
        const isEdgeSelected = e.id === selectedEdgeId;
        const highlight = isDirectlyConnected || isFlowEdge || isEdgeSelected;

        return {
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label || e.relation,
          animated: Boolean(relStyle.animated || highlight),
          selected: isEdgeSelected,
          style: {
            stroke: isEdgeSelected ? '#FACC15' : highlight ? '#60A5FA' : relStyle.color,
            strokeWidth: highlight ? 2.2 : 1.3,
            strokeDasharray: relStyle.dash,
            opacity: activeFlowActive && !isFlowEdge ? 0.18 : anchorId && !highlight ? 0.25 : 0.92,
          },
          labelStyle: {
            fill: highlight ? '#F8FAFC' : '#94A3B8',
            fontSize: 10,
            fontFamily: 'JetBrains Mono',
          },
          labelBgStyle: { fill: '#070A12', fillOpacity: 0.9 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isEdgeSelected ? '#FACC15' : highlight ? '#60A5FA' : relStyle.color,
          },
        };
      });

    return { flowNodes, flowEdges };
  }, [
    visibleGraphNodes,
    visibleGraphEdges,
    layoutMode,
    basePositions,
    manualOffsets,
    collapsedGroups,
    focusedNodeId,
    selectedNodeId,
    selectedEdgeId,
    connectedNodeIds,
    activeFlow,
    flowNodeSet,
    flowEdgeSet,
    searchHighlightIds,
    searchQuery,
    handleToggleGroup,
    handleDrillDown,
  ]);

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(computedFlow.flowNodes);
  useEffect(() => {
    setRfNodes(computedFlow.flowNodes);
  }, [computedFlow.flowNodes, setRfNodes]);

  // Center viewport reliably once target node is present in rendered React Flow nodes
  useEffect(() => {
    const targetId = pendingCenterNodeIdRef.current;
    if (!targetId || viewMode !== 'graph') return;
    const rfNode = rfNodes.find((n) => n.id === targetId) || getNode(targetId);
    if (!rfNode) return;

    pendingCenterNodeIdRef.current = null;
    const rafId = requestAnimationFrame(() => {
      setCenter(rfNode.position.x + 122, rfNode.position.y + 46, {
        zoom: 1.08,
        duration: 360,
      });
    });
    return () => cancelAnimationFrame(rafId);
  }, [rfNodes, viewMode, getNode, setCenter]);

  const visibleNodeIdSet = useMemo(
    () => new Set(visibleGraphNodes.map((n) => n.id)),
    [visibleGraphNodes]
  );

  const focusAndCenterNode = useCallback(
    (targetNode: { id: string; level: GraphLevel }) => {
      if (targetNode.level !== level) {
        setLevel(targetNode.level);
        if (targetNode.level !== 'code') {
          setScopedCodeGraph(null);
          setCodeScopeLabel(null);
        }
      }
      setViewMode('graph');
      setSelectedEdgeId(null);
      setSelectedNodeId(targetNode.id);
      setFocusedNodeId(targetNode.id);
      pendingCenterNodeIdRef.current = targetNode.id;
    },
    [level]
  );

  const handleSelectSearchResult = useCallback(
    async (result: GlobalSearchResult) => {
      // Clear restrictive filters that could hide the searched node
      setKindFilter('all');
      setLanguageFilter('all');
      setFolderFilter('all');
      setModuleFilter('all');
      setEdgeRelationFilter('all');
      setScopeSideFilter('all');
      setDepOriginFilter('all');
      setRelationFilterMode('all');
      setHideUnrelated(false);

      // Expand module container if collapsed in grouped layout
      if (result.moduleGroup && collapsedGroups.has(result.moduleGroup)) {
        setCollapsedGroups((prev) => {
          const next = new Set(prev);
          next.delete(result.moduleGroup!);
          return next;
        });
      }

      // If targeting a truncated L4 symbol, load its file's scoped code graph first
      if (result.level === 'code' && result.requiresCodeSlice && result.filePath) {
        try {
          const res = await api.architecture.codeSlice(repositoryId, {
            filePath: result.filePath,
            limit: 160,
          });
          setScopedCodeGraph(res.graph);
          setCodeScopeLabel(result.filePath);
        } catch {
          // fallback to existing level graph
        }
      }

      focusAndCenterNode({ id: result.id, level: result.level });
    },
    [repositoryId, collapsedGroups, focusAndCenterNode]
  );

  const nodeMap = useMemo(() => {
    const map = new Map<string, GraphNodeDTO>();
    if (!intelligence) return map;
    for (const lvl of ['system', 'module', 'file', 'code'] as GraphLevel[]) {
      for (const n of intelligence.levels[lvl].nodes) {
        map.set(n.id, n);
      }
    }
    if (scopedCodeGraph) {
      for (const n of scopedCodeGraph.nodes) map.set(n.id, n);
    }
    return map;
  }, [intelligence, scopedCodeGraph]);

  const selectedNode = selectedNodeId ? nodeMap.get(selectedNodeId) || null : null;
  const selectedEdge = selectedEdgeId
    ? currentLevelData.edges.find((e) => e.id === selectedEdgeId) || null
    : null;

  // Export Actions (PNG / SVG via dedicated full-graph exporter)
  const handleExportVisualization = async (format: ArchitectureExportFormat) => {
    setExportOpen(false);
    if (visibleGraphNodes.length === 0) {
      notify('No visible nodes to export with current filters.', 'error');
      return;
    }

    setExportingFormat(format);
    try {
      const result = await exportArchitectureGraph({
        format,
        repositoryName,
        level,
        layoutMode,
        nodes: visibleGraphNodes,
        edges: visibleGraphEdges,
        basePositions,
        manualOffsets,
        rfNodes,
        flowWrapperEl: flowWrapperRef.current,
      });
      notify(`Exported ${result.filename}`, 'success');
    } catch (err) {
      notify(
        err instanceof Error ? err.message : `Failed to export ${format.toUpperCase()} graph.`,
        'error'
      );
    } finally {
      setExportingFormat(null);
    }
  };

  const handleExportJson = () => {
    setExportOpen(false);
    if (!intelligence) return;
    const blob = new Blob([JSON.stringify(intelligence, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${repositoryName}-architecture-intelligence.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Exported full deterministic graph JSON.', 'success');
  };

  const handleExportDependencyReport = () => {
    setExportOpen(false);
    if (!intelligence) return;
    const md = buildDependencyReportMarkdown(intelligence);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${repositoryName}-dependency-report.md`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Exported dependency & complexity report (.md).', 'success');
  };

  const handleCopyShareLink = async () => {
    setExportOpen(false);
    await navigator.clipboard.writeText(window.location.href);
    notify('Copied shareable architecture view URL to clipboard.', 'success');
  };

  const handleToggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  };

  const resetFiltersAndLayout = () => {
    setKindFilter('all');
    setLanguageFilter('all');
    setFolderFilter('all');
    setModuleFilter('all');
    setEdgeRelationFilter('all');
    setScopeSideFilter('all');
    setDepOriginFilter('all');
    setFocusedNodeId(null);
    setRelationFilterMode('all');
    setHideUnrelated(false);
    setActiveFlow(null);
    setSelectedEdgeId(null);
    setCollapsedGroups(new Set());
    setManualOffsets(new Map());
    setLayoutNonce((n) => n + 1);
    setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 80);
  };

  if (loading && !intelligence) {
    return (
      <div className="space-y-4">
        <div className="h-14 rounded-xl border border-white/[0.08] bg-[#111827] animate-pulse" />
        <div className="h-[620px] rounded-xl border border-white/[0.08] bg-[#111827] animate-pulse" />
      </div>
    );
  }

  if (error || !intelligence) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-8 text-center">
        <Layers className="w-8 h-8 text-rose-400 mx-auto mb-3" />
        <p className="text-sm font-semibold text-white">Unable to build AST Architecture Graph</p>
        <p className="mt-1 text-xs text-rose-200/80">{error || 'No source files indexed yet.'}</p>
        <button
          type="button"
          onClick={() => void loadIntelligence(true)}
          className="mt-4 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white"
        >
          Retry AST Analysis
        </button>
      </div>
    );
  }

  const activeFiltersCount = [
    kindFilter !== 'all',
    languageFilter !== 'all',
    folderFilter !== 'all',
    moduleFilter !== 'all',
    edgeRelationFilter !== 'all',
    scopeSideFilter !== 'all',
    depOriginFilter !== 'all',
    hideUnrelated,
    relationFilterMode !== 'all',
  ].filter(Boolean).length;

  return (
    <div
      ref={containerRef}
      className={`space-y-3 ${isFullscreen ? 'bg-[#0B0F19] p-4 overflow-y-auto' : ''}`}
    >
      {/* TOP TOOLBAR */}
      <div className="rounded-xl border border-white/[0.08] bg-[#111827] p-3 flex flex-wrap items-center justify-between gap-2.5">
        {/* Left: Project + Level Selector + View Modes */}
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs font-semibold text-white px-2 truncate max-w-[160px]">
            {repositoryName}
          </span>

          {/* Multi-Level Switcher */}
          <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-[#0B0F19] border border-white/[0.08]">
            {LEVEL_LABELS.map((lvl) => (
              <button
                key={lvl.id}
                type="button"
                onClick={() => {
                  setLevel(lvl.id);
                  setViewMode('graph');
                  setFocusedNodeId(null);
                  setSelectedEdgeId(null);
                  if (lvl.id !== 'code') {
                    setScopedCodeGraph(null);
                    setCodeScopeLabel(null);
                  }
                  const firstNode = intelligence.levels[lvl.id].nodes[0];
                  if (firstNode) setSelectedNodeId(firstNode.id);
                  setTimeout(() => fitView({ padding: 0.2, duration: 280 }), 70);
                }}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  level === lvl.id && viewMode === 'graph'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {lvl.label}
              </button>
            ))}
          </div>

          {/* View Mode Selector */}
          <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-[#0B0F19] border border-white/[0.08]">
            <button
              type="button"
              onClick={() => setViewMode('graph')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                viewMode === 'graph' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Graph</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('flow');
                setLevel('file');
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                viewMode === 'flow' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Workflow className="w-3.5 h-3.5" />
              <span>Data Flow ({intelligence.dataFlows.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('symbols')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                viewMode === 'symbols'
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Braces className="w-3.5 h-3.5" />
              <span>Symbols</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('analysis')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                viewMode === 'analysis'
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Analysis</span>
            </button>
          </div>
        </div>

        {/* Right: Search, Filters, Layout, Actions, Export, Fullscreen */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Global Search Component */}
          <GlobalSearch
            intelligence={intelligence}
            currentLevel={level}
            visibleNodeIds={visibleNodeIdSet}
            query={searchQuery}
            onQueryChange={setSearchQuery}
            onSelectResult={(res) => void handleSelectSearchResult(res)}
            onHighlightIdsChange={handleHighlightIdsChange}
          />

          {/* Filters Popover Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setFiltersOpen((v) => !v);
                setExportOpen(false);
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-colors whitespace-nowrap ${
                activeFiltersCount > 0 || filtersOpen
                  ? 'border-blue-500/40 bg-blue-600/15 text-blue-300'
                  : 'border-white/10 bg-[#0B0F19] text-slate-300 hover:text-white'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filters{activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ''}</span>
            </button>

            {filtersOpen && (
              <div className="absolute right-0 mt-1.5 w-80 rounded-xl border border-white/10 bg-[#111827] shadow-xl z-40 p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Graph Filters</span>
                  <button
                    type="button"
                    onClick={resetFiltersAndLayout}
                    className="text-blue-400 hover:underline"
                  >
                    Clear All
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Node Type</label>
                    <select
                      value={kindFilter}
                      onChange={(e) => setKindFilter(e.target.value as 'all' | GraphNodeKind)}
                      className="w-full rounded-md border border-white/10 bg-[#0B0F19] px-2 py-1.5 text-xs text-white"
                    >
                      <option value="all">All Types</option>
                      {filterOptions.kinds.map((k) => (
                        <option key={k} value={k}>
                          {NODE_KIND_META[k]?.label || k}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Relationship</label>
                    <select
                      value={edgeRelationFilter}
                      onChange={(e) =>
                        setEdgeRelationFilter(e.target.value as 'all' | GraphEdgeRelation)
                      }
                      className="w-full rounded-md border border-white/10 bg-[#0B0F19] px-2 py-1.5 text-xs text-white"
                    >
                      <option value="all">All Relations</option>
                      {filterOptions.relations.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Language</label>
                    <select
                      value={languageFilter}
                      onChange={(e) => setLanguageFilter(e.target.value)}
                      className="w-full rounded-md border border-white/10 bg-[#0B0F19] px-2 py-1.5 text-xs text-white"
                    >
                      <option value="all">All Languages</option>
                      {filterOptions.languages.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Module</label>
                    <select
                      value={moduleFilter}
                      onChange={(e) => setModuleFilter(e.target.value)}
                      className="w-full rounded-md border border-white/10 bg-[#0B0F19] px-2 py-1.5 text-xs text-white"
                    >
                      <option value="all">All Modules</option>
                      {filterOptions.modules.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Folder</label>
                    <select
                      value={folderFilter}
                      onChange={(e) => setFolderFilter(e.target.value)}
                      className="w-full rounded-md border border-white/10 bg-[#0B0F19] px-2 py-1.5 text-xs text-white"
                    >
                      <option value="all">All Folders</option>
                      {filterOptions.folders.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Architecture Side</label>
                    <select
                      value={scopeSideFilter}
                      onChange={(e) =>
                        setScopeSideFilter(e.target.value as 'all' | 'frontend' | 'backend')
                      }
                      className="w-full rounded-md border border-white/10 bg-[#0B0F19] px-2 py-1.5 text-xs text-white"
                    >
                      <option value="all">Frontend &amp; Backend</option>
                      <option value="frontend">Frontend Only</option>
                      <option value="backend">Backend / Shared Only</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Internal vs External
                  </label>
                  <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-[#0B0F19] border border-white/[0.06]">
                    {(['all', 'internal', 'external'] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setDepOriginFilter(opt)}
                        className={`py-1 rounded text-xs capitalize ${
                          depOriginFilter === opt
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Layout Selector */}
          <select
            aria-label="Graph layout"
            value={layoutMode}
            onChange={(e) => {
              setLayoutMode(e.target.value as LayoutMode);
              setManualOffsets(new Map());
              setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 80);
            }}
            className="rounded-lg border border-white/10 bg-[#0B0F19] px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            {LAYOUT_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                Layout: {opt.label}
              </option>
            ))}
          </select>

          {/* Hide Unrelated Toggle */}
          <button
            type="button"
            onClick={() => setHideUnrelated((v) => !v)}
            title="Hide nodes not directly connected to selection"
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs transition-colors whitespace-nowrap ${
              hideUnrelated
                ? 'border-blue-500/40 bg-blue-600/15 text-blue-300'
                : 'border-white/10 bg-[#0B0F19] text-slate-300 hover:text-white'
            }`}
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Isolate</span>
          </button>

          {/* Reset & Fit */}
          <button
            type="button"
            onClick={resetFiltersAndLayout}
            title="Reset layout and filters"
            className="p-1.5 rounded-lg border border-white/10 bg-[#0B0F19] text-slate-300 hover:text-white"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => fitView({ padding: 0.2, duration: 300 })}
            title="Fit graph to screen"
            className="p-1.5 rounded-lg border border-white/10 bg-[#0B0F19] text-slate-300 hover:text-white"
          >
            <Scan className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => void loadIntelligence(true)}
            title="Refresh AST parse"
            className="p-1.5 rounded-lg border border-white/10 bg-[#0B0F19] text-slate-300 hover:text-white"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              type="button"
              disabled={exportingFormat !== null}
              onClick={() => {
                setExportOpen((v) => !v);
                setFiltersOpen(false);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 bg-[#0B0F19] text-xs text-slate-200 hover:text-white disabled:opacity-60 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{exportingFormat ? `Exporting ${exportingFormat.toUpperCase()}...` : 'Export'}</span>
            </button>
            {exportOpen && (
              <div className="absolute right-0 mt-1.5 w-56 rounded-xl border border-white/10 bg-[#111827] shadow-xl z-40 p-1.5 text-xs space-y-0.5">
                <button
                  type="button"
                  onClick={() => void handleExportVisualization('png')}
                  className="w-full text-left px-3 py-2 rounded-lg text-slate-200 hover:bg-white/[0.06] flex items-center justify-between"
                >
                  <span>Export PNG Image</span>
                  <span className="font-mono text-[10px] text-slate-500">2x</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleExportVisualization('svg')}
                  className="w-full text-left px-3 py-2 rounded-lg text-slate-200 hover:bg-white/[0.06] flex items-center justify-between"
                >
                  <span>Export SVG Vector</span>
                  <span className="font-mono text-[10px] text-slate-500">vector</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportJson}
                  className="w-full text-left px-3 py-2 rounded-lg text-slate-200 hover:bg-white/[0.06]"
                >
                  Export Graph JSON
                </button>
                <button
                  type="button"
                  onClick={handleExportDependencyReport}
                  className="w-full text-left px-3 py-2 rounded-lg text-slate-200 hover:bg-white/[0.06]"
                >
                  Dependency Report (.md)
                </button>
                <div className="border-t border-white/[0.08] my-1" />
                <button
                  type="button"
                  onClick={() => void handleCopyShareLink()}
                  className="w-full text-left px-3 py-2 rounded-lg text-blue-300 hover:bg-white/[0.06] flex items-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Copy Shareable View URL</span>
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => void handleToggleFullscreen()}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen mode'}
            className="p-1.5 rounded-lg border border-white/10 bg-[#0B0F19] text-slate-300 hover:text-white"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Scope Banner for Level 4 Drill-Down or Active Truncation */}
      {(codeScopeLabel || (level === 'code' && currentLevelData.truncated)) && (
        <div className="rounded-lg border border-blue-500/25 bg-blue-500/[0.07] px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-blue-200">
            {codeScopeLabel
              ? `Scoped L4 Code Architecture to "${codeScopeLabel}" (${visibleGraphNodes.length} symbols).`
              : `Showing top ${visibleGraphNodes.length} of ${currentLevelData.totalNodesAvailable} symbols at L4 for performance. Double-click any File or Module node to inspect its full code symbols.`}
          </span>
          {codeScopeLabel && (
            <button
              type="button"
              onClick={() => {
                setScopedCodeGraph(null);
                setCodeScopeLabel(null);
              }}
              className="text-blue-300 hover:underline font-medium"
            >
              Show Repo Top Symbols
            </button>
          )}
        </div>
      )}

      {/* MAIN VIEWPORTS */}
      {viewMode === 'symbols' && (
        <SymbolExplorerPanel
          intelligence={intelligence}
          initialSearch={symbolInitialSearch}
          onOpenFile={onOpenFile}
          onLocateSymbolInGraph={async (symbolId, filePath) => {
            try {
              const res = await api.architecture.codeSlice(repositoryId, { filePath, limit: 160 });
              setScopedCodeGraph(res.graph);
              setCodeScopeLabel(filePath);
            } catch {
              // ignore
            }
            focusAndCenterNode({ id: symbolId, level: 'code' });
          }}
        />
      )}

      {viewMode === 'analysis' && (
        <AnalysisInsightsPanel
          intelligence={intelligence}
          selectedNodeId={selectedNodeId}
          impact={impact}
          impactLoading={impactLoading}
          onSelectNode={(id) => {
            const target = nodeMap.get(id);
            if (target) focusAndCenterNode({ id: target.id, level: target.level });
          }}
          onOpenFile={onOpenFile}
        />
      )}

      {(viewMode === 'graph' || viewMode === 'flow') && (
        <div className="space-y-3">
          {viewMode === 'flow' && (
            <DataFlowPanel
              flows={intelligence.dataFlows}
              activeFlowId={activeFlow?.id || null}
              onSelectFlow={(flow) => {
                setActiveFlow(flow);
                if (flow) {
                  setLevel('file');
                  if (flow.nodeIds[0]) setSelectedNodeId(flow.nodeIds[0]);
                  setTimeout(() => fitView({ padding: 0.25, duration: 300 }), 80);
                }
              }}
              onOpenFile={onOpenFile}
              onFocusNode={(nodeId) => focusAndCenterNode({ id: nodeId, level: 'file' })}
            />
          )}

          {/* CENTER CANVAS + RIGHT SIDEBAR */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div
              ref={flowWrapperRef}
              className={`lg:col-span-8 rounded-xl border border-white/[0.08] bg-[#070A12] overflow-hidden relative ${
                isFullscreen ? 'h-[72vh]' : 'h-[620px]'
              }`}
            >
              {visibleGraphNodes.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                  <p className="text-sm font-medium text-white">No nodes match current filters</p>
                  <button
                    type="button"
                    onClick={resetFiltersAndLayout}
                    className="mt-3 px-3 py-1.5 rounded-lg bg-blue-600 text-xs font-medium text-white"
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                <ReactFlow
                  nodes={rfNodes}
                  edges={computedFlow.flowEdges}
                  nodeTypes={nodeTypes}
                  onNodesChange={(changes) => {
                    onNodesChange(changes);
                    for (const ch of changes) {
                      if (
                        ch.type === 'position' &&
                        ch.position &&
                        ch.dragging === false &&
                        !ch.id.startsWith('group:')
                      ) {
                        setManualOffsets((prev) => {
                          const next = new Map(prev);
                          next.set(ch.id, ch.position!);
                          return next;
                        });
                      }
                    }
                  }}
                  onNodeClick={(_e, node) => {
                    if (node.id.startsWith('group:')) return;
                    setSelectedEdgeId(null);
                    setSelectedNodeId(node.id);
                    setRelationFilterMode('all');
                  }}
                  onNodeDoubleClick={(_e, node) => {
                    const dto = nodeMap.get(node.id);
                    if (dto?.drillDownLevel) {
                      void handleDrillDown(dto);
                    } else if (dto?.filePath) {
                      onOpenFile(dto.filePath, dto.line, dto.endLine);
                    }
                  }}
                  onEdgeClick={(_e, edge) => {
                    setSelectedEdgeId(edge.id);
                  }}
                  onSelectionChange={({ nodes: selNodes }) => {
                    const nextIds = selNodes
                      .filter((n) => !n.id.startsWith('group:'))
                      .map((n) => n.id);
                    setMultiSelectedIds((prev) => {
                      if (
                        prev.length === nextIds.length &&
                        prev.every((id, idx) => id === nextIds[idx])
                      ) {
                        return prev;
                      }
                      return nextIds;
                    });
                  }}
                  onPaneClick={() => {
                    setSelectedEdgeId(null);
                    setFocusedNodeId(null);
                    setRelationFilterMode('all');
                  }}
                  fitView
                  fitViewOptions={{ padding: 0.22 }}
                  minZoom={0.15}
                  maxZoom={2.2}
                  multiSelectionKeyCode="Shift"
                  proOptions={{ hideAttribution: true }}
                >
                  <Background color="rgba(148,163,184,0.12)" gap={24} />
                  <Controls />
                  <MiniMap
                    nodeColor={(n) => {
                      const kind = (n.data as ArchNodeRenderData)?.kind;
                      return (kind && NODE_KIND_META[kind]?.hexColor) || '#3B82F6';
                    }}
                    maskColor="rgba(11, 15, 25, 0.78)"
                  />
                </ReactFlow>
              )}
            </div>

            {/* RIGHT INSPECTOR */}
            <div className={`lg:col-span-4 ${isFullscreen ? 'h-[72vh]' : 'h-[620px]'}`}>
              <NodeInspectorSidebar
                intelligence={intelligence}
                selectedNode={selectedNode}
                selectedEdge={selectedEdge}
                activeEdges={currentLevelData.edges}
                nodeMap={nodeMap}
                impact={impact}
                impactLoading={impactLoading}
                onSelectNode={(id) => focusAndCenterNode({ id, level })}
                onClearEdge={() => setSelectedEdgeId(null)}
                onOpenFile={onOpenFile}
                onFocusNode={(id) => {
                  setFocusedNodeId(id);
                  setHideUnrelated(true);
                  setRelationFilterMode('all');
                }}
                onFilterMode={(mode) => {
                  if (selectedNodeId) setFocusedNodeId(selectedNodeId);
                  setRelationFilterMode(mode);
                  setHideUnrelated(true);
                }}
                onTraceFlow={(node) => {
                  const matchingFlow = intelligence.dataFlows.find(
                    (f) =>
                      f.nodeIds.includes(node.id) ||
                      (node.filePath && f.steps.some((s) => s.filePath === node.filePath))
                  );
                  setViewMode('flow');
                  setLevel('file');
                  if (matchingFlow) {
                    setActiveFlow(matchingFlow);
                    notify(`Tracing flow: ${matchingFlow.title}`, 'info');
                  } else {
                    notify('Switched to Data Flow tracer. Select a traced chain above.', 'info');
                  }
                }}
                onFindReferences={(sym) => {
                  setSymbolInitialSearch(sym.replace(/\(\)$/, ''));
                  setViewMode('symbols');
                }}
                onDrillDown={(node) => void handleDrillDown(node)}
              />
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM STATUS & BREADCRUMB PANEL */}
      <div className="rounded-xl border border-white/[0.08] bg-[#111827] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-1.5 text-slate-400">
          {breadcrumbs.map((b, idx) => (
            <span key={`${b.level}-${idx}`} className="inline-flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setLevel(b.level);
                  setViewMode('graph');
                  if (b.level !== 'code') {
                    setScopedCodeGraph(null);
                    setCodeScopeLabel(null);
                  }
                }}
                className={`hover:text-white transition-colors ${
                  level === b.level ? 'text-white font-medium' : ''
                }`}
              >
                {b.label}
              </button>
              {idx < breadcrumbs.length - 1 && <ChevronRight className="w-3 h-3 text-slate-600" />}
            </span>
          ))}
          {selectedNode && (
            <>
              <ChevronRight className="w-3 h-3 text-slate-600" />
              <span className="font-mono text-blue-300 truncate max-w-[240px]">
                {selectedNode.name}
              </span>
            </>
          )}
          {multiSelectedIds.length > 1 && (
            <span className="ml-2 font-mono text-violet-300">
              ({multiSelectedIds.length} selected)
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 font-mono text-slate-400 tabular-nums">
          <span>{visibleGraphNodes.length} nodes</span>
          <span aria-hidden="true">·</span>
          <span>{computedFlow.flowEdges.length} edges</span>
          <span aria-hidden="true">·</span>
          <span>
            {intelligence.complexityMetrics.functionCount + intelligence.complexityMetrics.methodCount}{' '}
            fn
          </span>
          <span aria-hidden="true">·</span>
          <span>{intelligence.complexityMetrics.classCount} classes</span>
          <span aria-hidden="true">·</span>
          <span
            className={
              intelligence.complexityMetrics.circularDependencyCount > 0
                ? 'text-rose-400'
                : 'text-emerald-400'
            }
          >
            {intelligence.complexityMetrics.circularDependencyCount} cycles
          </span>
        </div>
      </div>
    </div>
  );
}

export function ArchitectureTab(props: ArchitectureTabProps) {
  return (
    <ErrorBoundary title="Architecture Graph error">
      <ReactFlowProvider>
        <ArchitectureCanvasWorkspace {...props} />
      </ReactFlowProvider>
    </ErrorBoundary>
  );
}
