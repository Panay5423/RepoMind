export type RepoSourceType = 'github' | 'zip';
export type AnalysisStatus = 'pending' | 'indexing' | 'analyzing' | 'completed' | 'failed';

export type AuthProviderKind = 'local' | 'github' | 'hybrid';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  roleTitle?: string;
  authProvider: AuthProviderKind;
  hasPassword: boolean;
  githubConnected: boolean;
  githubUsername?: string;
  githubAvatarUrl?: string;
  lastLoginAt?: string;
  createdAt: string;
}

export interface DirectoryNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  language?: string;
  children?: DirectoryNode[];
}

export interface LanguageStat {
  language: string;
  files: number;
  bytes: number;
  lines: number;
  percentage: number;
}

export interface DependencyInfo {
  name: string;
  version: string;
  category: 'runtime' | 'dev' | 'framework' | 'database' | 'tooling';
  ecosystem: string;
}

export interface RepositoryDTO {
  id: string;
  userId: string;
  name: string;
  fullName: string;
  description: string;
  sourceType: RepoSourceType;
  githubUrl?: string;
  defaultBranch?: string;
  languages: LanguageStat[];
  primaryLanguage: string;
  fileCount: number;
  totalLines: number;
  totalBytes: number;
  status: AnalysisStatus;
  progress: number;
  progressStage: string;
  errorMessage?: string;
  healthScore?: number;
  lastAnalyzedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RepositoryFileDTO {
  id: string;
  repositoryId: string;
  path: string;
  language: string;
  size: number;
  lines: number;
  complexityScore: number;
  isImportant: boolean;
  summary?: string;
}

export interface ArchitectureNode {
  id: string;
  label: string;
  layer: 'frontend' | 'backend' | 'api' | 'database' | 'service' | 'config';
  description: string;
  files: string[];
  responsibilities: string[];
}

export interface ArchitectureEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  relationship: string;
}

export interface ArchitectureGraph {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
}

export interface ImportantModule {
  name: string;
  path: string;
  role: string;
  responsibilities: string[];
  complexity: 'low' | 'medium' | 'high';
}

export interface HealthSubScore {
  category: 'Code Organization' | 'Maintainability' | 'Complexity' | 'Documentation' | 'Issue Risk' | 'Dependency Health';
  score: number;
  basis: string;
  recommendation: string;
}

export interface HealthScoreReport {
  overallEstimate: number;
  disclaimer: string;
  breakdown: HealthSubScore[];
  prioritizedImprovements: string[];
}

export interface AnalysisDTO {
  id: string;
  repositoryId: string;
  projectOverview: string;
  architectureOverview: string;
  technologyStack: string[];
  frameworks: string[];
  importantFiles: { path: string; reason: string }[];
  importantModules: ImportantModule[];
  dependencies: DependencyInfo[];
  complexityIndicators: {
    averageFileLines: number;
    maxFileLines: number;
    highComplexityFiles: { path: string; lines: number; score: number }[];
    todoCount: number;
  };
  architectureGraph: ArchitectureGraph;
  healthReport: HealthScoreReport;
  directoryTree: DirectoryNode[];
  createdAt: string;
}

export interface CodeCitation {
  filePath: string;
  startLine?: number;
  endLine?: number;
  snippet?: string;
}

export interface MessageDTO {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  citations: CodeCitation[];
  suggestedFollowUps?: string[];
  createdAt: string;
}

export interface ConversationDTO {
  id: string;
  repositoryId: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
}

export type FindingOrigin = 'verified_static_check' | 'ai_potential_issue';
export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface BugFindingDTO {
  id: string;
  repositoryId: string;
  title: string;
  category: 'bug' | 'security' | 'duplication' | 'quality' | 'dependency';
  origin: FindingOrigin;
  severity: FindingSeverity;
  filePath: string;
  startLine?: number;
  endLine?: number;
  explanation: string;
  suggestedFix: string;
  createdAt: string;
}

export type DocType =
  | 'readme'
  | 'architecture'
  | 'api'
  | 'installation'
  | 'environment'
  | 'modules';

