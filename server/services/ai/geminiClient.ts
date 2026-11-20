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

export async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient = /429|503|500|RESOURCE_EXHAUSTED|UNAVAILABLE|ECONNRESET|ETIMEDOUT/i.test(msg);
      if (!isTransient || attempt === maxAttempts) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 600 * Math.pow(2, attempt - 1)));
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

export async function generateText(params: {
  prompt: string;
  systemInstruction?: string;
  thinkingLevel?: ThinkingLevel;
}): Promise<string> {
  const ai = getGeminiClient();
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: params.prompt,
      config: {
        systemInstruction: params.systemInstruction,
        thinkingConfig: params.thinkingLevel
          ? { thinkingLevel: params.thinkingLevel }
          : undefined,
      },
    });
    return response.text || '';
  });
}

export async function generateJson<T>(params: {
  prompt: string;
  systemInstruction?: string;
  responseSchema: Record<string, unknown>;
  thinkingLevel?: ThinkingLevel;
}): Promise<T> {
  const ai = getGeminiClient();
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: params.prompt,
      config: {
        systemInstruction: params.systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: params.responseSchema as never,
        thinkingConfig: params.thinkingLevel
          ? { thinkingLevel: params.thinkingLevel }
          : undefined,
      },
    });
    const text = (response.text || '{}').trim();
    return JSON.parse(text) as T;
  });
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const ai = getGeminiClient();
  const vectors: number[][] = [];
  const batchSize = 12;

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize).map((t) => t.slice(0, 3000));
    try {
      const result = await withRetry(() =>
        ai.models.embedContent({
          model: 'gemini-embedding-2',
          contents: batch,
        })
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
