import { ThinkingLevel, Type } from '@google/genai';
import { db } from '../../models/store.ts';
import type {
  AnalysisDTO,
  ArchitectureGraph,
  BugFindingDTO,
  HealthScoreReport,
} from '../../../shared/types.ts';
import { SYSTEM_SECURITY_PREAMBLE, wrapUntrustedCode } from '../../utils/security.ts';
import { formatGeminiError, generateJson } from './geminiClient.ts';
import { indexRepositoryFiles, type IndexResult } from '../repository/indexerService.ts';
import type { RawRepoFile } from '../github/githubService.ts';

interface GeminiCoreAnalysisPayload {
  projectOverview: string;
  architectureOverview: string;
  technologyStack: string[];
  importantFiles: Array<{ path: string; reason: string }>;
  importantModules: Array<{
    name: string;
    path: string;
    role: string;
    responsibilities: string[];
    complexity: 'low' | 'medium' | 'high';
  }>;
  architectureGraph: {
    nodes: Array<{
      id: string;
      label: string;
      layer: 'frontend' | 'backend' | 'api' | 'database' | 'service' | 'config';
      description: string;
      files: string[];
      responsibilities: string[];
    }>;
    edges: Array<{
      id: string;
      source: string;
      target: string;
      label: string;
      relationship: string;
    }>;
  };
  healthReport: {
    overallEstimate: number;
    breakdown: Array<{
      category:
        | 'Code Organization'
        | 'Maintainability'
        | 'Complexity'
        | 'Documentation'
        | 'Issue Risk'
        | 'Dependency Health';
      score: number;
      basis: string;
      recommendation: string;
    }>;
    prioritizedImprovements: string[];
  };
  potentialIssues: Array<{
    title: string;
    category: 'bug' | 'security' | 'duplication' | 'quality';
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    filePath: string;
    startLine?: number;
    endLine?: number;
    explanation: string;
    suggestedFix: string;
  }>;
}

const ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    projectOverview: { type: Type.STRING },
    architectureOverview: { type: Type.STRING },
    technologyStack: { type: Type.ARRAY, items: { type: Type.STRING } },
    importantFiles: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          path: { type: Type.STRING },
          reason: { type: Type.STRING },
        },
        required: ['path', 'reason'],
      },
    },
    importantModules: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          path: { type: Type.STRING },
          role: { type: Type.STRING },
          responsibilities: { type: Type.ARRAY, items: { type: Type.STRING } },
          complexity: { type: Type.STRING },
        },
        required: ['name', 'path', 'role', 'responsibilities', 'complexity'],
      },
    },
    architectureGraph: {
      type: Type.OBJECT,
      properties: {
        nodes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              label: { type: Type.STRING },
              layer: { type: Type.STRING },
              description: { type: Type.STRING },
              files: { type: Type.ARRAY, items: { type: Type.STRING } },
              responsibilities: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['id', 'label', 'layer', 'description', 'files', 'responsibilities'],
          },
        },
        edges: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              source: { type: Type.STRING },
              target: { type: Type.STRING },
              label: { type: Type.STRING },
              relationship: { type: Type.STRING },
            },
            required: ['id', 'source', 'target', 'label', 'relationship'],
          },
        },
      },
      required: ['nodes', 'edges'],
    },
    healthReport: {
      type: Type.OBJECT,
      properties: {
        overallEstimate: { type: Type.NUMBER },
        breakdown: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING },
              score: { type: Type.NUMBER },
              basis: { type: Type.STRING },
              recommendation: { type: Type.STRING },
            },
            required: ['category', 'score', 'basis', 'recommendation'],
          },
        },
        prioritizedImprovements: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['overallEstimate', 'breakdown', 'prioritizedImprovements'],
    },
    potentialIssues: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          category: { type: Type.STRING },
          severity: { type: Type.STRING },
          filePath: { type: Type.STRING },
          startLine: { type: Type.INTEGER },
          endLine: { type: Type.INTEGER },
          explanation: { type: Type.STRING },
          suggestedFix: { type: Type.STRING },
        },
        required: ['title', 'category', 'severity', 'filePath', 'explanation', 'suggestedFix'],
      },
    },
  },
  required: [
    'projectOverview',
    'architectureOverview',
    'technologyStack',
    'importantFiles',
    'importantModules',
    'architectureGraph',
    'healthReport',
    'potentialIssues',
  ],
};

