import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import ReactFlow, {
  Background,
  BackgroundVariant,
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
  AlertCircle,
  Braces,
  ChevronRight,
  Download,
  EyeOff,
  Filter,
  GitFork,
  Grid3X3,
  Info,
  Layers,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  RotateCcw,
  Scan,
  Share2,
  Workflow,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type {
  ArchitectureIntelligenceDTO,
  ChatMode,
  DataFlowChain,
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
import { ArchRelationEdge, type ArchEdgeRenderData } from './architecture/CustomArchEdges.tsx';
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

const edgeTypes = {
  archEdge: ArchRelationEdge,
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
  const { fitView, setCenter, getNode, zoomIn, zoomOut } = useReactFlow();
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

  // Canvas & Workspace Controls
  const [showGrid, setShowGrid] = useState(true);
  const [showMinimap, setShowMinimap] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);

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

  // Fullscreen & Escape listener
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFiltersOpen(false);
        setExportOpen(false);
        setOverviewOpen(false);
        setMobileInspectorOpen(false);
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      window.removeEventListener('keydown', onKeyDown);
    };
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
        const maxX = Math.max(...itemPositions.map((p) => p.x)) + 272;
        const maxY = Math.max(...itemPositions.map((p) => p.y)) + 118;

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
    const flowEdges: Edge<ArchEdgeRenderData>[] = visibleGraphEdges
      .filter((e) => visibleFlowIds.has(e.source) && visibleFlowIds.has(e.target))
      .map((e) => {
        const relStyle = RELATION_META[e.relation] || RELATION_META.IMPORTS;
        const isDirectlyConnected = anchorId === e.source || anchorId === e.target;
        const isFlowEdge =
          flowEdgeSet.has(e.id) || (flowNodeSet.has(e.source) && flowNodeSet.has(e.target));
        const isEdgeSelected = e.id === selectedEdgeId;
        const highlight = isDirectlyConnected || isFlowEdge || isEdgeSelected;
        const isDimmed = Boolean(
          (activeFlowActive && !isFlowEdge) || (anchorId && !highlight)
        );
        const markerColor = isEdgeSelected
          ? '#FBBF24'
          : isFlowEdge
            ? '#22D3EE'
            : highlight
              ? '#60A5FA'
              : relStyle.color;

        return {
          id: e.id,
          type: 'archEdge',
          source: e.source,
          target: e.target,
          selected: isEdgeSelected,
          data: {
            relation: e.relation,
            label: e.label || e.relation,
            color: relStyle.color,
            dash: relStyle.dash,
            isHighlighted: highlight,
            isFlowEdge,
            isDimmed,
          } satisfies ArchEdgeRenderData,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 14,
            height: 14,
            color: markerColor,
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
      setCenter(rfNode.position.x + 124, rfNode.position.y + 49, {
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

  const overviewStats = useMemo(() => {
    const kindCounts = new Map<GraphNodeKind, number>();
    for (const n of visibleGraphNodes) {
      kindCounts.set(n.kind, (kindCounts.get(n.kind) || 0) + 1);
    }
    const relCounts = new Map<GraphEdgeRelation, number>();
    for (const e of visibleGraphEdges) {
      relCounts.set(e.relation, (relCounts.get(e.relation) || 0) + 1);
    }
    return {
      topKinds: Array.from(kindCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6),
      topRelations: Array.from(relCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6),
    };
  }, [visibleGraphNodes, visibleGraphEdges]);

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
      setKindFilter('all');
      setLanguageFilter('all');
      setFolderFilter('all');
      setModuleFilter('all');
      setEdgeRelationFilter('all');
      setScopeSideFilter('all');
      setDepOriginFilter('all');
      setRelationFilterMode('all');
      setHideUnrelated(false);

      if (result.moduleGroup && collapsedGroups.has(result.moduleGroup)) {
        setCollapsedGroups((prev) => {
          const next = new Set(prev);
          next.delete(result.moduleGroup!);
          return next;
        });
      }

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

  // Export Actions
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

  // LOADING STATE: Structured Topology Skeleton
  if (loading && !intelligence) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-[#202A3A] bg-[#0D111B] px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#151D2B] animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-3 w-28 rounded bg-[#151D2B] animate-pulse" />
              <div className="h-5 w-48 rounded bg-[#151D2B] animate-pulse" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-56 rounded-lg bg-[#151D2B] animate-pulse hidden sm:block" />
            <div className="h-8 w-44 rounded-lg bg-[#151D2B] animate-pulse" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
          <div className="lg:col-span-8 h-[640px] rounded-lg border border-[#202A3A] bg-[#080B12] relative overflow-hidden flex flex-col items-center justify-center p-8">
            <div className="relative w-full max-w-md space-y-5">
              <div className="flex items-center justify-between gap-6">
                <div className="w-40 h-20 rounded-lg border border-[#202A3A] bg-[#101623] animate-pulse" />
                <div className="w-40 h-20 rounded-lg border border-[#202A3A] bg-[#101623] animate-pulse" />
              </div>
              <div className="flex justify-center">
                <div className="w-48 h-20 rounded-lg border border-[#60A5FA]/25 bg-[#101623] animate-pulse" />
              </div>
              <div className="flex items-center justify-between gap-6">
                <div className="w-40 h-20 rounded-lg border border-[#202A3A] bg-[#101623] animate-pulse" />
                <div className="w-40 h-20 rounded-lg border border-[#202A3A] bg-[#101623] animate-pulse" />
              </div>
            </div>
            <div className="mt-6 flex items-center gap-2 text-[12px] font-mono text-[#94A3B8]">
              <RefreshCw className="w-3.5 h-3.5 text-[#60A5FA] animate-spin" />
              <span>Parsing repository AST and resolving dependency graph...</span>
            </div>
          </div>

          <div className="lg:col-span-4 h-[640px] rounded-lg border border-[#202A3A] bg-[#101623] p-4 space-y-3 hidden lg:block">
            <div className="h-14 rounded-lg bg-[#151D2B] animate-pulse" />
            <div className="h-24 rounded-lg bg-[#0D111B] animate-pulse" />
            <div className="h-28 rounded-lg bg-[#0D111B] animate-pulse" />
            <div className="h-48 rounded-lg bg-[#080B12] animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // ERROR STATE: Clear Diagnostic Card
  if (error || !intelligence) {
    return (
      <div className="rounded-lg border border-[#FB7185]/35 bg-[#101623] p-10 text-center max-w-xl mx-auto my-8">
        <div className="w-11 h-11 rounded-lg border border-[#FB7185]/30 bg-[#FB7185]/10 flex items-center justify-center mx-auto mb-3.5">
          <AlertCircle className="w-5 h-5 text-[#FB7185]" />
        </div>
        <h3 className="font-display text-[16px] font-semibold text-[#F1F5F9]">
          Unable to build AST Architecture Graph
        </h3>
        <p className="mt-1.5 text-[13px] text-[#94A3B8]">
          {error || 'No source files indexed yet for this repository.'}
        </p>
        <p className="mt-1 text-[11px] font-mono text-[#64748B]">
          Verify that repository files have been cloned and indexed, then retry static parsing.
        </p>
        <button
          type="button"
          onClick={() => void loadIntelligence(true)}
          className="mt-5 inline-flex items-center gap-2 h-8 px-4 rounded-lg border border-[#60A5FA]/40 bg-[#60A5FA]/15 hover:bg-[#60A5FA]/25 text-[12px] font-medium text-[#F1F5F9] transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[#60A5FA]" />
          <span>Retry AST Analysis</span>
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

  const inspectorProps = {
    intelligence,
    selectedNode,
    selectedEdge,
    activeEdges: currentLevelData.edges,
    nodeMap,
    impact,
    impactLoading,
    onSelectNode: (id: string) => focusAndCenterNode({ id, level }),
    onClearEdge: () => setSelectedEdgeId(null),
    onOpenFile,
    onFocusNode: (id: string) => {
      setFocusedNodeId(id);
      setHideUnrelated(true);
      setRelationFilterMode('all');
    },
    onFilterMode: (mode: 'all' | 'deps' | 'callers') => {
      if (selectedNodeId) setFocusedNodeId(selectedNodeId);
      setRelationFilterMode(mode);
      setHideUnrelated(true);
    },
    onTraceFlow: (node: GraphNodeDTO) => {
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
    },
    onFindReferences: (sym: string) => {
      setSymbolInitialSearch(sym.replace(/\(\)$/, ''));
      setViewMode('symbols');
    },
    onDrillDown: (node: GraphNodeDTO) => void handleDrillDown(node),
  };

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className={`space-y-3 ${isFullscreen ? 'bg-[#080B12] p-4 overflow-y-auto h-screen' : ''}`}
      >
        {/* TOP HEADER & WORKSPACE TOOLBAR */}
        <header className="rounded-lg border border-[#202A3A] bg-[#0D111B]">
          {/* Row 1: Brand Title, Breadcrumbs & Level / Mode Switchers */}
          <div className="px-4 py-3 border-b border-[#202A3A] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg border border-[#202A3A] bg-[#101623] flex items-center justify-center shrink-0">
                <GitFork className="w-4 h-4 text-[#60A5FA]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#64748B] truncate">
                  <span className="text-[#94A3B8] truncate">{repositoryName}</span>
                  <span>/</span>
                  <span>{LEVEL_LABELS.find((l) => l.id === level)?.short || level}</span>
                  {codeScopeLabel && (
                    <>
                      <span>/</span>
                      <span className="text-[#60A5FA] truncate">{codeScopeLabel}</span>
                    </>
                  )}
                </div>
                <h2 className="font-display text-[20px] sm:text-[24px] leading-tight font-semibold tracking-tight text-[#F1F5F9]">
                  Architecture Intelligence
                </h2>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Multi-Level Switcher with Motion layoutId */}
              <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-[#080B12] border border-[#202A3A]">
                {LEVEL_LABELS.map((lvl) => {
                  const isActive = level === lvl.id && viewMode === 'graph';
                  return (
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
                      className={`relative px-2.5 h-7 text-[12px] font-medium rounded-md transition-colors whitespace-nowrap ${
                        isActive ? 'text-[#F1F5F9]' : 'text-[#94A3B8] hover:text-[#F1F5F9]'
                      }`}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="arch-level-pill"
                          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                          className="absolute inset-0 rounded-md bg-[#151D2B] border border-[#60A5FA]/40"
                        />
                      )}
                      <span className="relative z-10">{lvl.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* View Mode Switcher */}
              <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-[#080B12] border border-[#202A3A]">
                {(
                  [
                    { id: 'graph', label: 'Graph', icon: Layers },
                    {
                      id: 'flow',
                      label: `Data Flow (${intelligence.dataFlows.length})`,
                      icon: Workflow,
                    },
                    { id: 'symbols', label: 'Symbols', icon: Braces },
                    { id: 'analysis', label: 'Analysis', icon: Activity },
                  ] as const
                ).map((mode) => {
                  const Icon = mode.icon;
                  const active = viewMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => {
                        setViewMode(mode.id);
                        if (mode.id === 'flow') setLevel('file');
                      }}
                      className={`relative inline-flex items-center gap-1.5 px-2.5 h-7 text-[12px] font-medium rounded-md transition-colors whitespace-nowrap ${
                        active ? 'text-[#F1F5F9]' : 'text-[#94A3B8] hover:text-[#F1F5F9]'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="arch-view-pill"
                          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                          className="absolute inset-0 rounded-md bg-[#151D2B] border border-[#A78BFA]/40"
                        />
                      )}
                      <Icon
                        className={`w-3.5 h-3.5 relative z-10 ${
                          active ? 'text-[#A78BFA]' : 'text-[#64748B]'
                        }`}
                      />
                      <span className="relative z-10">{mode.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Row 2: Action & Search Toolbar (compact h-8 controls) */}
          <div className="px-4 py-2 flex flex-wrap items-center justify-between gap-2 bg-[#101623]/60">
            <div className="flex flex-wrap items-center gap-2">
              {/* Global Search */}
              <GlobalSearch
                intelligence={intelligence}
                currentLevel={level}
                visibleNodeIds={visibleNodeIdSet}
                query={searchQuery}
                onQueryChange={setSearchQuery}
                onSelectResult={(res) => void handleSelectSearchResult(res)}
                onHighlightIdsChange={handleHighlightIdsChange}
              />

              {/* Filters Popover */}
              <div className="relative">
                <button
                  type="button"
                  title="Filter graph nodes and relationships"
                  onClick={() => {
                    setFiltersOpen((v) => !v);
                    setExportOpen(false);
                    setOverviewOpen(false);
                  }}
                  className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-[12px] transition-colors whitespace-nowrap ${
                    activeFiltersCount > 0 || filtersOpen
                      ? 'border-[#60A5FA]/45 bg-[#151D2B] text-[#60A5FA]'
                      : 'border-[#202A3A] bg-[#080B12] text-[#94A3B8] hover:text-[#F1F5F9]'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>
                    Filters{activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ''}
                  </span>
                </button>

                <AnimatePresence>
                  {filtersOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 4, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.98 }}
                      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute left-0 sm:left-auto sm:right-0 mt-1.5 w-80 rounded-lg border border-[#202A3A] bg-[#101623] shadow-2xl z-40 p-4 space-y-3 text-[12px]"
                    >
                      <div className="flex items-center justify-between border-b border-[#202A3A] pb-2">
                        <span className="font-semibold text-[#F1F5F9]">Graph Filters</span>
                        <button
                          type="button"
                          onClick={resetFiltersAndLayout}
                          className="text-[11px] font-mono text-[#60A5FA] hover:underline"
                        >
                          Clear All
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] text-[#64748B] mb-1">
                            Node Type
                          </label>
                          <select
                            value={kindFilter}
                            onChange={(e) => setKindFilter(e.target.value as 'all' | GraphNodeKind)}
                            className="w-full h-8 rounded-md border border-[#202A3A] bg-[#080B12] px-2 text-[12px] text-[#F1F5F9] focus:outline-none focus:border-[#60A5FA]/50"
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
                          <label className="block text-[11px] text-[#64748B] mb-1">
                            Relationship
                          </label>
                          <select
                            value={edgeRelationFilter}
                            onChange={(e) =>
                              setEdgeRelationFilter(e.target.value as 'all' | GraphEdgeRelation)
                            }
                            className="w-full h-8 rounded-md border border-[#202A3A] bg-[#080B12] px-2 text-[12px] text-[#F1F5F9] focus:outline-none focus:border-[#60A5FA]/50"
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
                          <label className="block text-[11px] text-[#64748B] mb-1">
                            Language
                          </label>
                          <select
                            value={languageFilter}
                            onChange={(e) => setLanguageFilter(e.target.value)}
                            className="w-full h-8 rounded-md border border-[#202A3A] bg-[#080B12] px-2 text-[12px] text-[#F1F5F9] focus:outline-none focus:border-[#60A5FA]/50"
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
                          <label className="block text-[11px] text-[#64748B] mb-1">Module</label>
                          <select
                            value={moduleFilter}
                            onChange={(e) => setModuleFilter(e.target.value)}
                            className="w-full h-8 rounded-md border border-[#202A3A] bg-[#080B12] px-2 text-[12px] text-[#F1F5F9] focus:outline-none focus:border-[#60A5FA]/50"
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
                          <label className="block text-[11px] text-[#64748B] mb-1">Folder</label>
                          <select
                            value={folderFilter}
                            onChange={(e) => setFolderFilter(e.target.value)}
                            className="w-full h-8 rounded-md border border-[#202A3A] bg-[#080B12] px-2 text-[12px] text-[#F1F5F9] focus:outline-none focus:border-[#60A5FA]/50"
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
                          <label className="block text-[11px] text-[#64748B] mb-1">
                            Architecture Side
                          </label>
                          <select
                            value={scopeSideFilter}
                            onChange={(e) =>
                              setScopeSideFilter(e.target.value as 'all' | 'frontend' | 'backend')
                            }
                            className="w-full h-8 rounded-md border border-[#202A3A] bg-[#080B12] px-2 text-[12px] text-[#F1F5F9] focus:outline-none focus:border-[#60A5FA]/50"
                          >
                            <option value="all">Frontend &amp; Backend</option>
                            <option value="frontend">Frontend Only</option>
                            <option value="backend">Backend / Shared Only</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] text-[#64748B] mb-1">
                          Internal vs External
                        </label>
                        <div className="grid grid-cols-3 gap-0.5 p-0.5 rounded-lg bg-[#080B12] border border-[#202A3A]">
                          {(['all', 'internal', 'external'] as const).map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setDepOriginFilter(opt)}
                              className={`h-7 rounded text-[11px] capitalize transition-colors ${
                                depOriginFilter === opt
                                  ? 'bg-[#151D2B] text-[#F1F5F9] border border-[#60A5FA]/35'
                                  : 'text-[#94A3B8] hover:text-[#F1F5F9]'
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
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
                className="h-8 rounded-lg border border-[#202A3A] bg-[#080B12] px-2.5 text-[12px] text-[#F1F5F9] focus:outline-none focus:border-[#60A5FA]/50"
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
                className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-[12px] transition-colors whitespace-nowrap ${
                  hideUnrelated
                    ? 'border-[#60A5FA]/45 bg-[#151D2B] text-[#60A5FA]'
                    : 'border-[#202A3A] bg-[#080B12] text-[#94A3B8] hover:text-[#F1F5F9]'
                }`}
              >
                <EyeOff className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">Isolate</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {/* Refresh AST */}
              <button
                type="button"
                onClick={() => void loadIntelligence(true)}
                title="Re-run deterministic AST analysis"
                className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-[#202A3A] bg-[#080B12] text-[#94A3B8] hover:text-[#F1F5F9] hover:border-[#334155] transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#60A5FA]' : ''}`} />
              </button>

              {/* Inspector Toggle */}
              {(viewMode === 'graph' || viewMode === 'flow') && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.innerWidth < 1024) {
                      setMobileInspectorOpen((v) => !v);
                    } else {
                      setInspectorOpen((v) => !v);
                    }
                  }}
                  title="Toggle Node Inspector panel"
                  className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-[12px] transition-colors whitespace-nowrap ${
                    inspectorOpen
                      ? 'border-[#60A5FA]/35 bg-[#151D2B] text-[#F1F5F9]'
                      : 'border-[#202A3A] bg-[#080B12] text-[#94A3B8] hover:text-[#F1F5F9]'
                  }`}
                >
                  {inspectorOpen ? (
                    <PanelRightClose className="w-3.5 h-3.5 text-[#60A5FA]" />
                  ) : (
                    <PanelRightOpen className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden xl:inline">Inspector</span>
                </button>
              )}

              {/* Export Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  disabled={exportingFormat !== null}
                  onClick={() => {
                    setExportOpen((v) => !v);
                    setFiltersOpen(false);
                    setOverviewOpen(false);
                  }}
                  title="Export diagram or dependency report"
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-[#202A3A] bg-[#080B12] text-[12px] text-[#F1F5F9] hover:border-[#334155] disabled:opacity-60 transition-colors whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5 text-[#94A3B8]" />
                  <span>
                    {exportingFormat ? `Exporting ${exportingFormat.toUpperCase()}...` : 'Export'}
                  </span>
                </button>

                <AnimatePresence>
                  {exportOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 4, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.98 }}
                      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute right-0 mt-1.5 w-56 rounded-lg border border-[#202A3A] bg-[#101623] shadow-2xl z-40 p-1.5 text-[12px] space-y-0.5"
                    >
                      <button
                        type="button"
                        onClick={() => void handleExportVisualization('png')}
                        className="w-full text-left px-3 py-2 rounded-md text-[#F1F5F9] hover:bg-[#151D2B] flex items-center justify-between transition-colors"
                      >
                        <span>Export PNG Image</span>
                        <span className="font-mono text-[10px] text-[#64748B]">2x</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleExportVisualization('svg')}
                        className="w-full text-left px-3 py-2 rounded-md text-[#F1F5F9] hover:bg-[#151D2B] flex items-center justify-between transition-colors"
                      >
                        <span>Export SVG Vector</span>
                        <span className="font-mono text-[10px] text-[#64748B]">vector</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleExportJson}
                        className="w-full text-left px-3 py-2 rounded-md text-[#F1F5F9] hover:bg-[#151D2B] transition-colors"
                      >
                        Export Graph JSON
                      </button>
                      <button
                        type="button"
                        onClick={handleExportDependencyReport}
                        className="w-full text-left px-3 py-2 rounded-md text-[#F1F5F9] hover:bg-[#151D2B] transition-colors"
                      >
                        Dependency Report (.md)
                      </button>
                      <div className="border-t border-[#202A3A] my-1" />
                      <button
                        type="button"
                        onClick={() => void handleCopyShareLink()}
                        className="w-full text-left px-3 py-2 rounded-md text-[#60A5FA] hover:bg-[#151D2B] flex items-center gap-1.5 transition-colors"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Copy Shareable View URL</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Fullscreen Toggle */}
              <button
                type="button"
                onClick={() => void handleToggleFullscreen()}
                title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen workspace'}
                className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-[#202A3A] bg-[#080B12] text-[#94A3B8] hover:text-[#F1F5F9] hover:border-[#334155] transition-colors"
              >
                {isFullscreen ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Scope Banner for Level 4 Drill-Down or Truncation */}
        {(codeScopeLabel || (level === 'code' && currentLevelData.truncated)) && (
          <div className="rounded-lg border border-[#60A5FA]/30 bg-[#101623] px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-[12px]">
            <span className="text-[#94A3B8]">
              {codeScopeLabel ? (
                <>
                  Scoped L4 Code Architecture to{' '}
                  <span className="font-mono text-[#F1F5F9]">{codeScopeLabel}</span> (
                  <span className="font-mono text-[#60A5FA]">{visibleGraphNodes.length}</span>{' '}
                  symbols).
                </>
              ) : (
                `Showing top ${visibleGraphNodes.length} of ${currentLevelData.totalNodesAvailable} symbols at L4 for performance. Double-click any File or Module node to inspect its full code symbols.`
              )}
            </span>
            {codeScopeLabel && (
              <button
                type="button"
                onClick={() => {
                  setScopedCodeGraph(null);
                  setCodeScopeLabel(null);
                }}
                className="text-[12px] font-mono text-[#60A5FA] hover:underline"
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
                const res = await api.architecture.codeSlice(repositoryId, {
                  filePath,
                  limit: 160,
                });
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

            {/* CENTER GRAPH CANVAS + RIGHT INSPECTOR */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 relative">
              <div
                ref={flowWrapperRef}
                className={`${
                  inspectorOpen ? 'lg:col-span-8' : 'lg:col-span-12'
                } rounded-lg border border-[#202A3A] bg-[#080B12] overflow-hidden relative transition-all duration-200 ${
                  isFullscreen ? 'h-[74vh]' : 'h-[640px]'
                }`}
              >
                {visibleGraphNodes.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-11 h-11 rounded-lg border border-[#202A3A] bg-[#101623] flex items-center justify-center mb-3">
                      <Layers className="w-5 h-5 text-[#64748B]" />
                    </div>
                    <p className="text-[14px] font-semibold text-[#F1F5F9]">
                      No architecture nodes match the current view
                    </p>
                    <p className="mt-1 text-[12px] text-[#94A3B8] max-w-sm">
                      {activeFiltersCount > 0
                        ? 'Try clearing active node, language, or isolation filters to reveal the full topology.'
                        : 'No static symbols or modules were extracted at this level.'}
                    </p>
                    <button
                      type="button"
                      onClick={
                        activeFiltersCount > 0 ? resetFiltersAndLayout : () => void loadIntelligence(true)
                      }
                      className="mt-4 inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg border border-[#60A5FA]/40 bg-[#60A5FA]/15 hover:bg-[#60A5FA]/25 text-[12px] font-medium text-[#F1F5F9] transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-[#60A5FA]" />
                      <span>{activeFiltersCount > 0 ? 'Reset Filters' : 'Re-run AST Analysis'}</span>
                    </button>
                  </div>
                ) : (
                  <>
                    <ReactFlow
                      nodes={rfNodes}
                      edges={computedFlow.flowEdges}
                      nodeTypes={nodeTypes}
                      edgeTypes={edgeTypes}
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
                        setFiltersOpen(false);
                        setExportOpen(false);
                        setOverviewOpen(false);
                      }}
                      fitView
                      fitViewOptions={{ padding: 0.22 }}
                      minZoom={0.15}
                      maxZoom={2.2}
                      multiSelectionKeyCode="Shift"
                      proOptions={{ hideAttribution: true }}
                    >
                      {showGrid && (
                        <Background
                          variant={BackgroundVariant.Dots}
                          color="#202A3A"
                          gap={24}
                          size={1.2}
                        />
                      )}
                      {showMinimap && (
                        <MiniMap
                          nodeColor={(n) => {
                            const kind = (n.data as ArchNodeRenderData)?.kind;
                            return (kind && NODE_KIND_META[kind]?.hexColor) || '#60A5FA';
                          }}
                          maskColor="rgba(8, 11, 18, 0.78)"
                        />
                      )}
                    </ReactFlow>

                    {/* Subtle Canvas Edge Vignette */}
                    <div className="arch-canvas-vignette" />

                    {/* Floating Mobile Inspect Trigger (< lg screens) */}
                    {selectedNode && (
                      <button
                        type="button"
                        onClick={() => setMobileInspectorOpen(true)}
                        className="lg:hidden absolute top-3 right-3 z-20 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#202A3A] bg-[#101623] text-[12px] text-[#F1F5F9] shadow-lg"
                      >
                        <Info className="w-3.5 h-3.5 text-[#60A5FA]" />
                        <span className="max-w-[140px] truncate">{selectedNode.name}</span>
                      </button>
                    )}

                    {/* Floating Overview Legend Popover */}
                    <AnimatePresence>
                      {overviewOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 6, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 6, scale: 0.98 }}
                          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                          className="absolute bottom-14 left-3 z-30 w-72 rounded-lg border border-[#202A3A] bg-[#101623] p-3.5 shadow-2xl space-y-3 text-[11px]"
                        >
                          <div className="flex items-center justify-between border-b border-[#202A3A] pb-2">
                            <span className="font-semibold text-[#F1F5F9]">Graph Overview</span>
                            <span className="font-mono text-[#64748B]">
                              {visibleGraphNodes.length}n · {visibleGraphEdges.length}e
                            </span>
                          </div>
                          <div>
                            <div className="text-[10px] font-mono uppercase tracking-wider text-[#64748B] mb-1.5">
                              Top Node Categories
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                              {overviewStats.topKinds.map(([kind, count]) => {
                                const meta = NODE_KIND_META[kind] || NODE_KIND_META.file;
                                return (
                                  <div
                                    key={kind}
                                    className="flex items-center justify-between px-2 py-1 rounded bg-[#0D111B] border border-[#202A3A]"
                                  >
                                    <span className="flex items-center gap-1.5 truncate text-[#CBD5E1]">
                                      <span
                                        className="w-2 h-2 rounded-full shrink-0"
                                        style={{ backgroundColor: meta.hexColor }}
                                      />
                                      <span className="truncate">{meta.label}</span>
                                    </span>
                                    <span className="font-mono text-[#64748B] tabular-nums">
                                      {count}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          {overviewStats.topRelations.length > 0 && (
                            <div>
                              <div className="text-[10px] font-mono uppercase tracking-wider text-[#64748B] mb-1.5">
                                Relationships
                              </div>
                              <div className="space-y-1">
                                {overviewStats.topRelations.map(([rel, count]) => {
                                  const rMeta = RELATION_META[rel] || RELATION_META.IMPORTS;
                                  return (
                                    <div
                                      key={rel}
                                      className="flex items-center justify-between font-mono text-[10px]"
                                    >
                                      <span className="flex items-center gap-2 text-[#94A3B8]">
                                        <span
                                          className="w-3 h-0.5 inline-block"
                                          style={{ backgroundColor: rMeta.color }}
                                        />
                                        <span>{rel}</span>
                                      </span>
                                      <span className="text-[#64748B] tabular-nums">{count}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Floating Bottom-Left Navigation Dock */}
                    <div className="absolute bottom-3 left-3 z-20 inline-flex items-center gap-0.5 p-1 rounded-lg border border-[#202A3A] bg-[#101623]/95 shadow-lg">
                      <button
                        type="button"
                        onClick={() => zoomIn({ duration: 180 })}
                        title="Zoom in"
                        className="w-7 h-7 rounded-md flex items-center justify-center text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#151D2B] transition-colors"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => zoomOut({ duration: 180 })}
                        title="Zoom out"
                        className="w-7 h-7 rounded-md flex items-center justify-center text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#151D2B] transition-colors"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => fitView({ padding: 0.2, duration: 280 })}
                        title="Fit graph to view"
                        className="w-7 h-7 rounded-md flex items-center justify-center text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#151D2B] transition-colors"
                      >
                        <Scan className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={resetFiltersAndLayout}
                        title="Reset layout and filters"
                        className="w-7 h-7 rounded-md flex items-center justify-center text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#151D2B] transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>

                      <div className="w-px h-4 bg-[#202A3A] mx-0.5" />

                      <button
                        type="button"
                        onClick={() => setShowGrid((v) => !v)}
                        title={showGrid ? 'Hide dot grid' : 'Show dot grid'}
                        className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                          showGrid
                            ? 'text-[#60A5FA] bg-[#151D2B]'
                            : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#151D2B]'
                        }`}
                      >
                        <Grid3X3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowMinimap((v) => !v)}
                        title={showMinimap ? 'Hide minimap' : 'Show minimap'}
                        className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                          showMinimap
                            ? 'text-[#60A5FA] bg-[#151D2B]'
                            : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#151D2B]'
                        }`}
                      >
                        <MapIcon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setOverviewOpen((v) => !v)}
                        title="Graph legend & overview"
                        className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                          overviewOpen
                            ? 'text-[#60A5FA] bg-[#151D2B]'
                            : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#151D2B]'
                        }`}
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* DESKTOP RIGHT INSPECTOR */}
              {inspectorOpen && (
                <div
                  className={`hidden lg:block lg:col-span-4 ${
                    isFullscreen ? 'h-[74vh]' : 'h-[640px]'
                  }`}
                >
                  <NodeInspectorSidebar {...inspectorProps} />
                </div>
              )}

              {/* MOBILE / TABLET SLIDE-IN INSPECTOR DRAWER */}
              <AnimatePresence>
                {mobileInspectorOpen && (
                  <div className="lg:hidden fixed inset-0 z-50 flex justify-end">
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      onClick={() => setMobileInspectorOpen(false)}
                      className="fixed inset-0 bg-[#080B12]/80"
                    />
                    <motion.div
                      initial={{ x: '100%' }}
                      animate={{ x: 0 }}
                      exit={{ x: '100%' }}
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      className="relative z-10 w-full max-w-md h-full p-3 bg-[#080B12]"
                    >
                      <NodeInspectorSidebar
                        {...inspectorProps}
                        onCloseMobile={() => setMobileInspectorOpen(false)}
                      />
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* BOTTOM BREADCRUMB & TELEMETRY BAR */}
        <div className="rounded-lg border border-[#202A3A] bg-[#0D111B] px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-[12px]">
          <div className="flex flex-wrap items-center gap-1.5 text-[#94A3B8]">
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
                  className={`hover:text-[#F1F5F9] transition-colors ${
                    level === b.level ? 'text-[#F1F5F9] font-medium' : ''
                  }`}
                >
                  {b.label}
                </button>
                {idx < breadcrumbs.length - 1 && (
                  <ChevronRight className="w-3 h-3 text-[#64748B]" />
                )}
              </span>
            ))}
            {selectedNode && (
              <>
                <ChevronRight className="w-3 h-3 text-[#64748B]" />
                <span className="font-mono text-[#60A5FA] truncate max-w-[240px]">
                  {selectedNode.name}
                </span>
              </>
            )}
            {multiSelectedIds.length > 1 && (
              <span className="ml-2 font-mono text-[#A78BFA]">
                ({multiSelectedIds.length} selected)
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 font-mono text-[11px] text-[#94A3B8] tabular-nums">
            <span>{visibleGraphNodes.length} nodes</span>
            <span className="text-[#202A3A]" aria-hidden="true">
              ·
            </span>
            <span>{computedFlow.flowEdges.length} edges</span>
            <span className="text-[#202A3A]" aria-hidden="true">
              ·
            </span>
            <span>
              {intelligence.complexityMetrics.functionCount +
                intelligence.complexityMetrics.methodCount}{' '}
              fn
            </span>
            <span className="text-[#202A3A]" aria-hidden="true">
              ·
            </span>
            <span>{intelligence.complexityMetrics.classCount} classes</span>
            <span className="text-[#202A3A]" aria-hidden="true">
              ·
            </span>
            <span
              className={
                intelligence.complexityMetrics.circularDependencyCount > 0
                  ? 'text-[#FB7185]'
                  : 'text-[#34D399]'
              }
            >
              {intelligence.complexityMetrics.circularDependencyCount} cycles
            </span>
          </div>
        </div>
      </motion.div>
    </MotionConfig>
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
