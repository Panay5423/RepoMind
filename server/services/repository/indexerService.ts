import { db, type StoredRepositoryFile } from '../../models/store.ts';
import type {
  BugFindingDTO,
  DependencyInfo,
  DirectoryNode,
  LanguageStat,
} from '../../../shared/types.ts';
import {
  buildDirectoryTree,
  buildLanguageStats,
  chunkFileContent,
  detectDependenciesAndFrameworks,
  detectLanguage,
  estimateFileComplexity,
  isImportantFilePath,
} from '../../utils/chunker.ts';
import { scanSecretsInText } from '../../utils/security.ts';
import { embedTexts } from '../ai/geminiClient.ts';
import type { RawRepoFile } from '../github/githubService.ts';

export interface IndexResult {
  storedFiles: StoredRepositoryFile[];
  languages: LanguageStat[];
  primaryLanguage: string;
  directoryTree: DirectoryNode[];
  dependencies: DependencyInfo[];
  frameworks: string[];
  staticFindings: Omit<BugFindingDTO, 'id' | 'repositoryId' | 'createdAt'>[];
  complexityIndicators: {
    averageFileLines: number;
    maxFileLines: number;
    highComplexityFiles: { path: string; lines: number; score: number }[];
    todoCount: number;
  };
  totalLines: number;
  totalBytes: number;
}

function runStaticPatternChecks(
  filePath: string,
  content: string
): Omit<BugFindingDTO, 'id' | 'repositoryId' | 'createdAt'>[] {
  const findings: Omit<BugFindingDTO, 'id' | 'repositoryId' | 'createdAt'>[] = [];
  const secrets = scanSecretsInText(content);
  for (const s of secrets) {
    findings.push({
      title: `Exposed ${s.ruleName} detected`,
      category: 'security',
      origin: 'verified_static_check',
      severity: 'critical',
      filePath,
      startLine: s.lineNumber,
      endLine: s.lineNumber,
      explanation: `Static pattern scanner matched a credential-like token (${s.preview}) on line ${s.lineNumber}. Credentials committed to source control can be extracted by anyone with repository access.`,
      suggestedFix: `Move this secret to an environment variable (e.g. process.env) and rotate the exposed credential immediately.`,
    });
  }

  const lines = content.split('\n');
  const checks: Array<{
    regex: RegExp;
    title: string;
    category: BugFindingDTO['category'];
    severity: BugFindingDTO['severity'];
    explanation: string;
    fix: string;
  }> = [
    {
      regex: /\beval\s*\(|new\s+Function\s*\(/,
      title: 'Dynamic code execution via eval/Function',
      category: 'security',
      severity: 'high',
      explanation: 'Dynamic code evaluation increases code-injection risk if user-controlled strings reach this call site.',
      fix: 'Replace dynamic evaluation with safe JSON parsing or structured dispatch tables.',
    },
    {
      regex: /dangerouslySetInnerHTML|innerHTML\s*=/,
      title: 'Direct HTML DOM injection sink',
      category: 'security',
      severity: 'medium',
      explanation: 'Writing raw HTML directly into the DOM can introduce Cross-Site Scripting (XSS) if inputs are not sanitized.',
      fix: 'Render structured JSX/templates or sanitize HTML strictly with DOMPurify before insertion.',
    },
    {
      regex: /child_process.*exec\s*\(/,
      title: 'Shell command execution with exec()',
      category: 'security',
      severity: 'medium',
      explanation: 'Invoking a subshell with exec() can lead to command injection when arguments include untrusted input.',
      fix: 'Prefer execFile() or spawn() with an explicit argument array and shell: false.',
    },
  ];

  // Skip running code-injection checks on RepoMind's own scanner files if analyzed
  if (!filePath.endsWith('security.ts') && !filePath.endsWith('indexerService.ts')) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const chk of checks) {
        if (chk.regex.test(line)) {
          findings.push({
            title: chk.title,
            category: chk.category,
            origin: 'verified_static_check',
            severity: chk.severity,
            filePath,
            startLine: i + 1,
            endLine: i + 1,
            explanation: `Static rule matched pattern on line ${i + 1}: ${chk.explanation}`,
            suggestedFix: chk.fix,
          });
        }
      }
    }
  }

  return findings;
}

