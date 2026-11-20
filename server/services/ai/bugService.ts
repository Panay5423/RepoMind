import { ThinkingLevel, Type } from '@google/genai';
import { db } from '../../models/store.ts';
import type { BugFindingDTO } from '../../../shared/types.ts';
import { SYSTEM_SECURITY_PREAMBLE, wrapUntrustedCode } from '../../utils/security.ts';
import { generateJson } from './geminiClient.ts';

interface BugScanPayload {
  findings: Array<{
    title: string;
    category: 'bug' | 'security' | 'duplication' | 'quality' | 'dependency';
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    filePath: string;
    startLine?: number;
    endLine?: number;
    explanation: string;
    suggestedFix: string;
  }>;
}

const BUG_SCAN_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    findings: {
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
  required: ['findings'],
};

export async function runDeepBugInspection(repositoryId: string): Promise<BugFindingDTO[]> {
  const [repo, files, existingFindings] = await Promise.all([
    db.findRepositoryById(repositoryId),
    db.listRepositoryFiles(repositoryId),
    db.listBugReports(repositoryId),
  ]);

  if (!repo) throw new Error('Repository not found.');

  const validPaths = new Set(files.map((f) => f.path));
  const preservedStatic = existingFindings
    .filter((f) => f.origin === 'verified_static_check')
    .map(({ id: _id, repositoryId: _rid, createdAt: _ca, ...rest }) => rest);

  // Focus on high-complexity and core source files
  const targetFiles = [...files]
    .filter((f) => !['JSON', 'Markdown', 'Text', 'Config'].includes(f.language))
    .sort((a, b) => b.complexityScore - a.complexityScore)
    .slice(0, 14);

  const excerpts = targetFiles
    .map((f) => wrapUntrustedCode(f.path, (f.chunks[0]?.content || '').slice(0, 2600)))
    .join('\n\n');

  const prompt = `Inspect the following source files from "${repo.fullName}" for potential bugs, error-handling gaps, race conditions, duplicated logic, security anti-patterns, and maintainability improvements.

<source_files>
${excerpts}
</source_files>

Rules:
- Only cite filePath values from the <untrusted_repository_file path="..."> tags above.
- Include accurate startLine and endLine numbers from the numbered lines.
- Be concrete and specific about what code triggers the potential issue and how to fix it.`;

  const res = await generateJson<BugScanPayload>({
    prompt,
    systemInstruction: `${SYSTEM_SECURITY_PREAMBLE}\nYou are a senior code reviewer performing deep static code inspection.`,
    responseSchema: BUG_SCAN_SCHEMA,
    thinkingLevel: ThinkingLevel.LOW,
  });

  const validCats = new Set(['bug', 'security', 'duplication', 'quality', 'dependency']);
  const validSevs = new Set(['critical', 'high', 'medium', 'low', 'info']);

  const aiFindings: Omit<BugFindingDTO, 'id' | 'repositoryId' | 'createdAt'>[] = (
    res.findings || []
  )
    .filter((f) => validPaths.has(f.filePath))
    .map((f) => ({
      title: f.title,
      category: (validCats.has(f.category) ? f.category : 'bug') as BugFindingDTO['category'],
      origin: 'ai_potential_issue',
      severity: (validSevs.has(f.severity) ? f.severity : 'medium') as BugFindingDTO['severity'],
      filePath: f.filePath,
      startLine: f.startLine,
      endLine: f.endLine,
      explanation: f.explanation,
      suggestedFix: f.suggestedFix,
    }));

  return db.replaceBugReports(repositoryId, [...preservedStatic, ...aiFindings]);
}
