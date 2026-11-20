import { ThinkingLevel } from '@google/genai';
import { db } from '../../models/store.ts';
import type { DocType, DocumentationDTO } from '../../../shared/types.ts';
import { SYSTEM_SECURITY_PREAMBLE, wrapUntrustedCode } from '../../utils/security.ts';
import { generateText } from './geminiClient.ts';
import { retrieveRelevantChunks } from './ragService.ts';

const DOC_TITLES: Record<DocType, string> = {
  readme: 'README.md',
  architecture: 'Architecture Guide',
  api: 'API Reference',
  installation: 'Installation Guide',
  environment: 'Environment Setup Guide',
  modules: 'Module Documentation',
};

const DOC_PROMPTS: Record<DocType, string> = {
  readme:
    'Generate a thorough, production-grade README.md covering project purpose, tech stack, folder layout, setup steps, and key capabilities based only on observed files.',
  architecture:
    'Generate detailed Architecture Documentation describing system layers, request lifecycle, data models, external integrations, and module boundaries.',
  api:
    'Generate API Documentation listing endpoints, HTTP methods, authentication requirements, request parameters, and response shapes observed in the route/controller files.',
  installation:
    'Generate a step-by-step Installation & Local Development Guide based on the actual package managers, scripts, and runtime files in the repository.',
  environment:
    'Generate an Environment Configuration Guide listing every environment variable referenced in the codebase, its purpose, and safe example values (never expose real secrets).',
  modules:
    'Generate comprehensive Module Documentation detailing each major directory and core file, its exported interfaces/responsibilities, and cross-module dependencies.',
};

export async function generateRepositoryDocumentation(
  repositoryId: string,
  type: DocType
): Promise<DocumentationDTO> {
  const [repo, files, analysis] = await Promise.all([
    db.findRepositoryById(repositoryId),
    db.listRepositoryFiles(repositoryId),
    db.findAnalysisByRepo(repositoryId),
  ]);

  if (!repo) throw new Error('Repository not found.');

  const queryHint = `${type} ${DOC_TITLES[type]} routes config env install package scripts`;
  const relevant = await retrieveRelevantChunks(files, queryHint, 12);

  const fileManifest = files
    .slice(0, 160)
    .map((f) => `- ${f.path} (${f.language}, ${f.lines} lines)`)
    .join('\n');

  const excerpts = relevant
    .map((c) => wrapUntrustedCode(c.filePath, c.content.slice(0, 2200)))
    .join('\n\n');

  const deps = (analysis?.dependencies || [])
    .slice(0, 35)
    .map((d) => `${d.name}@${d.version}`)
    .join(', ');

  const prompt = `${DOC_PROMPTS[type]}

Repository: ${repo.fullName}
Primary Language: ${repo.primaryLanguage}
Detected Frameworks: ${(analysis?.frameworks || []).join(', ') || 'N/A'}
Dependencies: ${deps || 'N/A'}

<architecture_summary>
${analysis?.projectOverview || ''}
${analysis?.architectureOverview || ''}
</architecture_summary>

<file_manifest>
${fileManifest}
</file_manifest>

<source_excerpts>
${excerpts}
</source_excerpts>

Output clean, ready-to-save Markdown only (no wrapping backticks around the entire document). Reference only real file paths, scripts, and symbols present in the repository.`;

  const markdown = await generateText({
    prompt,
    systemInstruction: `${SYSTEM_SECURITY_PREAMBLE}\nYou are a staff technical writer producing accurate, developer-ready Markdown documentation.`,
    thinkingLevel: ThinkingLevel.LOW,
  });

  return db.upsertDocumentation(repositoryId, type, DOC_TITLES[type], markdown.trim());
}
