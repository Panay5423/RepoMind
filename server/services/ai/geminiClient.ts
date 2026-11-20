import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { env } from '../../config/env.ts';

let clientInstance: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY || env.geminiApiKey;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please add your Gemini API key in the Settings > Secrets panel.'
    );
  }
  if (!clientInstance) {
    clientInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return clientInstance;
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s.`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient = /429|503|500|RESOURCE_EXHAUSTED|UNAVAILABLE|ECONNRESET|ETIMEDOUT/i.test(
        msg
      );
      if (!isTransient || attempt === maxAttempts) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 700 * attempt));
    }
  }
  throw lastError;
}

export function formatGeminiError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/API_KEY_INVALID|400.*API key/i.test(msg)) {
    return 'Invalid Gemini API key. Please check your GEMINI_API_KEY in Settings > Secrets.';
  }
  if (/PERMISSION_DENIED|403/i.test(msg)) {
    return 'Gemini API permission denied. Please verify your GEMINI_API_KEY in Settings > Secrets.';
  }
  if (/RESOURCE_EXHAUSTED|429/i.test(msg)) {
    return 'Gemini API rate limit or quota exceeded. Please retry shortly or check your billing plan.';
  }
  return msg || 'Gemini AI request failed.';
}

export function parseJsonSafely<T>(rawText: string): T {
  let cleaned = rawText.trim();
  const fenceMatch = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const firstObj = cleaned.indexOf('{');
    const lastObj = cleaned.lastIndexOf('}');
    const firstArr = cleaned.indexOf('[');
    const lastArr = cleaned.lastIndexOf(']');
    if (firstArr !== -1 && (firstObj === -1 || firstArr < firstObj) && lastArr > firstArr) {
      return JSON.parse(cleaned.slice(firstArr, lastArr + 1)) as T;
    }
    if (firstObj !== -1 && lastObj > firstObj) {
      return JSON.parse(cleaned.slice(firstObj, lastObj + 1)) as T;
    }
    throw new Error('Model returned malformed JSON.');
  }
}

export async function generateText(params: {
  prompt: string;
  systemInstruction?: string;
  thinkingLevel?: ThinkingLevel;
  timeoutMs?: number;
}): Promise<string> {
  const ai = getGeminiClient();
  const timeoutMs = params.timeoutMs ?? 45_000;
  return withRetry(() =>
    withTimeout(
      ai.models
        .generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: params.prompt,
          config: {
            systemInstruction: params.systemInstruction,
            thinkingConfig: params.thinkingLevel
              ? { thinkingLevel: params.thinkingLevel }
              : undefined,
          },
        })
        .then((response) => response.text || ''),
      timeoutMs,
      'Gemini generation'
    )
  );
}

export async function generateJson<T>(params: {
  prompt: string;
  systemInstruction?: string;
  responseSchema: Record<string, unknown>;
  thinkingLevel?: ThinkingLevel;
  timeoutMs?: number;
}): Promise<T> {
  const ai = getGeminiClient();
  const timeoutMs = params.timeoutMs ?? 55_000;
  return withRetry(() =>
    withTimeout(
      ai.models
        .generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: params.prompt,
          config: {
            systemInstruction: params.systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: params.responseSchema as never,
            thinkingConfig: params.thinkingLevel
              ? { thinkingLevel: params.thinkingLevel }
              : undefined,
          },
        })
        .then((response) => parseJsonSafely<T>(response.text || '{}')),
      timeoutMs,
      'Gemini structured analysis'
    )
  );
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const ai = getGeminiClient();
  const vectors: number[][] = [];
  const batchSize = 15;

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize).map((t) => t.slice(0, 2600));
    try {
      const result = await withRetry(() =>
        withTimeout(
          ai.models.embedContent({
            model: 'gemini-embedding-2',
            contents: batch,
          }),
          15_000,
          'Gemini embedding batch'
        )
      );
      const embs = result.embeddings || [];
      for (let j = 0; j < batch.length; j++) {
        vectors.push(embs[j]?.values || []);
      }
    } catch (err) {
      console.warn(
        '[RepoMind] Embedding batch failed, continuing with lexical fallback:',
        err instanceof Error ? err.message : String(err)
      );
      for (let j = 0; j < batch.length; j++) {
        vectors.push([]);
      }
    }
  }
  return vectors;
}
