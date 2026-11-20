import { ThinkingLevel, Type } from '@google/genai';
import { db } from '../../models/store.ts';
import type { CodeCitation } from '../../../shared/types.ts';
import { SYSTEM_SECURITY_PREAMBLE, wrapUntrustedCode } from '../../utils/security.ts';
import { generateJson } from './geminiClient.ts';
import { retrieveRelevantChunks } from './ragService.ts';

interface ChatJsonResult {
  answerMarkdown: string;
  citations: Array<{
    filePath: string;
    startLine?: number;
    endLine?: number;
  }>;
  suggestedFollowUps: string[];
}

const CHAT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    answerMarkdown: {
      type: Type.STRING,
      description: 'Detailed Markdown answer citing exact file paths and line numbers observed in context.',
    },
    citations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          filePath: { type: Type.STRING },
          startLine: { type: Type.INTEGER },
          endLine: { type: Type.INTEGER },
        },
        required: ['filePath'],
      },
    },
    suggestedFollowUps: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: ['answerMarkdown', 'citations', 'suggestedFollowUps'],
};

export async function generateGroundedChatReply(params: {
  repositoryId: string;
  conversationId: string;
  userMessage: string;
}): Promise<{
  answerMarkdown: string;
  citations: CodeCitation[];
  suggestedFollowUps: string[];
}> {
  const { repositoryId, conversationId, userMessage } = params;

  const [repo, files, analysis, history] = await Promise.all([
    db.findRepositoryById(repositoryId),
    db.listRepositoryFiles(repositoryId),
    db.findAnalysisByRepo(repositoryId),
    db.listMessages(conversationId),
  ]);

  if (!repo) {
    throw new Error('Repository not found.');
  }

  const validPaths = new Set(files.map((f) => f.path));
  const retrieved = await retrieveRelevantChunks(files, userMessage, 10);

  const manifestSummary = files
    .slice(0, 200)
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
    .map((m) => `${m.role === 'user' ? 'Developer' : 'RepoMind'}: ${m.content.slice(0, 1200)}`)
    .join('\n\n');

  const prompt = `You are answering a developer's question about the repository "${repo.fullName}".

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

Instructions:
- Answer clearly using Markdown (headings, bullet points, fenced code blocks with language tags).
- Reference real file paths and line numbers (e.g., \`src/auth.ts:12-38\`) ONLY from <valid_file_paths> and <retrieved_code_chunks>.
- If the retrieved chunks do not contain enough evidence to answer a specific detail, state clearly what is visible and what file path in <valid_file_paths> would need further inspection. NEVER invent file paths, functions, or behavior.
- Populate "citations" with the exact filePath and line numbers you referenced.
- Provide 3 concise, relevant "suggestedFollowUps" questions specific to this codebase.`;

  const result = await generateJson<ChatJsonResult>({
    prompt,
    systemInstruction: `${SYSTEM_SECURITY_PREAMBLE}\nYou are RepoMind, an expert codebase intelligence assistant.`,
    responseSchema: CHAT_SCHEMA,
    thinkingLevel: ThinkingLevel.LOW,
  });

  const verifiedCitations: CodeCitation[] = [];
  const seen = new Set<string>();
  for (const c of result.citations || []) {
    if (!validPaths.has(c.filePath)) continue;
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

  return {
    answerMarkdown: result.answerMarkdown || 'Unable to generate a response.',
    citations: verifiedCitations,
    suggestedFollowUps: (result.suggestedFollowUps || []).slice(0, 3),
  };
}
