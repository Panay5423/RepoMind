import type { StoredRepositoryFile } from '../../models/store.ts';
import { embedTexts } from './geminiClient.ts';

export interface RetrievedChunk {
  filePath: string;
  language: string;
  startLine: number;
  endLine: number;
  content: string;
  score: number;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function lexicalScore(queryTokens: string[], filePath: string, content: string): number {
  const lowerPath = filePath.toLowerCase();
  const lowerContent = content.toLowerCase();
  let score = 0;
  for (const tok of queryTokens) {
    if (tok.length < 2) continue;
    if (lowerPath.includes(tok)) score += 0.35;
    let idx = lowerContent.indexOf(tok);
    let hits = 0;
    while (idx !== -1 && hits < 8) {
      hits++;
      idx = lowerContent.indexOf(tok, idx + tok.length);
    }
    score += Math.min(0.45, hits * 0.08);
  }
  return score;
}

export async function retrieveRelevantChunks(
  files: StoredRepositoryFile[],
  query: string,
  topK = 10
): Promise<RetrievedChunk[]> {
  let queryVec: number[] = [];
  const hasEmbeddings = files.some((f) => f.chunks.some((c) => (c.embedding?.length || 0) > 0));
  if (hasEmbeddings) {
    const [vec] = await embedTexts([query]);
    queryVec = vec || [];
  }

  const rawTokens = query
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[^a-z0-9_./-]+/g, ' ')
    .split(/[\s_/-]+/)
    .filter((t) => t.length >= 2);
  const queryTokens = Array.from(new Set(rawTokens));

  const scored: RetrievedChunk[] = [];
  for (const file of files) {
    for (const chunk of file.chunks) {
      const vecScore =
        queryVec.length > 0 && chunk.embedding?.length
          ? cosineSimilarity(queryVec, chunk.embedding)
          : 0;
      const lex = lexicalScore(queryTokens, file.path, chunk.content);
      const importanceBoost = file.isImportant ? 0.08 : 0;
      const combined = vecScore * 0.75 + lex * 0.45 + importanceBoost;

      scored.push({
        filePath: file.path,
        language: file.language,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        content: chunk.content,
        score: combined,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  // Deduplicate excessive chunks from the exact same file while keeping top matches
  const perFileCount = new Map<string, number>();
  const selected: RetrievedChunk[] = [];
  for (const item of scored) {
    const cnt = perFileCount.get(item.filePath) || 0;
    if (cnt >= 2 && selected.length >= topK / 2) continue;
    perFileCount.set(item.filePath, cnt + 1);
    selected.push(item);
    if (selected.length >= topK) break;
  }

  return selected;
}
