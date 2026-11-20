import path from 'path';
import type { DependencyInfo, DirectoryNode, LanguageStat } from '../../shared/types.ts';
import type { StoredFileChunk } from '../models/store.ts';

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.hg',
  '.svn',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.angular',
  'coverage',
  '.venv',
  'venv',
  '__pycache__',
  'target',
  'vendor',
  '.idea',
  '.vscode',
]);

const IGNORED_FILES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'Cargo.lock',
  'poetry.lock',
  '.DS_Store',
  'Thumbs.db',
]);

const TEXT_EXTENSIONS: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.mjs': 'JavaScript',
  '.cjs': 'JavaScript',
  '.py': 'Python',
  '.go': 'Go',
  '.rs': 'Rust',
  '.java': 'Java',
  '.kt': 'Kotlin',
  '.rb': 'Ruby',
  '.php': 'PHP',
  '.cs': 'C#',
  '.cpp': 'C++',
  '.cc': 'C++',
  '.c': 'C',
  '.h': 'C/C++',
  '.hpp': 'C++',
  '.swift': 'Swift',
  '.scala': 'Scala',
  '.sql': 'SQL',
  '.html': 'HTML',
  '.htm': 'HTML',
  '.css': 'CSS',
  '.scss': 'SCSS',
  '.sass': 'SCSS',
  '.less': 'CSS',
  '.json': 'JSON',
  '.yaml': 'YAML',
  '.yml': 'YAML',
  '.toml': 'TOML',
  '.xml': 'XML',
  '.md': 'Markdown',
  '.mdx': 'Markdown',
  '.sh': 'Shell',
  '.bash': 'Shell',
  '.zsh': 'Shell',
  '.ps1': 'PowerShell',
  '.vue': 'Vue',
  '.svelte': 'Svelte',
  '.prisma': 'Prisma',
  '.graphql': 'GraphQL',
  '.gql': 'GraphQL',
  '.env.example': 'Config',
};

const SPECIAL_FILENAMES: Record<string, string> = {
  dockerfile: 'Docker',
  makefile: 'Makefile',
  jenkinsfile: 'Groovy',
  '.gitignore': 'Config',
  '.dockerignore': 'Config',
  'readme': 'Markdown',
  'readme.md': 'Markdown',
};

export function isBinaryOrIgnored(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/').replace(/^\/+/, '');
  const parts = normalized.split('/');
  if (parts.some((p) => IGNORED_DIRS.has(p))) return true;
  const base = parts[parts.length - 1] || '';
  if (!base || IGNORED_FILES.has(base)) return true;
  if (base.endsWith('.min.js') || base.endsWith('.min.css') || base.endsWith('.map')) return true;

  const lower = base.toLowerCase();
  if (SPECIAL_FILENAMES[lower]) return false;
  if (lower.startsWith('.env') && !lower.includes('example')) return true; // skip real .env files for safety

  const ext = path.extname(lower);
  if (!ext) return false;
  return !TEXT_EXTENSIONS[ext];
}

export function isLikelyTextBuffer(buf: Buffer): boolean {
  const sample = buf.subarray(0, Math.min(buf.length, 4096));
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] === 0) return false;
  }
  return true;
}

export function detectLanguage(filePath: string): string {
  const base = path.basename(filePath).toLowerCase();
  if (SPECIAL_FILENAMES[base]) return SPECIAL_FILENAMES[base];
  const ext = path.extname(base);
  return TEXT_EXTENSIONS[ext] || 'Text';
}

