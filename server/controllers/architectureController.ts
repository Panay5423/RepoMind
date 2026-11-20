import type { Response } from 'express';
import { db } from '../models/store.ts';
import type { AuthenticatedRequest } from '../middleware/auth.ts';
import {
  buildArchitectureIntelligence,
  buildScopedCodeGraph,
  computeNodeImpact,
} from '../services/architecture/graphBuilderService.ts';

export async function getArchitectureIntelligence(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const repoId = String(req.params.id);
    const repo = await db.findRepositoryById(repoId);
    if (!repo || repo.userId !== req.user!.id) {
      res.status(404).json({ error: 'Repository not found.' });
      return;
    }

    const [files, analysis] = await Promise.all([
      db.listRepositoryFiles(repo.id),
      db.findAnalysisByRepo(repo.id),
    ]);

    if (files.length === 0) {
      res.status(400).json({ error: 'No indexed files available yet for architecture analysis.' });
      return;
    }

    const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
    const { intelligence } = buildArchitectureIntelligence({
      repositoryId: repo.id,
      repositoryName: repo.fullName,
      files,
      dependencies: analysis?.dependencies || [],
      frameworks: analysis?.frameworks || [],
      forceRefresh,
    });

    res.json({ intelligence });
  } catch (err) {
    console.error('[Architecture] Build failed:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Unable to build deterministic architecture graph.',
    });
  }
}

export async function getScopedCodeLevel(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const repoId = String(req.params.id);
    const repo = await db.findRepositoryById(repoId);
    if (!repo || repo.userId !== req.user!.id) {
      res.status(404).json({ error: 'Repository not found.' });
      return;
    }

    const [files, analysis] = await Promise.all([
      db.listRepositoryFiles(repo.id),
      db.findAnalysisByRepo(repo.id),
    ]);

    const filePath = req.query.filePath ? String(req.query.filePath) : undefined;
    const moduleGroup = req.query.moduleGroup ? String(req.query.moduleGroup) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 140;

    const { parsedFiles } = buildArchitectureIntelligence({
      repositoryId: repo.id,
      repositoryName: repo.fullName,
      files,
      dependencies: analysis?.dependencies || [],
      frameworks: analysis?.frameworks || [],
    });

    const graph = buildScopedCodeGraph(parsedFiles, { filePath, moduleGroup, limit });
    res.json({ graph });
  } catch (err) {
    console.error('[Architecture] Scoped code graph failed:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Unable to load scoped code architecture.',
    });
  }
}

export async function getNodeImpactReport(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const repoId = String(req.params.id);
    const nodeId = String(req.query.nodeId || '').trim();
    if (!nodeId) {
      res.status(400).json({ error: 'nodeId query parameter is required.' });
      return;
    }

    const repo = await db.findRepositoryById(repoId);
    if (!repo || repo.userId !== req.user!.id) {
      res.status(404).json({ error: 'Repository not found.' });
      return;
    }

    const [files, analysis] = await Promise.all([
      db.listRepositoryFiles(repo.id),
      db.findAnalysisByRepo(repo.id),
    ]);

    const { intelligence } = buildArchitectureIntelligence({
      repositoryId: repo.id,
      repositoryName: repo.fullName,
      files,
      dependencies: analysis?.dependencies || [],
      frameworks: analysis?.frameworks || [],
    });

    const impact = computeNodeImpact(intelligence, nodeId);
    if (!impact) {
      res.status(404).json({ error: 'Architecture node not found.' });
      return;
    }

    res.json({ impact });
  } catch (err) {
    console.error('[Architecture] Impact computation failed:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Unable to compute impact analysis.',
    });
  }
}