export interface DocumentationDTO {
  id: string;
  repositoryId: string;
  type: DocType;
  title: string;
  content: string;
  updatedAt: string;
  createdAt: string;
}

export type ChatMode = 'qa' | 'flow' | 'tests' | 'refactor';

export interface FileSearchMatch {
  filePath: string;
  language: string;
  lineNumber: number;
  lineText: string;
}

export interface DashboardOverviewDTO {
  totalRepositories: number;
  totalFilesIndexed: number;
  totalLinesIndexed: number;
  languagesDetected: { language: string; count: number }[];
  recentConversations: Array<ConversationDTO & { repositoryName: string }>;
  recentRepositories: RepositoryDTO[];
  averageHealthScore: number | null;
}

// ============================================================================
// Multi-Level Deterministic Architecture Intelligence Types
// ============================================================================

export type GraphLevel = 'system' | 'module' | 'file' | 'code';

export type GraphNodeKind =
  | 'application'
  | 'module'
  | 'component'
  | 'class'
  | 'function'
  | 'method'
  | 'object'
  | 'variable'
  | 'constant'
  | 'interface'
  | 'type'
  | 'api_endpoint'
  | 'controller'
  | 'service'
  | 'middleware'
  | 'database'
  | 'collection'
  | 'model'
  | 'route'
  | 'event'
  | 'socket'
  | 'external_dependency'
  | 'background_worker'
  | 'file';

export type GraphEdgeRelation =
  | 'IMPORTS'
  | 'EXPORTS'
  | 'CALLS'
  | 'USES'
  | 'EXTENDS'
  | 'IMPLEMENTS'
  | 'INSTANTIATES'
  | 'READS'
  | 'WRITES'
  | 'DEPENDS_ON'
  | 'TRIGGERS'
  | 'LISTENS_TO'
  | 'SENDS_DATA_TO'
  | 'RETURNS'
  | 'INJECTS'
  | 'QUERIES';

export type ArchitectureLayer =
  | 'frontend'
  | 'backend'
  | 'api'
  | 'database'
  | 'service'
  | 'worker'
  | 'realtime'
  | 'external'
  | 'shared'
  | 'config';

export interface GraphNodeDTO {
  id: string;
  name: string;
  kind: GraphNodeKind;
  level: GraphLevel;
  layer: ArchitectureLayer;
  filePath?: string;
  line?: number;
  endLine?: number;
  language?: string;
  folder?: string;
  moduleGroup?: string;
  description: string;
  isExternal?: boolean;
  parentId?: string;
  drillDownLevel?: GraphLevel;
  dependencies: string[];
  incomingCount: number;
  outgoingCount: number;
  usageCount: number;
  exported?: boolean;
  codePreview?: string;
  metadata?: {
    parameters?: Array<{ name: string; type?: string }>;
    returnType?: string;
    httpMethod?: string;
    routePath?: string;
    decorators?: string[];
    scope?: string;
    isHook?: boolean;
    isAsync?: boolean;
    properties?: string[];
    methods?: string[];
    extendsClass?: string;
    implementsInterfaces?: string[];
    fileCount?: number;
    lines?: number;
    childFiles?: string[];
  };
}

export interface GraphEdgeDTO {
  id: string;
  source: string;
  target: string;
  relation: GraphEdgeRelation;
  label: string;
  filePath?: string;
  line?: number;
  animated?: boolean;
  weight?: number;
  description?: string;
}

export interface LevelGraphDTO {
  level: GraphLevel;
  nodes: GraphNodeDTO[];
  edges: GraphEdgeDTO[];
  truncated?: boolean;
  totalNodesAvailable?: number;
}

export interface FunctionSymbolInfo {
  id: string;
  name: string;
  kind: 'function' | 'method' | 'hook';
  filePath: string;
  line: number;
  endLine: number;
  parameters: Array<{ name: string; type?: string }>;
  returnType?: string;
  calls: string[];
  calledBy: string[];
  variablesUsed: string[];
  dependencies: string[];
  exported: boolean;
  isAsync?: boolean;
  isHook?: boolean;
  className?: string;
}