export function isImportantFilePath(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  const base = path.basename(lower);
  const importantNames = new Set([
    'package.json',
    'tsconfig.json',
    'angular.json',
    'vite.config.ts',
    'vite.config.js',
    'next.config.js',
    'next.config.mjs',
    'requirements.txt',
    'pyproject.toml',
    'go.mod',
    'cargo.toml',
    'pom.xml',
    'dockerfile',
    'docker-compose.yml',
    'docker-compose.yaml',
    'readme.md',
    'server.ts',
    'server.js',
    'app.ts',
    'app.js',
    'main.ts',
    'main.tsx',
    'app.tsx',
    'index.ts',
    'index.js',
    'schema.prisma',
  ]);
  if (importantNames.has(base)) return true;
  if (
    lower.includes('/routes/') ||
    lower.includes('/controllers/') ||
    lower.includes('/models/') ||
    lower.includes('/middleware/') ||
    lower.includes('/services/') ||
    lower.includes('/config/')
  ) {
    return true;
  }
  return false;
}

export function estimateFileComplexity(content: string): {
  lines: number;
  complexityScore: number;
  todoCount: number;
} {
  const linesArr = content.split('\n');
  const lines = linesArr.length;
  const branchMatches = content.match(/\b(if|else|for|while|switch|case|catch|try|\?\s*:|&&|\|\|)\b/g);
  const branchCount = branchMatches ? branchMatches.length : 0;
  const todoMatches = content.match(/\b(TODO|FIXME|HACK|XXX|BUG)\b/g);
  const todoCount = todoMatches ? todoMatches.length : 0;
  const complexityScore = Math.min(100, Math.round(1 + branchCount * 1.4 + lines / 45));
  return { lines, complexityScore, todoCount };
}

export function chunkFileContent(
  content: string,
  maxLinesPerChunk = 100,
  overlap = 15
): StoredFileChunk[] {
  const lines = content.split('\n');
  const chunks: StoredFileChunk[] = [];
  if (lines.length === 0) return chunks;

  let start = 0;
  let chunkIndex = 0;
  while (start < lines.length && chunkIndex < 16) {
    const end = Math.min(lines.length, start + maxLinesPerChunk);
    const slice = lines
      .slice(start, end)
      .map((line, idx) => `${start + idx + 1}: ${line.slice(0, 350)}`)
      .join('\n');

    chunks.push({
      chunkIndex,
      startLine: start + 1,
      endLine: end,
      content: slice.slice(0, 5500),
    });

    if (end >= lines.length) break;
    start = Math.max(start + 1, end - overlap);
    chunkIndex++;
  }
  return chunks;
}

export function buildLanguageStats(
  files: Array<{ language: string; size: number; lines: number }>
): LanguageStat[] {
  const map = new Map<string, { files: number; bytes: number; lines: number }>();
  let totalBytes = 0;
  for (const f of files) {
    if (f.language === 'JSON' || f.language === 'Markdown' || f.language === 'Text' || f.language === 'Config') {
      // Still track them, or include all
    }
    const prev = map.get(f.language) || { files: 0, bytes: 0, lines: 0 };
    prev.files += 1;
    prev.bytes += f.size;
    prev.lines += f.lines;
    map.set(f.language, prev);
    totalBytes += f.size;
  }
  const stats: LanguageStat[] = [];
  for (const [language, v] of map.entries()) {
    stats.push({
      language,
      files: v.files,
      bytes: v.bytes,
      lines: v.lines,
      percentage: totalBytes > 0 ? Math.round((v.bytes / totalBytes) * 1000) / 10 : 0,
    });
  }
  return stats.sort((a, b) => b.bytes - a.bytes);
}

export function buildDirectoryTree(
  files: Array<{ path: string; size: number; language: string }>
): DirectoryNode[] {
  const root: DirectoryNode[] = [];

  for (const file of files) {
    const parts = file.path.split('/').filter(Boolean);
    let currentLevel = root;
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isLeaf = i === parts.length - 1;

      let node = currentLevel.find((n) => n.name === part && n.type === (isLeaf ? 'file' : 'directory'));
      if (!node) {
        node = isLeaf
          ? {
              name: part,
              path: currentPath,
              type: 'file',
              size: file.size,
              language: file.language,
            }
          : {
              name: part,
              path: currentPath,
              type: 'directory',
              children: [],
            };
        currentLevel.push(node);
      }
      if (!isLeaf && node.children) {
        currentLevel = node.children;
      }
    }
  }

  const sortNodes = (nodes: DirectoryNode[]): DirectoryNode[] => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const n of nodes) {
      if (n.children) sortNodes(n.children);
    }
    return nodes;
  };

  return sortNodes(root);
}

