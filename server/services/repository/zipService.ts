import AdmZip from 'adm-zip';
import path from 'path';
import os from 'os';
import { isBinaryOrIgnored, isImportantFilePath, isLikelyTextBuffer } from '../../utils/chunker.ts';
import { resolveSafeZipPath } from '../../utils/security.ts';
import type { RawRepoFile } from '../github/githubService.ts';

const MAX_EXTRACTED_FILES = 350;
const MAX_SINGLE_FILE_BYTES = 180_000;
const MAX_TOTAL_UNCOMPRESSED_BYTES = 20 * 1024 * 1024; // 20 MB source text cap

export function extractZipSafely(buffer: Buffer): RawRepoFile[] {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  const virtualRoot = path.join(os.tmpdir(), 'repomind-virtual-extract');

  const rawEntries: Array<{ path: string; buf: Buffer }> = [];
  let totalBytes = 0;

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    // Guard against path traversal (../, absolute paths, null bytes)
    const safeTarget = resolveSafeZipPath(virtualRoot, entry.entryName);
    if (!safeTarget) {
      throw new Error(`Unsafe archive entry path detected: ${entry.entryName}`);
    }

    const declaredSize = entry.header?.size || 0;
    if (declaredSize > 5 * 1024 * 1024) continue; // Skip huge individual assets

    const normalized = entry.entryName.replace(/\\/g, '/').replace(/^\/+/, '');
    if (isBinaryOrIgnored(normalized)) continue;

    const data = entry.getData();
    if (data.length > MAX_SINGLE_FILE_BYTES) continue;
    totalBytes += data.length;
    if (totalBytes > MAX_TOTAL_UNCOMPRESSED_BYTES) {
      throw new Error('ZIP uncompressed source code exceeds the 20 MB safety limit.');
    }

    if (!isLikelyTextBuffer(data)) continue;
    rawEntries.push({ path: normalized, buf: data });
  }

  if (rawEntries.length === 0) {
    throw new Error('No valid source code files found inside the uploaded ZIP archive.');
  }

  // Strip common top-level wrapper folder (e.g. "my-repo-main/src/index.ts" -> "src/index.ts")
  const firstSegments = new Set(
    rawEntries
      .filter((e) => e.path.includes('/'))
      .map((e) => e.path.split('/')[0])
  );
  const hasSingleRootFolder =
    firstSegments.size === 1 && rawEntries.every((e) => e.path.includes('/'));
  const rootPrefix = hasSingleRootFolder ? `${Array.from(firstSegments)[0]}/` : '';

  const files: RawRepoFile[] = rawEntries
    .map((e) => {
      const cleanPath = rootPrefix ? e.path.slice(rootPrefix.length) : e.path;
      return {
        path: cleanPath,
        content: e.buf.toString('utf8'),
        size: e.buf.length,
      };
    })
    .filter((f) => f.path.length > 0 && !isBinaryOrIgnored(f.path))
    .sort((a, b) => {
      const impA = isImportantFilePath(a.path) ? 1 : 0;
      const impB = isImportantFilePath(b.path) ? 1 : 0;
      if (impA !== impB) return impB - impA;
      return a.path.localeCompare(b.path);
    })
    .slice(0, MAX_EXTRACTED_FILES);

  if (files.length === 0) {
    throw new Error('No readable source code files remained after filtering ignored directories.');
  }

  return files;
}