export async function indexRepositoryFiles(
  repositoryId: string,
  rawFiles: RawRepoFile[],
  onProgress?: (progress: number, stage: string) => Promise<void>
): Promise<IndexResult> {
  if (onProgress) await onProgress(20, 'Parsing files & building directory tree');

  const prepared: Array<Omit<StoredRepositoryFile, 'id'>> = [];
  const staticFindings: Omit<BugFindingDTO, 'id' | 'repositoryId' | 'createdAt'>[] = [];
  let totalLines = 0;
  let totalBytes = 0;
  let totalTodos = 0;

  for (const raw of rawFiles) {
    const language = detectLanguage(raw.path);
    const { lines, complexityScore, todoCount } = estimateFileComplexity(raw.content);
    const isImportant = isImportantFilePath(raw.path);
    const chunks = chunkFileContent(raw.content);

    totalLines += lines;
    totalBytes += raw.size;
    totalTodos += todoCount;

    staticFindings.push(...runStaticPatternChecks(raw.path, raw.content));

    prepared.push({
      repositoryId,
      path: raw.path,
      language,
      size: raw.size,
      lines,
      complexityScore,
      isImportant,
      chunks,
    });
  }

  // Generate semantic embeddings for priority chunks (up to 60 chunks for fast responsive indexing)
  if (onProgress) await onProgress(38, 'Generating vector embeddings with Gemini');

  const chunkRefs: Array<{ fileIdx: number; chunkIdx: number; text: string }> = [];
  const sortedFileIndices = prepared
    .map((f, idx) => ({ idx, priority: (f.isImportant ? 100 : 0) + Math.min(50, f.lines / 10) }))
    .sort((a, b) => b.priority - a.priority)
    .map((x) => x.idx);

  for (const fIdx of sortedFileIndices) {
    const file = prepared[fIdx];
    for (let cIdx = 0; cIdx < Math.min(file.chunks.length, 3); cIdx++) {
      chunkRefs.push({
        fileIdx: fIdx,
        chunkIdx: cIdx,
        text: `File: ${file.path} (${file.language})\n${file.chunks[cIdx].content}`,
      });
      if (chunkRefs.length >= 60) break;
    }
    if (chunkRefs.length >= 60) break;
  }

  if (chunkRefs.length > 0 && process.env.GEMINI_API_KEY) {
    const vectors = await embedTexts(chunkRefs.map((r) => r.text));
    for (let i = 0; i < chunkRefs.length; i++) {
      const ref = chunkRefs[i];
      if (vectors[i]?.length) {
        prepared[ref.fileIdx].chunks[ref.chunkIdx].embedding = vectors[i];
      }
    }
  }

  const storedFiles = await db.replaceRepositoryFiles(repositoryId, prepared);

  const languages = buildLanguageStats(prepared);
  const primaryLanguage =
    languages.find((l) => !['JSON', 'Markdown', 'Config', 'Text', 'YAML'].includes(l.language))
      ?.language ||
    languages[0]?.language ||
    'Unknown';

  const directoryTree = buildDirectoryTree(
    prepared.map((f) => ({ path: f.path, size: f.size, language: f.language }))
  );

  const { dependencies, frameworks } = detectDependenciesAndFrameworks(
    rawFiles.map((r) => ({ path: r.path, content: r.content }))
  );

  // Check for unpinned dependencies as verified static indicator
  for (const dep of dependencies.slice(0, 40)) {
    if (dep.version === '*' || dep.version === 'latest') {
      staticFindings.push({
        title: `Unpinned dependency version: ${dep.name}`,
        category: 'dependency',
        origin: 'verified_static_check',
        severity: 'low',
        filePath: dep.ecosystem === 'npm' ? 'package.json' : 'requirements.txt',
        explanation: `Package "${dep.name}" uses an unpinned specifier ("${dep.version}"), which can lead to non-deterministic builds or unexpected breaking updates.`,
        suggestedFix: `Pin "${dep.name}" to a specific semver range or exact tested version.`,
      });
    }
  }

  const highComplexityFiles = prepared
    .filter((f) => !['JSON', 'Markdown', 'Text'].includes(f.language))
    .sort((a, b) => b.complexityScore - a.complexityScore)
    .slice(0, 6)
    .map((f) => ({ path: f.path, lines: f.lines, score: f.complexityScore }));

  const maxFileLines = prepared.reduce((max, f) => Math.max(max, f.lines), 0);
  const averageFileLines = prepared.length > 0 ? Math.round(totalLines / prepared.length) : 0;

  return {
    storedFiles,
    languages,
    primaryLanguage,
    directoryTree,
    dependencies,
    frameworks,
    staticFindings,
    complexityIndicators: {
      averageFileLines,
      maxFileLines,
      highComplexityFiles,
      todoCount: totalTodos,
    },
    totalLines,
    totalBytes,
  };
}