export function detectDependenciesAndFrameworks(
  rawFiles: Array<{ path: string; content: string }>
): { dependencies: DependencyInfo[]; frameworks: string[] } {
  const deps: DependencyInfo[] = [];
  const frameworks = new Set<string>();

  for (const file of rawFiles) {
    const base = path.basename(file.path).toLowerCase();
    if (base === 'package.json') {
      try {
        const pkg = JSON.parse(file.content) as {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        };
        const addNpm = (rec: Record<string, string> | undefined, isDev: boolean) => {
          if (!rec) return;
          for (const [name, version] of Object.entries(rec)) {
            let category: DependencyInfo['category'] = isDev ? 'dev' : 'runtime';
            if (/(react|next|vue|nuxt|angular|svelte|express|fastify|nestjs|koa|hono)/i.test(name)) {
              category = 'framework';
              frameworks.add(name);
            } else if (/(mongoose|prisma|typeorm|sequelize|pg|mysql|sqlite|mongodb|redis)/i.test(name)) {
              category = 'database';
            } else if (/(vite|webpack|typescript|tailwind|eslint|jest|vitest)/i.test(name)) {
              category = 'tooling';
            }
            deps.push({ name, version: String(version), category, ecosystem: 'npm' });
          }
        };
        addNpm(pkg.dependencies, false);
        addNpm(pkg.devDependencies, true);
      } catch {
        // ignore invalid package.json
      }
    } else if (base === 'requirements.txt') {
      for (const line of file.content.split('\n')) {
        const clean = line.split('#')[0].trim();
        if (!clean) continue;
        const [name, ver] = clean.split(/==|>=|<=|~=/);
        const pkgName = (name || '').trim();
        if (!pkgName) continue;
        if (/(fastapi|django|flask|tornado|starlette)/i.test(pkgName)) {
          frameworks.add(pkgName);
        }
        deps.push({
          name: pkgName,
          version: (ver || '*').trim(),
          category: /(fastapi|django|flask)/i.test(pkgName) ? 'framework' : 'runtime',
          ecosystem: 'PyPI',
        });
      }
    } else if (base === 'go.mod') {
      for (const line of file.content.split('\n')) {
        const m = line.trim().match(/^([^\s]+)\s+(v[^\s]+)/);
        if (m) {
          if (/gin|echo|fiber|chi/i.test(m[1])) frameworks.add(m[1]);
          deps.push({
            name: m[1],
            version: m[2],
            category: 'runtime',
            ecosystem: 'Go',
          });
        }
      }
    } else if (base === 'cargo.toml') {
      const inDeps = file.content.match(/\[dependencies\]([\s\S]*?)(\n\[|$)/);
      if (inDeps) {
        for (const line of inDeps[1].split('\n')) {
          const m = line.trim().match(/^([a-zA-Z0-9_-]+)\s*=\s*"([^"]+)"/);
          if (m) {
            if (/actix|axum|rocket|tokio/i.test(m[1])) frameworks.add(m[1]);
            deps.push({ name: m[1], version: m[2], category: 'runtime', ecosystem: 'Cargo' });
          }
        }
      }
    } else if (base === 'dockerfile') {
      frameworks.add('Docker');
    } else if (base === 'angular.json') {
      frameworks.add('Angular');
    } else if (base.startsWith('vite.config')) {
      frameworks.add('Vite');
    } else if (base.startsWith('next.config')) {
      frameworks.add('Next.js');
    }
  }

  return {
    dependencies: deps.slice(0, 80),
    frameworks: Array.from(frameworks),
  };
}