function sanitizeGraph(
  graph: GeminiCoreAnalysisPayload['architectureGraph'],
  validPaths: Set<string>
): ArchitectureGraph {
  const validLayers = new Set(['frontend', 'backend', 'api', 'database', 'service', 'config']);
  const allPaths = Array.from(validPaths);

  const resolveFileRefs = (refs: string[]): string[] => {
    const out = new Set<string>();
    for (const raw of refs || []) {
      const cleaned = String(raw || '').replace(/^\/+/, '');
      if (!cleaned) continue;
      if (validPaths.has(cleaned)) {
        out.add(cleaned);
      } else {
        const prefixMatches = allPaths.filter((p) => p.startsWith(cleaned.endsWith('/') ? cleaned : `${cleaned}/`));
        for (const m of prefixMatches.slice(0, 6)) {
          out.add(m);
        }
      }
    }
    return Array.from(out).slice(0, 12);
  };

  const nodes = (graph?.nodes || []).slice(0, 14).map((n, i) => ({
    id: n.id || `node-${i + 1}`,
    label: n.label || `Module ${i + 1}`,
    layer: (validLayers.has(n.layer) ? n.layer : 'service') as ArchitectureGraph['nodes'][0]['layer'],
    description: n.description || '',
    files: resolveFileRefs(n.files || []),
    responsibilities: (n.responsibilities || []).slice(0, 5),
  }));

  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = (graph?.edges || [])
    .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target) && e.source !== e.target)
    .slice(0, 24)
    .map((e, i) => ({
      id: e.id || `edge-${i + 1}`,
      source: e.source,
      target: e.target,
      label: e.label || 'uses',
      relationship: e.relationship || e.label || 'dependency',
    }));

  return { nodes, edges };
}

function buildBaselineGraph(indexResult: IndexResult): ArchitectureGraph {
  const topDirs = new Map<string, string[]>();
  for (const f of indexResult.storedFiles) {
    const seg = f.path.includes('/') ? f.path.split('/')[0] : 'root';
    const list = topDirs.get(seg) || [];
    list.push(f.path);
    topDirs.set(seg, list);
  }
  const nodes = Array.from(topDirs.entries())
    .slice(0, 8)
    .map(([dir, files], idx) => {
      const lower = dir.toLowerCase();
      let layer: ArchitectureGraph['nodes'][0]['layer'] = 'service';
      if (/client|src|web|app|ui|pages|components/.test(lower)) layer = 'frontend';
      else if (/route|api|controller/.test(lower)) layer = 'api';
      else if (/server|backend/.test(lower)) layer = 'backend';
      else if (/model|db|prisma|schema/.test(lower)) layer = 'database';
      else if (/config|root/.test(lower)) layer = 'config';
      return {
        id: `dir-${idx + 1}`,
        label: dir === 'root' ? 'Project Root' : dir,
        layer,
        description: `Directory containing ${files.length} indexed source file(s).`,
        files: files.slice(0, 12),
        responsibilities: [`Contains ${files.slice(0, 3).join(', ')}`],
      };
    });
  return { nodes, edges: [] };
}

function buildSelectedContext(indexResult: IndexResult): string {
  const ranked = [...indexResult.storedFiles].sort((a, b) => {
    const score = (p: string, imp: boolean, lines: number) => {
      let s = imp ? 50 : 0;
      if (/readme/i.test(p)) s += 40;
      if (/package\.json|requirements\.txt|go\.mod|cargo\.toml/i.test(p)) s += 45;
      if (/server|app|main|index|routes|controller|model/i.test(p)) s += 25;
      s += Math.min(20, lines / 20);
      return s;
    };
    return score(b.path, b.isImportant, b.lines) - score(a.path, a.isImportant, a.lines);
  });

  const blocks: string[] = [];
  let budget = 26_000;
  for (const file of ranked.slice(0, 16)) {
    const firstChunk = file.chunks[0]?.content || '';
    const snippet = firstChunk.slice(0, 1900);
    const wrapped = wrapUntrustedCode(file.path, snippet);
    if (budget - wrapped.length < 0 && blocks.length >= 4) break;
    blocks.push(wrapped);
    budget -= wrapped.length;
  }
  return blocks.join('\n\n');
}

