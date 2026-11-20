export type RepoSourceType = 'github' | 'zip';
export type AnalysisStatus = 'pending' | 'indexing' | 'analyzing' | 'completed' | 'failed';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  githubConnected: boolean;
  githubUsername?: string;
  githubAvatarUrl?: string;
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

export interface DashboardOverviewDTO {
  totalRepositories: number;
  totalFilesIndexed: number;
  totalLinesIndexed: number;
  languagesDetected: { language: string; count: number }[];
  recentConversations: Array<ConversationDTO & { repositoryName: string }>;
  recentRepositories: RepositoryDTO[];
  averageHealthScore: number | null;
}