export interface ClassSymbolInfo {
  id: string;
  name: string;
  filePath: string;
  line: number;
  endLine: number;
  properties: Array<{ name: string; type?: string; visibility?: string }>;
  constructorParams: Array<{ name: string; type?: string }>;
  methods: string[];
  extendsClass?: string;
  implementsInterfaces: string[];
  dependencies: string[];
  decorators: string[];
  exported: boolean;
}

export interface ObjectSymbolInfo {
  id: string;
  name: string;
  filePath: string;
  line: number;
  endLine: number;
  properties: string[];
  methods: string[];
  createdAt: { filePath: string; line: number };
  references: Array<{ filePath: string; line: number; context: string }>;
  exported: boolean;
}

export interface VariableSymbolInfo {
  id: string;
  name: string;
  kind: 'variable' | 'constant' | 'interface' | 'type' | 'enum';
  filePath: string;
  line: number;
  dataType?: string;
  scope: 'module' | 'function' | 'class' | 'block';
  exported: boolean;
  references: Array<{ filePath: string; line: number; access: 'read' | 'write' | 'type' }>;
}

export interface DataFlowStep {
  nodeId: string;
  name: string;
  kind: GraphNodeKind;
  layer: ArchitectureLayer;
  filePath?: string;
  line?: number;
  relationToNext?: GraphEdgeRelation;
  detail?: string;
}

export interface DataFlowChain {
  id: string;
  title: string;
  category:
    | 'express_api'
    | 'frontend_api'
    | 'angular_http'
    | 'database_rw'
    | 'websocket'
    | 'worker_job'
    | 'event';
  entryPoint: string;
  steps: DataFlowStep[];
  edgeIds: string[];
  nodeIds: string[];
}

export interface UnusedImportInfo {
  filePath: string;
  identifier: string;
  source: string;
  line: number;
}

export interface CoupledNodeInfo {
  nodeId: string;
  name: string;
  kind: GraphNodeKind;
  filePath?: string;
  inDegree: number;
  outDegree: number;
  totalDegree: number;
}

export interface ImpactReportDTO {
  nodeId: string;
  nodeName: string;
  nodeKind: GraphNodeKind;
  filePath?: string;
  directDependencies: Array<{ id: string; name: string; kind: GraphNodeKind; filePath?: string }>;
  transitiveDependencies: Array<{ id: string; name: string; kind: GraphNodeKind; filePath?: string }>;
  directDependents: Array<{ id: string; name: string; kind: GraphNodeKind; filePath?: string }>;
  transitiveDependents: Array<{ id: string; name: string; kind: GraphNodeKind; filePath?: string }>;
  affectedFiles: string[];
  affectedApisAndComponents: Array<{ id: string; name: string; kind: GraphNodeKind; filePath?: string }>;
  riskLevel: 'low' | 'medium' | 'high';
  note: string;
}

export interface ArchitectureComplexityMetrics {
  fileCount: number;
  functionCount: number;
  classCount: number;
  methodCount: number;
  objectCount: number;
  interfaceAndTypeCount: number;
  variableAndConstantCount: number;
  importCount: number;
  dependencyCount: number;
  circularDependencyCount: number;
  unusedImportCount: number;
  orphanedFileCount: number;
  endpointCount: number;
  socketEventCount: number;
  modelCount: number;
}

export interface ArchitectureIntelligenceDTO {
  repositoryId: string;
  repositoryName: string;
  generatedAt: string;
  levels: Record<GraphLevel, LevelGraphDTO>;
  symbols: {
    functions: FunctionSymbolInfo[];
    classes: ClassSymbolInfo[];
    objects: ObjectSymbolInfo[];
    variables: VariableSymbolInfo[];
  };
  dataFlows: DataFlowChain[];
  dependencyAnalysis: {
    circularDependencies: string[][];
    unusedImports: UnusedImportInfo[];
    orphanedFiles: string[];
    highlyCoupledNodes: CoupledNodeInfo[];
  };
  complexityMetrics: ArchitectureComplexityMetrics;
  cacheMeta: {
    reusedFilesCount: number;
    parsedFilesCount: number;
    parseErrors: Array<{ filePath: string; message: string }>;
    cached: boolean;
  };
}

