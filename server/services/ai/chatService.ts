import { ThinkingLevel } from '@google/genai';
import { db } from '../../models/store.ts';
import type { ChatMode, CodeCitation } from '../../../shared/types.ts';
import { SYSTEM_SECURITY_PREAMBLE, wrapUntrustedCode } from '../../utils/security.ts';
import { generateText, parseJsonSafely } from './geminiClient.ts';
import { retrieveRelevantChunks } from './ragService.ts';

const MODE_INSTRUCTIONS: Record<ChatMode, string> = {
  qa: 'Provide a clear, thorough technical explanation grounded in the retrieved files and line numbers.',
  flow: 'Trace the end-to-end execution and data flow step-by-step across entrypoints, middleware, services, and persistence.',
  tests: 'Write concrete, runnable unit/integration test cases targeting the retrieved code, highlighting edge cases.',
  refactor: 'Propose concrete maintainability and architectural refactoring steps with before/after code snippets.',
};

function extractBlock(raw: string, tag: string): string | null {
  const match = raw.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i'));
  return match ? match[1].trim() : null;
}

export async function generateGroundedChatReply(params: {
  repositoryId: string;
  conversationId: string;
  userMessage: string;
  mode?: ChatMode;
}): Promise<{
  answerMarkdown: string;
  citations: CodeCitation[];
  suggestedFollowUps: string[];
}> {
  const { repositoryId, conversationId, userMessage, mode = 'qa' } = params;

  const [repo, files, analysis, history] = await Promise.all([
    db.findRepositoryById(repositoryId),
    db.listRepositoryFiles(repositoryId),
    db.findAnalysisByRepo(repositoryId),
    db.listMessages(conversationId),
  ]);

  if (!repo) {
    throw new Error('Repository not found.');
  }
  if (files.length === 0) {
    throw new Error('Repository files are still being indexed. Please try again in a few seconds.');
  }

  const validPaths = new Set(files.map((f) => f.path));
  const retrieved = await retrieveRelevantChunks(files, userMessage, 10);

  const manifestSummary = files
    .slice(0, 180)
    .map((f) => f.path)
    .join('\n');

  const retrievedContext = retrieved
    .map(
      (c) =>
        `<file_chunk path="${c.filePath}" lines="${c.startLine}-${c.endLine}">\n${wrapUntrustedCode(
          c.filePath,
          c.content
        )}\n</file_chunk>`
    )
    .join('\n\n');

  const recentHistory = history
    .slice(-8)
    .map((m) => `${m.role === 'user' ? 'Developer' : 'RepoMind'}: ${m.content.slice(0, 1000)}`)
    .join('\n\n');

  const prompt = `You are answering a developer's question about the repository "${repo.fullName}".
Requested analysis mode: ${mode.toUpperCase()} — ${MODE_INSTRUCTIONS[mode]}

<repository_summary>
Overview: ${analysis?.projectOverview || repo.description || 'Indexed repository'}
Stack: ${(analysis?.technologyStack || [repo.primaryLanguage]).join(', ')}
</repository_summary>

<valid_file_paths>
${manifestSummary}
</valid_file_paths>

<retrieved_code_chunks>
${retrievedContext}
</retrieved_code_chunks>

<conversation_history>
${recentHistory || 'No prior messages.'}
</conversation_history>

<developer_question>
${userMessage}
</developer_question>

Format your response using these EXACT XML wrapper tags (no markdown fences around the tags):

<answer>
Write your full Markdown answer here (headings, lists, fenced code blocks with language tags). Cite exact file paths and line numbers (e.g. \`src/auth.ts:12-38\`) ONLY from <valid_file_paths> and <retrieved_code_chunks>. Never invent file paths or behavior.
</answer>

<citations>
[{"filePath":"exact/path/from/manifest","startLine":1,"endLine":20}]
</citations>

<followups>
["Relevant follow-up question 1","Relevant follow-up question 2","Relevant follow-up question 3"]
</followups>`;

  const rawText = await generateText({
    prompt,
    systemInstruction: `${SYSTEM_SECURITY_PREAMBLE}\nYou are RepoMind, an expert codebase intelligence assistant.`,
    thinkingLevel: ThinkingLevel.LOW,
    timeoutMs: 30_000,
  });

  const answerBlock = extractBlock(rawText, 'answer') || rawText.trim();
  const citationsRaw = extractBlock(rawText, 'citations');
  const followupsRaw = extractBlock(rawText, 'followups');

  let parsedCitations: Array<{ filePath: string; startLine?: number; endLine?: number }> = [];
  if (citationsRaw) {
    try {
      parsedCitations = parseJsonSafely(citationsRaw);
    } catch {
      parsedCitations = [];
    }
  }

  // Also detect backticked paths referenced in the Markdown answer itself
  for (const pathCandidate of validPaths) {
    if (answerBlock.includes(pathCandidate) && !parsedCitations.some((c) => c.filePath === pathCandidate)) {
      const match = retrieved.find((r) => r.filePath === pathCandidate);
      parsedCitations.push({
        filePath: pathCandidate,
        startLine: match?.startLine,
        endLine: match?.endLine,
      });
    }
  }

  const verifiedCitations: CodeCitation[] = [];
  const seen = new Set<string>();
  for (const c of parsedCitations) {
    if (!c?.filePath || !validPaths.has(c.filePath)) continue;
    const key = `${c.filePath}:${c.startLine || 0}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const matchingChunk = retrieved.find((r) => r.filePath === c.filePath);
    verifiedCitations.push({
      filePath: c.filePath,
      startLine: c.startLine ?? matchingChunk?.startLine,
      endLine: c.endLine ?? matchingChunk?.endLine,
    });
  }

  let followUps: string[] = [];
  if (followupsRaw) {
    try {
      const parsed = parseJsonSafely<string[]>(followupsRaw);
      if (Array.isArray(parsed)) followUps = parsed.filter((x) => typeof x === 'string');
    } catch {
      followUps = [];
    }
  }

  return {
    answerMarkdown: answerBlock || 'Unable to generate a response.',
    citations: verifiedCitations.slice(0, 8),
    suggestedFollowUps: followUps.slice(0, 3),
  };
}