export async function runRepositoryAnalysisPipeline(
  repositoryId: string,
  rawFiles: RawRepoFile[]
): Promise<void> {
  const updateProgress = async (progress: number, progressStage: string, status = 'analyzing') => {
    await db.updateRepository(repositoryId, {
      status: status as 'indexing' | 'analyzing' | 'completed' | 'failed',
      progress,
      progressStage,
    });
  };

  try {
    await updateProgress(12, 'Parsing files & building directory tree', 'indexing');
    const indexResult = await indexRepositoryFiles(repositoryId, rawFiles, async (p, stage) => {
      await updateProgress(p, stage, 'indexing');
    });

    // Save deterministic baseline analysis & static bugs right away so workspace tabs work immediately
    await db.replaceBugReports(repositoryId, indexResult.staticFindings);
    await db.upsertAnalysis(repositoryId, {
      projectOverview: 'Indexing complete. Generating AI architectural summary...',
      architectureOverview: '',
      technologyStack: [indexResult.primaryLanguage, ...indexResult.frameworks].filter(Boolean),
      frameworks: indexResult.frameworks,
      importantFiles: indexResult.storedFiles
        .filter((f) => f.isImportant)
        .slice(0, 8)
        .map((f) => ({ path: f.path, reason: `${f.language} (${f.lines} lines)` })),
      importantModules: [],
      dependencies: indexResult.dependencies,
      complexityIndicators: indexResult.complexityIndicators,
      architectureGraph: buildBaselineGraph(indexResult),
      healthReport: {
        overallEstimate: 75,
        disclaimer:
          'Preliminary deterministic structure metrics. Full AI heuristic assessment is currently running.',
        breakdown: [],
        prioritizedImprovements: [],
      },
      directoryTree: indexResult.directoryTree,
    });

    await db.updateRepository(repositoryId, {
      languages: indexResult.languages,
      primaryLanguage: indexResult.primaryLanguage,
      fileCount: indexResult.storedFiles.length,
      totalLines: indexResult.totalLines,
      totalBytes: indexResult.totalBytes,
      status: 'analyzing',
      progress: 60,
      progressStage: 'Generating architectural map & health assessment with Gemini',
    });

    const validPaths = new Set(indexResult.storedFiles.map((f) => f.path));
    const manifestList = indexResult.storedFiles
      .slice(0, 160)
      .map((f) => `- ${f.path} (${f.language}, ${f.lines}L)`)
      .join('\n');

    const codeContext = buildSelectedContext(indexResult);
    const depSummary = indexResult.dependencies
      .slice(0, 35)
      .map((d) => `${d.name}@${d.version} (${d.category})`)
      .join(', ');

    const prompt = `Analyze this repository concisely based ONLY on the verified manifest and source excerpts below.

<repository_manifest total_files="${indexResult.storedFiles.length}" total_lines="${indexResult.totalLines}">
${manifestList}
</repository_manifest>

<detected_frameworks>${indexResult.frameworks.join(', ') || 'None'}</detected_frameworks>
<detected_dependencies>${depSummary || 'None'}</detected_dependencies>

<representative_source_files>
${codeContext}
</representative_source_files>

Return concise JSON matching the schema:
- projectOverview: 2 clear paragraphs describing what this repository does.
- architectureOverview: 1-2 paragraphs describing request/data flow and separation of concerns.
- technologyStack: list of observed languages, frameworks, and tools.
- importantFiles: 3-8 key paths strictly from <repository_manifest>.
- importantModules: 2-6 major modules with real paths, role, responsibilities, and complexity ('low'|'medium'|'high').
- architectureGraph: 3-10 nodes (layers: frontend, backend, api, database, service, config) and edges connecting them; node.files must only contain paths from <repository_manifest>.
- healthReport: explainable heuristic scores (0-100) for all 6 categories ("Code Organization", "Maintainability", "Complexity", "Documentation", "Issue Risk", "Dependency Health") + 3 prioritizedImprovements.
- potentialIssues: 1-6 potential issues grounded in <representative_source_files> with real filePath and line numbers when visible.`;

    const aiResult = await generateJson<GeminiCoreAnalysisPayload>({
      prompt,
      systemInstruction: `${SYSTEM_SECURITY_PREAMBLE}\nYou are a principal software architect performing concise, grounded codebase analysis.`,
      responseSchema: ANALYSIS_SCHEMA,
      thinkingLevel: ThinkingLevel.LOW,
      timeoutMs: 45_000,
    });

    await updateProgress(88, 'Finalizing architecture graph, bug findings & health report');

    const groundedImportantFiles = (aiResult.importantFiles || []).filter((f) =>
      validPaths.has(f.path)
    );

    const groundedModules = (aiResult.importantModules || []).map((m) => ({
      ...m,
      complexity: (['low', 'medium', 'high'].includes(m.complexity)
        ? m.complexity
        : 'medium') as 'low' | 'medium' | 'high',
    }));

    const sanitizedGraph = sanitizeGraph(aiResult.architectureGraph, validPaths);
    const finalGraph =
      sanitizedGraph.nodes.length > 0 ? sanitizedGraph : buildBaselineGraph(indexResult);

    const defaultCategories: HealthScoreReport['breakdown'][number]['category'][] = [
      'Code Organization',
      'Maintainability',
      'Complexity',
      'Documentation',
      'Issue Risk',
      'Dependency Health',
    ];
    const rawBreakdown = aiResult.healthReport?.breakdown || [];
    const breakdown = defaultCategories.map((cat) => {
      const found = rawBreakdown.find((b) => b.category === cat);
      return {
        category: cat,
        score: Math.max(10, Math.min(100, Math.round(found?.score ?? 74))),
        basis: found?.basis || 'Evaluated from indexed file layout and static complexity metrics.',
        recommendation:
          found?.recommendation || 'Continue keeping modules focused and well-documented.',
      };
    });

    const overallEstimate = Math.max(
      10,
      Math.min(
        100,
        Math.round(
          aiResult.healthReport?.overallEstimate ??
            breakdown.reduce((acc, b) => acc + b.score, 0) / breakdown.length
        )
      )
    );

    const healthReport: HealthScoreReport = {
      overallEstimate,
      disclaimer:
        'Explainable AI-assisted heuristic assessment derived from static complexity metrics, file structure, and sampled source code. It is not a substitute for automated test suites or formal security audits.',
      breakdown,
      prioritizedImprovements: (aiResult.healthReport?.prioritizedImprovements || []).slice(0, 6),
    };

    const analysisData: Omit<AnalysisDTO, 'id' | 'repositoryId' | 'createdAt'> = {
      projectOverview: aiResult.projectOverview || 'Repository analysis completed.',
      architectureOverview: aiResult.architectureOverview || '',
      technologyStack:
        aiResult.technologyStack?.length > 0
          ? aiResult.technologyStack
          : [indexResult.primaryLanguage, ...indexResult.frameworks].filter(Boolean),
      frameworks: indexResult.frameworks,
      importantFiles: groundedImportantFiles,
      importantModules: groundedModules,
      dependencies: indexResult.dependencies,
      complexityIndicators: indexResult.complexityIndicators,
      architectureGraph: finalGraph,
      healthReport,
      directoryTree: indexResult.directoryTree,
    };

    await db.upsertAnalysis(repositoryId, analysisData);

    const validCategories = new Set(['bug', 'security', 'duplication', 'quality', 'dependency']);
    const validSeverities = new Set(['critical', 'high', 'medium', 'low', 'info']);

    const aiFindings: Omit<BugFindingDTO, 'id' | 'repositoryId' | 'createdAt'>[] = (
      aiResult.potentialIssues || []
    )
      .filter((issue) => validPaths.has(issue.filePath))
      .map((issue) => ({
        title: issue.title,
        category: (validCategories.has(issue.category)
          ? issue.category
          : 'quality') as BugFindingDTO['category'],
        origin: 'ai_potential_issue',
        severity: (validSeverities.has(issue.severity)
          ? issue.severity
          : 'medium') as BugFindingDTO['severity'],
        filePath: issue.filePath,
        startLine: issue.startLine,
        endLine: issue.endLine,
        explanation: issue.explanation,
        suggestedFix: issue.suggestedFix,
      }));

    await db.replaceBugReports(repositoryId, [...indexResult.staticFindings, ...aiFindings]);

    await db.updateRepository(repositoryId, {
      status: 'completed',
      progress: 100,
      progressStage: 'Analysis complete',
      healthScore: overallEstimate,
      lastAnalyzedAt: new Date().toISOString(),
      errorMessage: undefined,
    });
  } catch (err) {
    console.error(`[RepoMind] Analysis failed for ${repositoryId}:`, err);
    await db.updateRepository(repositoryId, {
      status: 'failed',
      progress: 0,
      progressStage: 'Analysis failed',
      errorMessage: formatGeminiError(err),
    });
  }
}
