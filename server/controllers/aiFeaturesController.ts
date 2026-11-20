import type { Response } from 'express';
import { db } from '../models/store.ts';
import type { AuthenticatedRequest } from '../middleware/auth.ts';
import type { DocType } from '../../shared/types.ts';
import { formatGeminiError } from '../services/ai/geminiClient.ts';
import { generateGroundedChatReply } from '../services/ai/chatService.ts';
import { runDeepBugInspection } from '../services/ai/bugService.ts';
import { generateRepositoryDocumentation } from '../services/ai/docService.ts';

export async function listConversations(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const repoId = String(req.params.id);
  const repo = await db.findRepositoryById(repoId);
  if (!repo || repo.userId !== req.user!.id) {
    res.status(404).json({ error: 'Repository not found.' });
    return;
  }
  const conversations = await db.listConversationsByRepo(repo.id, req.user!.id);
  res.json({ conversations });
}

export async function createConversation(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const repoId = String(req.params.id);
  const repo = await db.findRepositoryById(repoId);
  if (!repo || repo.userId !== req.user!.id) {
    res.status(404).json({ error: 'Repository not found.' });
    return;
  }
  const title = String(req.body?.title || `Chat · ${repo.name}`).slice(0, 100);
  const conversation = await db.createConversation({
    repositoryId: repo.id,
    userId: req.user!.id,
    title,
  });
  res.status(201).json({ conversation });
}

export async function listMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
  const convId = String(req.params.conversationId);
  const conv = await db.findConversationById(convId);
  if (!conv || conv.userId !== req.user!.id) {
    res.status(404).json({ error: 'Conversation not found.' });
    return;
  }
  const messages = await db.listMessages(conv.id);
  res.json({ messages });
}

export async function sendChatMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const convId = String(req.params.conversationId);
    const conv = await db.findConversationById(convId);
    if (!conv || conv.userId !== req.user!.id) {
      res.status(404).json({ error: 'Conversation not found.' });
      return;
    }

    const content = String(req.body?.content || '').trim();
    if (!content) {
      res.status(400).json({ error: 'Message content cannot be empty.' });
      return;
    }

    const userMsg = await db.createMessage({
      conversationId: conv.id,
      role: 'user',
      content,
      citations: [],
    });

    const aiReply = await generateGroundedChatReply({
      repositoryId: conv.repositoryId,
      conversationId: conv.id,
      userMessage: content,
    });

    const assistantMsg = await db.createMessage({
      conversationId: conv.id,
      role: 'assistant',
      content: aiReply.answerMarkdown,
      citations: aiReply.citations,
      suggestedFollowUps: aiReply.suggestedFollowUps,
    });

    res.status(201).json({ userMessage: userMsg, assistantMessage: assistantMsg });
  } catch (err) {
    console.error('[Chat] Error:', err);
    res.status(502).json({ error: formatGeminiError(err) });
  }
}

export async function getBugReports(req: AuthenticatedRequest, res: Response): Promise<void> {
  const repoId = String(req.params.id);
  const repo = await db.findRepositoryById(repoId);
  if (!repo || repo.userId !== req.user!.id) {
    res.status(404).json({ error: 'Repository not found.' });
    return;
  }
  const findings = await db.listBugReports(repo.id);
  res.json({ findings });
}

export async function runBugScan(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const repoId = String(req.params.id);
    const repo = await db.findRepositoryById(repoId);
    if (!repo || repo.userId !== req.user!.id) {
      res.status(404).json({ error: 'Repository not found.' });
      return;
    }
    const findings = await runDeepBugInspection(repo.id);
    res.json({ findings });
  } catch (err) {
    console.error('[BugScan] Error:', err);
    res.status(502).json({ error: formatGeminiError(err) });
  }
}

export async function listDocumentation(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const repoId = String(req.params.id);
  const repo = await db.findRepositoryById(repoId);
  if (!repo || repo.userId !== req.user!.id) {
    res.status(404).json({ error: 'Repository not found.' });
    return;
  }
  const docs = await db.listDocumentation(repo.id);
  res.json({ docs });
}

const VALID_DOC_TYPES = new Set<DocType>([
  'readme',
  'architecture',
  'api',
  'installation',
  'environment',
  'modules',
]);

export async function generateDoc(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const repoId = String(req.params.id);
    const repo = await db.findRepositoryById(repoId);
    if (!repo || repo.userId !== req.user!.id) {
      res.status(404).json({ error: 'Repository not found.' });
      return;
    }

    const type = String(req.body?.type || 'readme') as DocType;
    if (!VALID_DOC_TYPES.has(type)) {
      res.status(400).json({ error: 'Unsupported documentation type.' });
      return;
    }

    const doc = await generateRepositoryDocumentation(repo.id, type);
    res.json({ doc });
  } catch (err) {
    console.error('[Docs] Error:', err);
    res.status(502).json({ error: formatGeminiError(err) });
  }
}

export async function updateDoc(req: AuthenticatedRequest, res: Response): Promise<void> {
  const repoId = String(req.params.id);
  const type = String(req.params.type) as DocType;
  const repo = await db.findRepositoryById(repoId);
  if (!repo || repo.userId !== req.user!.id) {
    res.status(404).json({ error: 'Repository not found.' });
    return;
  }
  if (!VALID_DOC_TYPES.has(type)) {
    res.status(400).json({ error: 'Unsupported documentation type.' });
    return;
  }
  const title = String(req.body?.title || type).trim();
  const content = String(req.body?.content || '');
  const doc = await db.upsertDocumentation(repo.id, type, title, content);
  res.json({ doc });
}
