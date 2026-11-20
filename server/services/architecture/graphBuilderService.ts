import path from 'path';
import type {
  ArchitectureEdge,
  ArchitectureGraph,
  ArchitectureIntelligenceDTO,
  ArchitectureLayer,
  ArchitectureNode,
  ClassSymbolInfo,
  CoupledNodeInfo,
  DataFlowChain,
  DataFlowStep,
  DependencyInfo,
  FunctionSymbolInfo,
  GraphEdgeDTO,
  GraphEdgeRelation,
  GraphLevel,
  GraphNodeDTO,
  GraphNodeKind,
  ImpactReportDTO,
  LevelGraphDTO,
  ObjectSymbolInfo,
  UnusedImportInfo,
  VariableSymbolInfo,
} from '../../../shared/types.ts';
import type { StoredRepositoryFile } from '../../models/store.ts';
import {
  clearAstCacheForRepo,
  parseRepositoryFilesWithCache,
  type FileAstSummary,
} from './astParserService.ts';

interface RepoArchitectureCacheEntry {
  combinedHash: string;
  intelligence: ArchitectureIntelligenceDTO;
  parsedFiles: FileAstSummary[];
}

const repoArchitectureCache = new Map<string, RepoArchitectureCacheEntry>();

export function invalidateArchitectureCache(repositoryId: string): void {
  repoArchitectureCache.delete(repositoryId);
  clearAstCacheForRepo(repositoryId);
}

const NODE_BUILTINS = new Set([
  'fs',
  'path',
  'crypto',
  'http',
  'https',
  'url',
  'util',
  'os',
  'stream',
  'events',
  'buffer',
  'child_process',
  'cluster',
  'net',
  'tls',
  'dns',
  'zlib',
  'readline',
  'assert',
  'querystring',
]);

function resolveLocalImport(
  fromPath: string,
  specifier: string,
  validPaths: Set<string>
): string | null {
  if (!specifier) return null;
  let candidateBase: string | null = null;

  if (specifier.startsWith('.')) {
    const dir = path.posix.dirname(fromPath);
    candidateBase = path.posix.normalize(path.posix.join(dir, specifier));
  } else if (specifier.startsWith('@/')) {
    candidateBase = specifier.slice(2);
  } else if (specifier.startsWith('~/')) {
    candidateBase = specifier.slice(2);
  } else if (specifier.startsWith('src/') || specifier.startsWith('server/') || specifier.startsWith('shared/')) {
    candidateBase = specifier;
  }

  if (!candidateBase) return null;

  const normalizedCandidates = [candidateBase];
  if (candidateBase.endsWith('.js') || candidateBase.endsWith('.jsx')) {
    normalizedCandidates.push(candidateBase.replace(/\.js$/, '.ts'));
    normalizedCandidates.push(candidateBase.replace(/\.jsx$/, '.tsx'));
    normalizedCandidates.push(candidateBase.replace(/\.js$/, '.tsx'));
  }

  const exts = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py'];
  for (const base of normalizedCandidates) {
    for (const ext of exts) {
      const full = `${base}${ext}`;
      if (validPaths.has(full)) return full;
    }
    for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
      const idx = path.posix.join(base, `index${ext}`);
      if (validPaths.has(idx)) return idx;
    }
  }
  return null;
}

function normalizePackageName(specifier: string): string {
  const clean = specifier.replace(/^node:/, '');
  if (clean.startsWith('@')) {
    const parts = clean.split('/');
    return parts.slice(0, 2).join('/');
  }
  return clean.split('/')[0];
}

function classifyFileRole(file: FileAstSummary): {
  kind: GraphNodeKind;
  layer: ArchitectureLayer;
  moduleGroup: string;
} {
  const lower = file.filePath.toLowerCase();
  const base = path.posix.basename(lower);
  const dirs = lower.split('/').filter(Boolean);
  const firstDir = dirs.length > 1 ? dirs[0] : 'root';
  const secondDir = dirs.length > 2 ? dirs[1] : firstDir;

  const isAngularComponent = file.decoratorsUsed.some((d) => /Component|Directive|Pipe/i.test(d));
  const isAngularModule = file.decoratorsUsed.some((d) => /NgModule/i.test(d));
  const isAngularService = file.decoratorsUsed.some((d) => /Injectable/i.test(d));
  const isNestController = file.decoratorsUsed.some((d) => /Controller/i.test(d));
  const isReactComponent =
    lower.endsWith('.tsx') ||
    lower.endsWith('.jsx') ||
    file.imports.some((i) => i.source === 'react' || i.source === 'react-dom');

  if (file.workers.length > 0 || /worker|queue|cron|job/.test(lower)) {
    return { kind: 'background_worker', layer: 'worker', moduleGroup: secondDir || 'workers' };
  }
  if (file.socketEvents.length > 0 || /socket|realtime|ws/.test(lower)) {
    return { kind: 'socket', layer: 'realtime', moduleGroup: secondDir || 'realtime' };
  }
  if (isNestController || /controller/.test(lower)) {
    return { kind: 'controller', layer: 'api', moduleGroup: secondDir || 'controllers' };
  }
  if (file.endpoints.length > 0 || /routes?|router|endpoints?/.test(lower)) {
    return { kind: 'route', layer: 'api', moduleGroup: secondDir || 'routes' };
  }
  if (/middleware|guard|interceptor/.test(lower)) {
    return { kind: 'middleware', layer: 'api', moduleGroup: secondDir || 'middleware' };
  }
  if (file.dbModels.length > 0 || /models?|schema|entities|prisma/.test(lower) || lower.endsWith('.sql')) {
    return { kind: 'model', layer: 'database', moduleGroup: secondDir || 'models' };
  }
  if (isAngularModule || base.endsWith('.module.ts')) {
    return { kind: 'module', layer: 'frontend', moduleGroup: secondDir || 'modules' };
  }
  if (isAngularComponent || (isReactComponent && /component|page|view|layout|widget|modal|tab/.test(lower))) {
    return { kind: 'component', layer: 'frontend', moduleGroup: secondDir || 'components' };
  }
  if (isReactComponent) {
    return { kind: 'component', layer: 'frontend', moduleGroup: secondDir || 'src' };
  }
  if (isAngularService || /service|repository|store|client|api\.ts/.test(lower)) {
    const isFrontend = lower.startsWith('src/') || lower.includes('/app/') || isAngularService;
    return {
      kind: 'service',
      layer: isFrontend && !lower.startsWith('server/') ? 'frontend' : 'service',
      moduleGroup: secondDir || 'services',
    };
  }
  if (/server\.|app\.|main\.|index\./.test(base) && !lower.startsWith('src/components')) {
    const isFrontend = lower.startsWith('src/') || lower.startsWith('client/') || lower.startsWith('frontend/');
    return {
      kind: 'application',
      layer: isFrontend ? 'frontend' : 'backend',
      moduleGroup: firstDir === 'root' ? 'entrypoint' : firstDir,
    };
  }
  if (/config|env|\.json$|\.yml$|\.yaml$|vite\.config|tsconfig/.test(lower)) {
    return { kind: 'file', layer: 'config', moduleGroup: 'config' };
  }
  if (/shared|types|utils|helpers|lib/.test(lower)) {
    return { kind: 'module', layer: 'shared', moduleGroup: secondDir || 'shared' };
  }
  if (lower.startsWith('server/') || lower.startsWith('backend/') || lower.startsWith('api/')) {
    return { kind: 'file', layer: 'backend', moduleGroup: secondDir || 'backend' };
  }
  if (lower.startsWith('src/') || lower.startsWith('client/') || lower.startsWith('frontend/')) {
    return { kind: 'file', layer: 'frontend', moduleGroup: secondDir || 'src' };
  }
  return { kind: 'file', layer: 'shared', moduleGroup: firstDir || 'root' };
}

function getPreview(content: string, startLine = 1, count = 14): string {
  const lines = content.split('\n');
  const startIdx = Math.max(0, startLine - 1);
  return lines
    .slice(startIdx, startIdx + count)
    .map((l, idx) => `${startIdx + idx + 1}: ${l}`)
    .join('\n');
}

function computeCircularDependencies(adjacency: Map<string, Set<string>>): string[][] {
  let index = 0;
  const indices = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const cycles: string[][] = [];

  const strongConnect = (v: string) => {
    indices.set(v, index);
    lowlink.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);

    for (const w of adjacency.get(v) || []) {
      if (!indices.has(w)) {
        strongConnect(w);
        lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v)!, indices.get(w)!));
      }
    }

    if (lowlink.get(v) === indices.get(v)) {
      const scc: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        scc.push(w);
      } while (w !== v);

      if (scc.length > 1) {
        cycles.push(scc.reverse());
      } else if (adjacency.get(v)?.has(v)) {
        cycles.push([v, v]);
      }
    }
  };

  for (const node of adjacency.keys()) {
    if (!indices.has(node)) {
      strongConnect(node);
    }
  }
  return cycles.slice(0, 30);
}

function finalizeNodeDegrees(nodes: GraphNodeDTO[], edges: GraphEdgeDTO[]): void {
  const inMap = new Map<string, number>();
  const outMap = new Map<string, number>();
  const depsMap = new Map<string, Set<string>>();

  for (const e of edges) {
    outMap.set(e.source, (outMap.get(e.source) || 0) + 1);
    inMap.set(e.target, (inMap.get(e.target) || 0) + 1);
    const set = depsMap.get(e.source) || new Set<string>();
    set.add(e.target);
    depsMap.set(e.source, set);
  }

  for (const n of nodes) {
    n.incomingCount = inMap.get(n.id) || 0;
    n.outgoingCount = outMap.get(n.id) || 0;
    n.usageCount = n.incomingCount + n.outgoingCount;
    n.dependencies = Array.from(depsMap.get(n.id) || []);
  }
}

function dedupeEdges(edges: GraphEdgeDTO[]): GraphEdgeDTO[] {
  const seen = new Map<string, GraphEdgeDTO>();
  for (const e of edges) {
    if (e.source === e.target) continue;
    const key = `${e.source}->${e.target}::${e.relation}`;
    const existing = seen.get(key);
    if (existing) {
      existing.weight = (existing.weight || 1) + 1;
    } else {
      seen.set(key, { ...e, weight: e.weight || 1 });
    }
  }
  return Array.from(seen.values());
}

export function computeNodeImpact(
  intelligence: ArchitectureIntelligenceDTO,
  nodeId: string
): ImpactReportDTO | null {
  const allNodes = [
    ...intelligence.levels.system.nodes,
    ...intelligence.levels.module.nodes,
    ...intelligence.levels.file.nodes,
    ...intelligence.levels.code.nodes,
  ];
  const nodeMap = new Map<string, GraphNodeDTO>();
  for (const n of allNodes) {
    if (!nodeMap.has(n.id)) nodeMap.set(n.id, n);
  }

  const target = nodeMap.get(nodeId);
  if (!target) return null;

  // Compute impact within the same level graph edges
  const levelEdges = intelligence.levels[target.level].edges;
  const outAdj = new Map<string, Set<string>>();
  const inAdj = new Map<string, Set<string>>();

  for (const e of levelEdges) {
    const o = outAdj.get(e.source) || new Set<string>();
    o.add(e.target);
    outAdj.set(e.source, o);

    const i = inAdj.get(e.target) || new Set<string>();
    i.add(e.source);
    inAdj.set(e.target, i);
  }

  const bfs = (start: string, adj: Map<string, Set<string>>): { direct: string[]; transitive: string[] } => {
    const direct = Array.from(adj.get(start) || []);
    const visited = new Set<string>([start, ...direct]);
    const queue = [...direct];
    const transitive: string[] = [...direct];

    while (queue.length > 0) {
      const curr = queue.shift()!;
      for (const next of adj.get(curr) || []) {
        if (!visited.has(next)) {
          visited.add(next);
          transitive.push(next);
          queue.push(next);
        }
      }
    }
    return { direct, transitive };
  };

  const deps = bfs(nodeId, outAdj);
  const dependents = bfs(nodeId, inAdj);

  const toRef = (id: string) => {
    const n = nodeMap.get(id);
    return {
      id,
      name: n?.name || id,
      kind: n?.kind || ('module' as GraphNodeKind),
      filePath: n?.filePath,
    };
  };

  const affectedFiles = new Set<string>();
  if (target.filePath) affectedFiles.add(target.filePath);
  for (const id of dependents.transitive) {
    const n = nodeMap.get(id);
    if (n?.filePath) affectedFiles.add(n.filePath);
    for (const cf of n?.metadata?.childFiles || []) {
      affectedFiles.add(cf);
    }
  }

  const affectedApisAndComponents = dependents.transitive
    .map((id) => nodeMap.get(id))
    .filter(
      (n): n is GraphNodeDTO =>
        Boolean(
          n &&
            ['api_endpoint', 'route', 'controller', 'component', 'application', 'socket'].includes(
              n.kind
            )
        )
    )
    .map((n) => ({ id: n.id, name: n.name, kind: n.kind, filePath: n.filePath }));

  const impactCount = dependents.transitive.length;
  const riskLevel: ImpactReportDTO['riskLevel'] =
    impactCount >= 8 ? 'high' : impactCount >= 3 ? 'medium' : 'low';

  return {
    nodeId: target.id,
    nodeName: target.name,
    nodeKind: target.kind,
    filePath: target.filePath,
    directDependencies: deps.direct.map(toRef),
    transitiveDependencies: deps.transitive.map(toRef),
    directDependents: dependents.direct.map(toRef),
    transitiveDependents: dependents.transitive.map(toRef),
    affectedFiles: Array.from(affectedFiles),
    affectedApisAndComponents,
    riskLevel,
    note: 'Impact is derived strictly from statically resolved imports, function calls, inheritance, DI, and API/DB references.',
  };
}

export function buildScopedCodeGraph(
  parsedFiles: FileAstSummary[],
  options: { filePath?: string; moduleGroup?: string; limit?: number } = {}
): LevelGraphDTO {
  const limit = Math.min(260, Math.max(40, options.limit || 130));
  const nodes: GraphNodeDTO[] = [];
  const edges: GraphEdgeDTO[] = [];

  const filteredFiles = parsedFiles.filter((f) => {
    if (options.filePath && f.filePath !== options.filePath) return false;
    if (options.moduleGroup) {
      const role = classifyFileRole(f);
      if (role.moduleGroup !== options.moduleGroup) return false;
    }
    return true;
  });

  const targetFiles = filteredFiles.length > 0 ? filteredFiles : parsedFiles;
  const fnNameIndex = new Map<string, string[]>();
  const classNameIndex = new Map<string, string>();
  const modelNameIndex = new Map<string, string>();
  const socketIndex = new Map<string, string>();

  // Create symbol nodes
  for (const file of targetFiles) {
    const role = classifyFileRole(file);
    const folder = path.posix.dirname(file.filePath);

    for (const cls of file.classes) {
      const id = `code:class:${file.filePath}:${cls.name}`;
      classNameIndex.set(cls.name, id);
      nodes.push({
        id,
        name: cls.name,
        kind: 'class',
        level: 'code',
        layer: role.layer,
        filePath: file.filePath,
        line: cls.line,
        endLine: cls.endLine,
        language: file.language,
        folder,
        moduleGroup: role.moduleGroup,
        description: `Class ${cls.name} (${cls.methods.length} methods, ${cls.properties.length} properties)`,
        parentId: `file:${file.filePath}`,
        dependencies: [],
        incomingCount: 0,
        outgoingCount: 0,
        usageCount: 0,
        exported: cls.exported,
        codePreview: getPreview(file.content, cls.line, 14),
        metadata: {
          decorators: cls.decorators,
          extendsClass: cls.extendsClass,
          implementsInterfaces: cls.implementsInterfaces,
          methods: cls.methods,
          properties: cls.properties.map((p) => p.name),
          parameters: cls.constructorParams,
        },
      });
    }

    for (const fn of file.functions) {
      const id = `code:fn:${file.filePath}:${fn.name}:${fn.line}`;
      const existingList = fnNameIndex.get(fn.name) || [];
      existingList.push(id);
      fnNameIndex.set(fn.name, existingList);
      const baseFnName = fn.name.includes('.') ? fn.name.split('.').pop()! : fn.name;
      if (baseFnName !== fn.name) {
        const bList = fnNameIndex.get(baseFnName) || [];
        bList.push(id);
        fnNameIndex.set(baseFnName, bList);
      }

      nodes.push({
        id,
        name: fn.name,
        kind: fn.kind === 'method' ? 'method' : 'function',
        level: 'code',
        layer: role.layer,
        filePath: file.filePath,
        line: fn.line,
        endLine: fn.endLine,
        language: file.language,
        folder,
        moduleGroup: role.moduleGroup,
        description: `${fn.isHook ? 'Hook' : fn.kind === 'method' ? 'Method' : 'Function'} ${fn.name}(${fn.parameters.map((p) => p.name).join(', ')})`,
        parentId: fn.className ? `code:class:${file.filePath}:${fn.className}` : `file:${file.filePath}`,
        dependencies: [],
        incomingCount: 0,
        outgoingCount: 0,
        usageCount: 0,
        exported: fn.exported,
        codePreview: getPreview(file.content, fn.line, 12),
        metadata: {
          parameters: fn.parameters,
          returnType: fn.returnType,
          isHook: fn.isHook,
          isAsync: fn.isAsync,
        },
      });

      if (fn.className && classNameIndex.has(fn.className)) {
        edges.push({
          id: `edge:${classNameIndex.get(fn.className)}->${id}:EXPORTS`,
          source: classNameIndex.get(fn.className)!,
          target: id,
          relation: 'EXPORTS',
          label: 'contains method',
          filePath: file.filePath,
          line: fn.line,
        });
      }
    }

    for (const obj of file.objects) {
      const id = `code:obj:${file.filePath}:${obj.name}:${obj.line}`;
      nodes.push({
        id,
        name: obj.name,
        kind: 'object',
        level: 'code',
        layer: role.layer,
        filePath: file.filePath,
        line: obj.line,
        endLine: obj.endLine,
        language: file.language,
        folder,
        moduleGroup: role.moduleGroup,
        description: `Object literal ${obj.name} (${obj.properties.length} props, ${obj.methods.length} methods)`,
        parentId: `file:${file.filePath}`,
        dependencies: [],
        incomingCount: 0,
        outgoingCount: 0,
        usageCount: 0,
        exported: obj.exported,
        codePreview: getPreview(file.content, obj.line, 10),
        metadata: {
          properties: obj.properties,
          methods: obj.methods,
        },
      });
    }

    for (const v of file.variables.slice(0, 12)) {
      const id = `code:var:${file.filePath}:${v.name}:${v.line}`;
      const kind: GraphNodeKind =
        v.kind === 'interface'
          ? 'interface'
          : v.kind === 'type' || v.kind === 'enum'
            ? 'type'
            : v.kind === 'constant'
              ? 'constant'
              : 'variable';
      nodes.push({
        id,
        name: v.name,
        kind,
        level: 'code',
        layer: role.layer,
        filePath: file.filePath,
        line: v.line,
        language: file.language,
        folder,
        moduleGroup: role.moduleGroup,
        description: `${v.kind} ${v.name}${v.dataType ? `: ${v.dataType}` : ''}`,
        parentId: `file:${file.filePath}`,
        dependencies: [],
        incomingCount: 0,
        outgoingCount: 0,
        usageCount: 0,
        exported: v.exported,
        codePreview: getPreview(file.content, v.line, 6),
        metadata: {
          scope: v.scope,
          returnType: v.dataType,
        },
      });
    }

    for (const ep of file.endpoints) {
      const id = `code:ep:${file.filePath}:${ep.method}:${ep.path}:${ep.line}`;
      nodes.push({
        id,
        name: `${ep.method} ${ep.path}`,
        kind: 'api_endpoint',
        level: 'code',
        layer: 'api',
        filePath: file.filePath,
        line: ep.line,
        language: file.language,
        folder,
        moduleGroup: role.moduleGroup,
        description: `${ep.framework.toUpperCase()} endpoint ${ep.method} ${ep.path}`,
        parentId: `file:${file.filePath}`,
        dependencies: [],
        incomingCount: 0,
        outgoingCount: 0,
        usageCount: 0,
        codePreview: getPreview(file.content, ep.line, 8),
        metadata: {
          httpMethod: ep.method,
          routePath: ep.path,
        },
      });

      for (const mw of ep.middlewares) {
        const mwTargets = fnNameIndex.get(mw);
        if (mwTargets?.[0]) {
          edges.push({
            id: `edge:${id}->${mwTargets[0]}:CALLS`,
            source: id,
            target: mwTargets[0],
            relation: 'CALLS',
            label: 'middleware',
            filePath: file.filePath,
            line: ep.line,
            animated: true,
          });
        }
      }
      for (const h of ep.handlers) {
        const hTargets = fnNameIndex.get(h);
        if (hTargets?.[0]) {
          edges.push({
            id: `edge:${id}->${hTargets[0]}:SENDS_DATA_TO`,
            source: id,
            target: hTargets[0],
            relation: 'SENDS_DATA_TO',
            label: 'handles',
            filePath: file.filePath,
            line: ep.line,
            animated: true,
          });
        }
      }
    }

    for (const m of file.dbModels) {
      const id = `code:model:${m.name}`;
      if (!modelNameIndex.has(m.name)) {
        modelNameIndex.set(m.name, id);
        nodes.push({
          id,
          name: m.name,
          kind: 'model',
          level: 'code',
          layer: 'database',
          filePath: file.filePath,
          line: m.line,
          language: file.language,
          folder,
          moduleGroup: role.moduleGroup,
          description: `${m.orm} data model ${m.name}`,
          dependencies: [],
          incomingCount: 0,
          outgoingCount: 0,
          usageCount: 0,
          codePreview: getPreview(file.content, m.line, 8),
        });
      }
    }

    for (const sock of file.socketEvents) {
      const id = `code:socket:${sock.eventName}`;
      if (!socketIndex.has(sock.eventName)) {
        socketIndex.set(sock.eventName, id);
        nodes.push({
          id,
          name: `socket:${sock.eventName}`,
          kind: 'socket',
          level: 'code',
          layer: 'realtime',
          filePath: file.filePath,
          line: sock.line,
          language: file.language,
          folder,
          moduleGroup: role.moduleGroup,
          description: `WebSocket event "${sock.eventName}"`,
          dependencies: [],
          incomingCount: 0,
          outgoingCount: 0,
          usageCount: 0,
          codePreview: getPreview(file.content, sock.line, 6),
        });
      }
    }
  }

  // Create edges between symbols (CALLS, EXTENDS, IMPLEMENTS, INSTANTIATES, INJECTS, READS/WRITES, TRIGGERS/LISTENS_TO)
  for (const file of targetFiles) {
    for (const cls of file.classes) {
      const clsId = classNameIndex.get(cls.name);
      if (!clsId) continue;
      if (cls.extendsClass && classNameIndex.has(cls.extendsClass)) {
        edges.push({
          id: `edge:${clsId}->${classNameIndex.get(cls.extendsClass)}:EXTENDS`,
          source: clsId,
          target: classNameIndex.get(cls.extendsClass)!,
          relation: 'EXTENDS',
          label: 'extends',
          filePath: file.filePath,
          line: cls.line,
        });
      }
      for (const param of cls.constructorParams) {
        if (param.type && classNameIndex.has(param.type)) {
          edges.push({
            id: `edge:${clsId}->${classNameIndex.get(param.type)}:INJECTS`,
            source: clsId,
            target: classNameIndex.get(param.type)!,
            relation: 'INJECTS',
            label: 'injects DI',
            filePath: file.filePath,
            line: cls.line,
          });
        }
      }
    }

    for (const fn of file.functions) {
      const fnId = `code:fn:${file.filePath}:${fn.name}:${fn.line}`;
      for (const call of fn.calls) {
        const cleanCall = call.split('.').pop() || call;
        const targets = fnNameIndex.get(call) || fnNameIndex.get(cleanCall) || [];
        for (const tId of targets.slice(0, 2)) {
          if (tId !== fnId) {
            edges.push({
              id: `edge:${fnId}->${tId}:CALLS`,
              source: fnId,
              target: tId,
              relation: 'CALLS',
              label: 'calls',
              filePath: file.filePath,
              line: fn.line,
            });
          }
        }
      }
      for (const inst of fn.instantiates) {
        const clsId = classNameIndex.get(inst);
        if (clsId) {
          edges.push({
            id: `edge:${fnId}->${clsId}:INSTANTIATES`,
            source: fnId,
            target: clsId,
            relation: 'INSTANTIATES',
            label: 'new',
            filePath: file.filePath,
            line: fn.line,
          });
        }
      }
    }

    for (const op of file.dbOps) {
      const modelId = modelNameIndex.get(op.modelName);
      if (!modelId) continue;
      const callerTargets = op.callerName ? fnNameIndex.get(op.callerName) || [] : [];
      const srcId = callerTargets[0];
      if (srcId) {
        const rel: GraphEdgeRelation =
          op.operation === 'read' ? 'READS' : op.operation === 'write' ? 'WRITES' : 'QUERIES';
        edges.push({
          id: `edge:${srcId}->${modelId}:${rel}:${op.line}`,
          source: srcId,
          target: modelId,
          relation: rel,
          label: op.method,
          filePath: file.filePath,
          line: op.line,
          animated: true,
        });
      }
    }

    for (const sock of file.socketEvents) {
      const sId = socketIndex.get(sock.eventName);
      if (!sId) continue;
      const callerTargets = sock.callerName ? fnNameIndex.get(sock.callerName) || [] : [];
      const fnId = callerTargets[0];
      if (fnId) {
        if (sock.direction === 'emit') {
          edges.push({
            id: `edge:${fnId}->${sId}:TRIGGERS:${sock.line}`,
            source: fnId,
            target: sId,
            relation: 'TRIGGERS',
            label: 'emits',
            filePath: file.filePath,
            line: sock.line,
            animated: true,
          });
        } else {
          edges.push({
            id: `edge:${fnId}->${sId}:LISTENS_TO:${sock.line}`,
            source: fnId,
            target: sId,
            relation: 'LISTENS_TO',
            label: 'listens',
            filePath: file.filePath,
            line: sock.line,
          });
        }
      }
    }
  }

  let finalNodes = nodes;
  let truncated = false;
  const dedupedAllEdges = dedupeEdges(edges);
  finalizeNodeDegrees(finalNodes, dedupedAllEdges);

  if (finalNodes.length > limit) {
    truncated = true;
    const priorityRank = (n: GraphNodeDTO) => {
      let score = n.usageCount * 10;
      if (n.kind === 'api_endpoint' || n.kind === 'class' || n.kind === 'model' || n.kind === 'socket') score += 25;
      if (n.exported) score += 10;
      if (n.kind === 'function') score += 5;
      return score;
    };
    finalNodes = [...finalNodes].sort((a, b) => priorityRank(b) - priorityRank(a)).slice(0, limit);
  }

  const visibleIds = new Set(finalNodes.map((n) => n.id));
  const visibleEdges = dedupedAllEdges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target));
  finalizeNodeDegrees(finalNodes, visibleEdges);

  return {
    level: 'code',
    nodes: finalNodes,
    edges: visibleEdges,
    truncated,
    totalNodesAvailable: nodes.length,
  };
}

export function buildArchitectureIntelligence(params: {
  repositoryId: string;
  repositoryName: string;
  files: StoredRepositoryFile[];
  dependencies: DependencyInfo[];
  frameworks: string[];
  forceRefresh?: boolean;
}): {
  intelligence: ArchitectureIntelligenceDTO;
  parsedFiles: FileAstSummary[];
  legacyGraph: ArchitectureGraph;
} {
  const { parsedFiles, reusedFilesCount, parsedFilesCount, combinedHash } =
    parseRepositoryFilesWithCache(params.repositoryId, params.files);

  const cachedEntry = repoArchitectureCache.get(params.repositoryId);
  if (cachedEntry && cachedEntry.combinedHash === combinedHash && !params.forceRefresh) {
    return {
      intelligence: {
        ...cachedEntry.intelligence,
        cacheMeta: { ...cachedEntry.intelligence.cacheMeta, cached: true },
      },
      parsedFiles: cachedEntry.parsedFiles,
      legacyGraph: toLegacyArchitectureGraph(cachedEntry.intelligence),
    };
  }

  const validPaths = new Set(parsedFiles.map((f) => f.filePath));
  const fileRoleMap = new Map<string, ReturnType<typeof classifyFileRole>>();
  for (const f of parsedFiles) {
    fileRoleMap.set(f.filePath, classifyFileRole(f));
  }

  // =========================================================================
  // 1. Resolve file-to-file imports & external dependencies
  // =========================================================================
  const internalImportAdj = new Map<string, Set<string>>();
  const reverseInternalAdj = new Map<string, Set<string>>();
  const externalPackagesUsed = new Map<string, Set<string>>(); // pkg -> Set<filePath>
  const unusedImports: UnusedImportInfo[] = [];
  let totalImportCount = 0;

  for (const file of parsedFiles) {
    const outSet = internalImportAdj.get(file.filePath) || new Set<string>();
    internalImportAdj.set(file.filePath, outSet);

    for (const imp of file.imports) {
      totalImportCount++;
      for (const spec of imp.specifiers) {
        if (!spec.used && !spec.isTypeOnly && spec.local) {
          unusedImports.push({
            filePath: file.filePath,
            identifier: spec.local,
            source: imp.source,
            line: spec.line,
          });
        }
      }

      const resolved = resolveLocalImport(file.filePath, imp.source, validPaths);
      if (resolved) {
        outSet.add(resolved);
        const rev = reverseInternalAdj.get(resolved) || new Set<string>();
        rev.add(file.filePath);
        reverseInternalAdj.set(resolved, rev);
      } else if (!imp.source.startsWith('.')) {
        const pkg = normalizePackageName(imp.source);
        if (pkg && !NODE_BUILTINS.has(pkg) && !imp.source.startsWith('@/')) {
          const users = externalPackagesUsed.get(pkg) || new Set<string>();
          users.add(file.filePath);
          externalPackagesUsed.set(pkg, users);
        }
      }
    }
  }

  const circularDependencies = computeCircularDependencies(internalImportAdj);
  const orphanedFiles = parsedFiles
    .filter((f) => {
      if (/\.(json|md|yml|yaml|css|scss|html|txt|env|lock)$/i.test(f.filePath)) return false;
      const base = path.posix.basename(f.filePath).toLowerCase();
      if (/^(main|index|app|server|vite\.config|tsconfig|package)/.test(base)) return false;
      const inDeg = reverseInternalAdj.get(f.filePath)?.size || 0;
      const outDeg = internalImportAdj.get(f.filePath)?.size || 0;
      return inDeg === 0 && outDeg === 0;
    })
    .map((f) => f.filePath)
    .slice(0, 60);

  // =========================================================================
  // 2. Build Level 3: FILE ARCHITECTURE
  // =========================================================================
  const fileNodes: GraphNodeDTO[] = [];
  const fileEdges: GraphEdgeDTO[] = [];
  const dbCollectionNodes = new Map<string, GraphNodeDTO>();
  const externalNodes = new Map<string, GraphNodeDTO>();

  for (const file of parsedFiles) {
    const role = fileRoleMap.get(file.filePath)!;
    const base = path.posix.basename(file.filePath);
    const folder = path.posix.dirname(file.filePath);
    const summaryParts: string[] = [];
    if (file.functions.length) summaryParts.push(`${file.functions.length} fn`);
    if (file.classes.length) summaryParts.push(`${file.classes.length} class`);
    if (file.endpoints.length) summaryParts.push(`${file.endpoints.length} endpoints`);
    if (file.dbModels.length) summaryParts.push(`${file.dbModels.length} models`);

    fileNodes.push({
      id: `file:${file.filePath}`,
      name: base,
      kind: role.kind,
      level: 'file',
      layer: role.layer,
      filePath: file.filePath,
      line: 1,
      endLine: file.lines,
      language: file.language,
      folder,
      moduleGroup: role.moduleGroup,
      description: `${file.language} ${role.kind.replace('_', ' ')} · ${file.lines} lines${summaryParts.length ? ` (${summaryParts.join(', ')})` : ''}`,
      parentId: `mod:${role.layer}:${role.moduleGroup}`,
      drillDownLevel: 'code',
      dependencies: [],
      incomingCount: 0,
      outgoingCount: 0,
      usageCount: 0,
      codePreview: getPreview(file.content, 1, 16),
      metadata: {
        lines: file.lines,
        decorators: file.decoratorsUsed,
      },
    });

    // Local file imports -> IMPORTS edges
    for (const targetFile of internalImportAdj.get(file.filePath) || []) {
      fileEdges.push({
        id: `edge:file:${file.filePath}->file:${targetFile}:IMPORTS`,
        source: `file:${file.filePath}`,
        target: `file:${targetFile}`,
        relation: 'IMPORTS',
        label: 'imports',
        filePath: file.filePath,
      });
    }

    // DB models & operations
    for (const op of file.dbOps) {
      const dbId = `db:model:${op.modelName}`;
      if (!dbCollectionNodes.has(dbId)) {
        dbCollectionNodes.set(dbId, {
          id: dbId,
          name: op.modelName,
          kind: 'collection',
          level: 'file',
          layer: 'database',
          description: `Database model / collection "${op.modelName}"`,
          dependencies: [],
          incomingCount: 0,
          outgoingCount: 0,
          usageCount: 0,
        });
      }
      const rel: GraphEdgeRelation = op.operation === 'read' ? 'READS' : op.operation === 'write' ? 'WRITES' : 'QUERIES';
      fileEdges.push({
        id: `edge:file:${file.filePath}->${dbId}:${rel}`,
        source: `file:${file.filePath}`,
        target: dbId,
        relation: rel,
        label: op.method,
        filePath: file.filePath,
        line: op.line,
        animated: true,
      });
    }
  }

  // Add top external dependencies used in imports (cap at 18 so File graph stays readable)
  const sortedExt = Array.from(externalPackagesUsed.entries())
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 18);

  for (const [pkg, users] of sortedExt) {
    const extId = `ext:${pkg}`;
    const depMeta = params.dependencies.find((d) => d.name === pkg);
    externalNodes.set(extId, {
      id: extId,
      name: pkg,
      kind: 'external_dependency',
      level: 'file',
      layer: 'external',
      isExternal: true,
      description: `External package ${pkg}${depMeta ? ` (${depMeta.version})` : ''}`,
      dependencies: [],
      incomingCount: 0,
      outgoingCount: 0,
      usageCount: 0,
    });
    for (const userFile of users) {
      fileEdges.push({
        id: `edge:file:${userFile}->${extId}:DEPENDS_ON`,
        source: `file:${userFile}`,
        target: extId,
        relation: 'DEPENDS_ON',
        label: 'uses pkg',
        filePath: userFile,
      });
    }
  }

  // Link frontend HTTP calls to backend route files!
  const backendEndpointFiles: Array<{ filePath: string; ep: FileAstSummary['endpoints'][0] }> = [];
  for (const f of parsedFiles) {
    for (const ep of f.endpoints) {
      backendEndpointFiles.push({ filePath: f.filePath, ep });
    }
  }

  for (const f of parsedFiles) {
    for (const call of f.httpCalls) {
      const cleanUrl = call.url.split('?')[0].replace(/^https?:\/\/[^/]+/, '');
      for (const be of backendEndpointFiles) {
        const routeSeg = be.ep.path.replace(/:[^/]+/g, '');
        if (cleanUrl.includes(routeSeg) && routeSeg.length > 1) {
          fileEdges.push({
            id: `edge:file:${f.filePath}->file:${be.filePath}:SENDS_DATA_TO`,
            source: `file:${f.filePath}`,
            target: `file:${be.filePath}`,
            relation: 'SENDS_DATA_TO',
            label: `${call.method} ${be.ep.path}`,
            filePath: f.filePath,
            line: call.line,
            animated: true,
          });
        }
      }
    }
  }

  // Link WebSocket emitters to listeners across files
  const socketListeners = new Map<string, string[]>();
  for (const f of parsedFiles) {
    for (const ev of f.socketEvents) {
      if (ev.direction === 'listen') {
        const list = socketListeners.get(ev.eventName) || [];
        list.push(f.filePath);
        socketListeners.set(ev.eventName, list);
      }
    }
  }
  for (const f of parsedFiles) {
    for (const ev of f.socketEvents) {
      if (ev.direction === 'emit') {
        for (const listenerFile of socketListeners.get(ev.eventName) || []) {
          if (listenerFile !== f.filePath) {
            fileEdges.push({
              id: `edge:file:${f.filePath}->file:${listenerFile}:TRIGGERS`,
              source: `file:${f.filePath}`,
              target: `file:${listenerFile}`,
              relation: 'TRIGGERS',
              label: `emit "${ev.eventName}"`,
              filePath: f.filePath,
              line: ev.line,
              animated: true,
            });
          }
        }
      }
    }
  }

  const allFileNodes = [...fileNodes, ...dbCollectionNodes.values(), ...externalNodes.values()];
  const dedupedFileEdges = dedupeEdges(fileEdges);
  finalizeNodeDegrees(allFileNodes, dedupedFileEdges);

  // =========================================================================
  // 3. Build Level 2: MODULE ARCHITECTURE
  // =========================================================================
  const moduleGroups = new Map<
    string,
    { id: string; name: string; kind: GraphNodeKind; layer: ArchitectureLayer; files: FileAstSummary[] }
  >();

  for (const f of parsedFiles) {
    const role = fileRoleMap.get(f.filePath)!;
    const modId = `mod:${role.layer}:${role.moduleGroup}`;
    const existing = moduleGroups.get(modId);
    if (existing) {
      existing.files.push(f);
    } else {
      const kindMap: Partial<Record<ArchitectureLayer, GraphNodeKind>> = {
        frontend: 'component',
        api: 'route',
        backend: 'service',
        service: 'service',
        database: 'model',
        worker: 'background_worker',
        realtime: 'socket',
        shared: 'module',
        config: 'module',
      };
      moduleGroups.set(modId, {
        id: modId,
        name: `${role.moduleGroup} (${role.layer})`,
        kind: kindMap[role.layer] || 'module',
        layer: role.layer,
        files: [f],
      });
    }
  }

  const fileToModId = new Map<string, string>();
  for (const f of parsedFiles) {
    const role = fileRoleMap.get(f.filePath)!;
    fileToModId.set(`file:${f.filePath}`, `mod:${role.layer}:${role.moduleGroup}`);
  }

  const moduleNodes: GraphNodeDTO[] = Array.from(moduleGroups.values()).map((mg) => {
    const allFilePaths = mg.files.map((f) => f.filePath);
    const totalLines = mg.files.reduce((s, f) => s + f.lines, 0);
    return {
      id: mg.id,
      name: mg.name,
      kind: mg.kind,
      level: 'module',
      layer: mg.layer,
      filePath: allFilePaths[0],
      moduleGroup: mg.name,
      description: `Module grouping ${mg.files.length} source file(s) (${totalLines} lines)`,
      drillDownLevel: 'file',
      dependencies: [],
      incomingCount: 0,
      outgoingCount: 0,
      usageCount: 0,
      codePreview: allFilePaths.slice(0, 10).join('\n'),
      metadata: {
        fileCount: mg.files.length,
        lines: totalLines,
        childFiles: allFilePaths,
      },
    };
  });

  // Add DB collections & top 8 external services to Module graph
  for (const dbNode of dbCollectionNodes.values()) {
    moduleNodes.push({ ...dbNode, id: `mod:${dbNode.id}`, level: 'module' });
  }
  for (const extNode of Array.from(externalNodes.values()).slice(0, 8)) {
    moduleNodes.push({ ...extNode, id: `mod:${extNode.id}`, level: 'module' });
  }

  const moduleNodeIds = new Set(moduleNodes.map((n) => n.id));
  const moduleEdgesRaw: GraphEdgeDTO[] = [];
  for (const fe of dedupedFileEdges) {
    const srcMod = fileToModId.get(fe.source) || `mod:${fe.source}`;
    const tgtMod = fileToModId.get(fe.target) || `mod:${fe.target}`;
    if (srcMod !== tgtMod && moduleNodeIds.has(srcMod) && moduleNodeIds.has(tgtMod)) {
      moduleEdgesRaw.push({
        id: `edge:${srcMod}->${tgtMod}:${fe.relation}`,
        source: srcMod,
        target: tgtMod,
        relation: fe.relation,
        label: fe.label,
        animated: fe.animated,
      });
    }
  }
  const moduleEdges = dedupeEdges(moduleEdgesRaw);
  finalizeNodeDegrees(moduleNodes, moduleEdges);

  // =========================================================================
  // 4. Build Level 1: SYSTEM ARCHITECTURE
  // =========================================================================
  const systemBuckets = new Map<
    string,
    { id: string; name: string; kind: GraphNodeKind; layer: ArchitectureLayer; files: string[] }
  >();

  for (const f of parsedFiles) {
    const role = fileRoleMap.get(f.filePath)!;
    let bucketKey = 'sys:backend';
    let name = 'Backend Application';
    let kind: GraphNodeKind = 'application';
    let layer: ArchitectureLayer = 'backend';

    if (role.layer === 'frontend') {
      bucketKey = 'sys:frontend';
      name = 'Frontend Application';
      kind = 'application';
      layer = 'frontend';
    } else if (role.layer === 'api') {
      bucketKey = 'sys:api';
      name = 'REST / API Layer';
      kind = 'api_endpoint';
      layer = 'api';
    } else if (role.layer === 'service') {
      bucketKey = 'sys:services';
      name = 'Domain Services';
      kind = 'service';
      layer = 'service';
    } else if (role.layer === 'database') {
      bucketKey = 'sys:database';
      name = 'Database & Models';
      kind = 'database';
      layer = 'database';
    } else if (role.layer === 'worker') {
      bucketKey = 'sys:workers';
      name = 'Background Workers & Queues';
      kind = 'background_worker';
      layer = 'worker';
    } else if (role.layer === 'realtime') {
      bucketKey = 'sys:realtime';
      name = 'WebSocket / Event Bus';
      kind = 'socket';
      layer = 'realtime';
    } else if (role.layer === 'shared' || role.layer === 'config') {
      bucketKey = 'sys:shared';
      name = 'Shared Types & Config';
      kind = 'module';
      layer = 'shared';
    }

    const existing = systemBuckets.get(bucketKey);
    if (existing) {
      existing.files.push(f.filePath);
    } else {
      systemBuckets.set(bucketKey, { id: bucketKey, name, kind, layer, files: [f.filePath] });
    }
  }

  // Also ensure a Database system node if any file performs DB ops even if no model file exists
  if (!systemBuckets.has('sys:database') && dbCollectionNodes.size > 0) {
    systemBuckets.set('sys:database', {
      id: 'sys:database',
      name: 'Database & Persistence',
      kind: 'database',
      layer: 'database',
      files: [],
    });
  }

  // External integrations system node if external dependencies exist
  const extNames = Array.from(externalPackagesUsed.keys()).slice(0, 8);
  if (extNames.length > 0) {
    systemBuckets.set('sys:external', {
      id: 'sys:external',
      name: 'External Integrations & SDKs',
      kind: 'external_dependency',
      layer: 'external',
      files: [],
    });
  }

  const fileToSysId = new Map<string, string>();
  for (const [k, bucket] of systemBuckets.entries()) {
    for (const fp of bucket.files) {
      fileToSysId.set(`file:${fp}`, k);
    }
  }
  for (const dbId of dbCollectionNodes.keys()) {
    fileToSysId.set(dbId, 'sys:database');
  }
  for (const extId of externalNodes.keys()) {
    fileToSysId.set(extId, 'sys:external');
  }

  const systemNodes: GraphNodeDTO[] = Array.from(systemBuckets.values()).map((b) => ({
    id: b.id,
    name: b.name,
    kind: b.kind,
    level: 'system',
    layer: b.layer,
    filePath: b.files[0],
    description:
      b.id === 'sys:external'
        ? `External SDKs & services: ${extNames.join(', ')}`
        : `System subsystem spanning ${b.files.length} file(s)`,
    isExternal: b.layer === 'external',
    drillDownLevel: 'module',
    dependencies: [],
    incomingCount: 0,
    outgoingCount: 0,
    usageCount: 0,
    codePreview: b.files.slice(0, 12).join('\n'),
    metadata: {
      fileCount: b.files.length,
      childFiles: b.files,
    },
  }));

  const sysNodeIds = new Set(systemNodes.map((n) => n.id));
  const systemEdgesRaw: GraphEdgeDTO[] = [];
  for (const fe of dedupedFileEdges) {
    const srcSys = fileToSysId.get(fe.source);
    const tgtSys = fileToSysId.get(fe.target);
    if (srcSys && tgtSys && srcSys !== tgtSys && sysNodeIds.has(srcSys) && sysNodeIds.has(tgtSys)) {
      const relation: GraphEdgeRelation =
        tgtSys === 'sys:database'
          ? 'QUERIES'
          : tgtSys === 'sys:external'
            ? 'DEPENDS_ON'
            : srcSys === 'sys:frontend' && tgtSys === 'sys:api'
              ? 'SENDS_DATA_TO'
              : fe.relation;
      systemEdgesRaw.push({
        id: `edge:${srcSys}->${tgtSys}:${relation}`,
        source: srcSys,
        target: tgtSys,
        relation,
        label: relation.toLowerCase().replace(/_/g, ' '),
        animated: relation === 'SENDS_DATA_TO' || relation === 'QUERIES' || relation === 'TRIGGERS',
      });
    }
  }
  const systemEdges = dedupeEdges(systemEdgesRaw);
  finalizeNodeDegrees(systemNodes, systemEdges);

  // =========================================================================
  // 5. Build Level 4: CODE ARCHITECTURE (Default viewport slice)
  // =========================================================================
  const codeLevel = buildScopedCodeGraph(parsedFiles, { limit: 130 });

  // =========================================================================
  // 6. Build Complete Symbol Explorer Indexes (Functions, Classes, Objects, Variables)
  // =========================================================================
  const allFunctions: FunctionSymbolInfo[] = [];
  const callersMap = new Map<string, Set<string>>();

  for (const f of parsedFiles) {
    for (const fn of f.functions) {
      for (const call of fn.calls) {
        const clean = call.split('.').pop() || call;
        const set = callersMap.get(clean) || new Set<string>();
        set.add(`${fn.name} (${path.posix.basename(f.filePath)})`);
        callersMap.set(clean, set);
      }
    }
  }

  for (const f of parsedFiles) {
    for (const fn of f.functions) {
      const shortName = fn.name.includes('.') ? fn.name.split('.').pop()! : fn.name;
      allFunctions.push({
        id: `code:fn:${f.filePath}:${fn.name}:${fn.line}`,
        name: fn.name,
        kind: fn.kind,
        filePath: f.filePath,
        line: fn.line,
        endLine: fn.endLine,
        parameters: fn.parameters,
        returnType: fn.returnType,
        calls: fn.calls,
        calledBy: Array.from(callersMap.get(shortName) || callersMap.get(fn.name) || []).slice(0, 20),
        variablesUsed: fn.variablesUsed,
        dependencies: Array.from(new Set([...fn.calls, ...fn.instantiates])).slice(0, 25),
        exported: fn.exported,
        isAsync: fn.isAsync,
        isHook: fn.isHook,
        className: fn.className,
      });
    }
  }

  const allClasses: ClassSymbolInfo[] = [];
  for (const f of parsedFiles) {
    const fileImports = f.imports.map((i) => i.source);
    for (const cls of f.classes) {
      const diDeps = cls.constructorParams.map((p) => p.type).filter((x): x is string => Boolean(x));
      allClasses.push({
        id: `code:class:${f.filePath}:${cls.name}`,
        name: cls.name,
        filePath: f.filePath,
        line: cls.line,
        endLine: cls.endLine,
        properties: cls.properties,
        constructorParams: cls.constructorParams,
        methods: cls.methods,
        extendsClass: cls.extendsClass,
        implementsInterfaces: cls.implementsInterfaces,
        dependencies: Array.from(new Set([...diDeps, ...fileImports.slice(0, 6)])),
        decorators: cls.decorators,
        exported: cls.exported,
      });
    }
  }

  // Track references across repo for objects and variables
  const globalAccessIndex = new Map<string, Array<{ filePath: string; line: number; access: 'read' | 'write' | 'type' }>>();
  for (const f of parsedFiles) {
    for (const acc of f.accesses) {
      const list = globalAccessIndex.get(acc.name) || [];
      if (list.length < 40) {
        list.push({ filePath: f.filePath, line: acc.line, access: acc.access });
        globalAccessIndex.set(acc.name, list);
      }
    }
  }

  const allObjects: ObjectSymbolInfo[] = [];
  const allVariables: VariableSymbolInfo[] = [];
  for (const f of parsedFiles) {
    for (const obj of f.objects) {
      const refs = (globalAccessIndex.get(obj.name) || [])
        .filter((r) => !(r.filePath === f.filePath && r.line === obj.line))
        .slice(0, 20)
        .map((r) => ({ filePath: r.filePath, line: r.line, context: r.access }));
      allObjects.push({
        id: `code:obj:${f.filePath}:${obj.name}:${obj.line}`,
        name: obj.name,
        filePath: f.filePath,
        line: obj.line,
        endLine: obj.endLine,
        properties: obj.properties,
        methods: obj.methods,
        createdAt: { filePath: f.filePath, line: obj.line },
        references: refs,
        exported: obj.exported,
      });
    }

    for (const v of f.variables) {
      const refs = (globalAccessIndex.get(v.name) || [])
        .filter((r) => !(r.filePath === f.filePath && r.line === v.line))
        .slice(0, 20);
      allVariables.push({
        id: `code:var:${f.filePath}:${v.name}:${v.line}`,
        name: v.name,
        kind: v.kind,
        filePath: f.filePath,
        line: v.line,
        dataType: v.dataType,
        scope: v.scope,
        exported: v.exported,
        references: refs,
      });
    }
  }

  // =========================================================================
  // 7. Trace End-to-End Deterministic Data Flow Chains
  // =========================================================================
  const dataFlows: DataFlowChain[] = [];
  const fnByName = new Map<string, FunctionSymbolInfo>();
  for (const fn of allFunctions) {
    const short = fn.name.includes('.') ? fn.name.split('.').pop()! : fn.name;
    if (!fnByName.has(fn.name)) fnByName.set(fn.name, fn);
    if (!fnByName.has(short)) fnByName.set(short, fn);
  }

  // Express / Backend Endpoint Data Flows
  for (const f of parsedFiles) {
    for (const ep of f.endpoints.slice(0, 20)) {
      const steps: DataFlowStep[] = [];
      const epFileNodeId = `file:${f.filePath}`;
      steps.push({
        nodeId: epFileNodeId,
        name: `Route: ${ep.method} ${ep.path}`,
        kind: 'api_endpoint',
        layer: 'api',
        filePath: f.filePath,
        line: ep.line,
        relationToNext: 'CALLS',
        detail: `${ep.framework.toUpperCase()} route definition`,
      });

      for (const mw of ep.middlewares) {
        const mwFn = fnByName.get(mw);
        steps.push({
          nodeId: mwFn ? `file:${mwFn.filePath}` : epFileNodeId,
          name: `Middleware: ${mw}`,
          kind: 'middleware',
          layer: 'api',
          filePath: mwFn?.filePath || f.filePath,
          line: mwFn?.line || ep.line,
          relationToNext: 'SENDS_DATA_TO',
          detail: 'Request validation / auth check',
        });
      }

      const handlerName = ep.handlers[0];
      const handlerFn = handlerName ? fnByName.get(handlerName) : undefined;
      if (handlerName) {
        steps.push({
          nodeId: handlerFn ? `file:${handlerFn.filePath}` : epFileNodeId,
          name: `Controller: ${handlerName}`,
          kind: 'controller',
          layer: 'backend',
          filePath: handlerFn?.filePath || f.filePath,
          line: handlerFn?.line || ep.line,
          relationToNext: 'CALLS',
          detail: 'Handles incoming request & builds response',
        });

        // Follow 1-hop service calls & DB ops inside handler file
        if (handlerFn) {
          for (const call of handlerFn.calls) {
            const cleanCall = call.split('.').pop() || call;
            const serviceFn = fnByName.get(cleanCall);
            if (serviceFn && serviceFn.filePath !== handlerFn.filePath) {
              steps.push({
                nodeId: `file:${serviceFn.filePath}`,
                name: `Service: ${serviceFn.name}`,
                kind: 'service',
                layer: 'service',
                filePath: serviceFn.filePath,
                line: serviceFn.line,
                relationToNext: 'QUERIES',
                detail: 'Business logic execution',
              });
              const serviceFileAst = parsedFiles.find((pf) => pf.filePath === serviceFn.filePath);
              const firstDbOp = serviceFileAst?.dbOps[0];
              if (firstDbOp) {
                steps.push({
                  nodeId: `db:model:${firstDbOp.modelName}`,
                  name: `DB: ${firstDbOp.modelName}.${firstDbOp.method}()`,
                  kind: 'database',
                  layer: 'database',
                  filePath: serviceFileAst?.filePath,
                  line: firstDbOp.line,
                  relationToNext: 'RETURNS',
                  detail: `${firstDbOp.operation.toUpperCase()} operation`,
                });
              }
              break;
            }
          }
        }
      }

      const nodeIds = Array.from(new Set(steps.map((s) => s.nodeId)));
      const edgeIds: string[] = [];
      for (let i = 0; i < nodeIds.length - 1; i++) {
        const matchEdge = dedupedFileEdges.find(
          (e) => e.source === nodeIds[i] && e.target === nodeIds[i + 1]
        );
        if (matchEdge) edgeIds.push(matchEdge.id);
      }

      dataFlows.push({
        id: `flow:ep:${f.filePath}:${ep.method}:${ep.path}:${ep.line}`,
        title: `${ep.method} ${ep.path}`,
        category: 'express_api',
        entryPoint: `${f.filePath}:${ep.line}`,
        steps,
        edgeIds,
        nodeIds,
      });
    }
  }

  // Frontend -> Backend HTTP Flows
  for (const f of parsedFiles) {
    for (const call of f.httpCalls.slice(0, 12)) {
      const cleanUrl = call.url.split('?')[0];
      const matchedBackend = backendEndpointFiles.find((be) => {
        const seg = be.ep.path.replace(/:[^/]+/g, '');
        return seg.length > 1 && cleanUrl.includes(seg);
      });
      if (!matchedBackend) continue;

      const steps: DataFlowStep[] = [
        {
          nodeId: `file:${f.filePath}`,
          name: `${call.callerName || path.posix.basename(f.filePath)}`,
          kind: call.client === 'angular_http' ? 'service' : 'component',
          layer: 'frontend',
          filePath: f.filePath,
          line: call.line,
          relationToNext: 'SENDS_DATA_TO',
          detail: `${call.client} ${call.method} ${call.url}`,
        },
        {
          nodeId: `file:${matchedBackend.filePath}`,
          name: `${matchedBackend.ep.method} ${matchedBackend.ep.path}`,
          kind: 'api_endpoint',
          layer: 'api',
          filePath: matchedBackend.filePath,
          line: matchedBackend.ep.line,
          relationToNext: 'RETURNS',
          detail: 'Backend route handler',
        },
      ];
      dataFlows.push({
        id: `flow:http:${f.filePath}:${call.line}`,
        title: `Client ${call.method} ${cleanUrl} → API`,
        category: call.client === 'angular_http' ? 'angular_http' : 'frontend_api',
        entryPoint: `${f.filePath}:${call.line}`,
        steps,
        edgeIds: dedupedFileEdges
          .filter((e) => e.source === `file:${f.filePath}` && e.target === `file:${matchedBackend.filePath}`)
          .map((e) => e.id),
        nodeIds: [`file:${f.filePath}`, `file:${matchedBackend.filePath}`],
      });
    }
  }

  // WebSocket Flows
  const seenSocketFlows = new Set<string>();
  for (const f of parsedFiles) {
    for (const ev of f.socketEvents) {
      if (seenSocketFlows.has(ev.eventName)) continue;
      const listeners = socketListeners.get(ev.eventName) || [];
      if (ev.direction === 'emit' && listeners.length > 0) {
        seenSocketFlows.add(ev.eventName);
        const steps: DataFlowStep[] = [
          {
            nodeId: `file:${f.filePath}`,
            name: `Emitter: ${ev.callerName || path.posix.basename(f.filePath)}`,
            kind: 'socket',
            layer: 'realtime',
            filePath: f.filePath,
            line: ev.line,
            relationToNext: 'TRIGGERS',
            detail: `Emits event "${ev.eventName}"`,
          },
          ...listeners.slice(0, 3).map((lf) => ({
            nodeId: `file:${lf}`,
            name: `Listener: ${path.posix.basename(lf)}`,
            kind: 'socket' as GraphNodeKind,
            layer: 'realtime' as ArchitectureLayer,
            filePath: lf,
            relationToNext: 'LISTENS_TO' as GraphEdgeRelation,
            detail: `Handles "${ev.eventName}"`,
          })),
        ];
        dataFlows.push({
          id: `flow:ws:${ev.eventName}`,
          title: `Socket Event: ${ev.eventName}`,
          category: 'websocket',
          entryPoint: `${f.filePath}:${ev.line}`,
          steps,
          edgeIds: [],
          nodeIds: Array.from(new Set(steps.map((s) => s.nodeId))),
        });
      }
    }
  }

  // Worker / Job Flows
  for (const f of parsedFiles) {
    for (const w of f.workers) {
      dataFlows.push({
        id: `flow:worker:${f.filePath}:${w.name}:${w.line}`,
        title: `Worker: ${w.name}`,
        category: 'worker_job',
        entryPoint: `${f.filePath}:${w.line}`,
        steps: [
          {
            nodeId: `file:${f.filePath}`,
            name: `${w.kind.toUpperCase()}: ${w.name}`,
            kind: 'background_worker',
            layer: 'worker',
            filePath: f.filePath,
            line: w.line,
            detail: `Background execution in ${path.posix.basename(f.filePath)}`,
          },
        ],
        edgeIds: [],
        nodeIds: [`file:${f.filePath}`],
      });
    }
  }

  // =========================================================================
  // 8. Coupled Nodes & Static Complexity Metrics
  // =========================================================================
  const highlyCoupledNodes: CoupledNodeInfo[] = [...allFileNodes]
    .sort((a, b) => b.usageCount - a.usageCount)
    .slice(0, 12)
    .map((n) => ({
      nodeId: n.id,
      name: n.name,
      kind: n.kind,
      filePath: n.filePath,
      inDegree: n.incomingCount,
      outDegree: n.outgoingCount,
      totalDegree: n.usageCount,
    }));

  const parseErrors = parsedFiles
    .filter((f) => Boolean(f.parseError))
    .map((f) => ({ filePath: f.filePath, message: f.parseError! }));

  const intelligence: ArchitectureIntelligenceDTO = {
    repositoryId: params.repositoryId,
    repositoryName: params.repositoryName,
    generatedAt: new Date().toISOString(),
    levels: {
      system: { level: 'system', nodes: systemNodes, edges: systemEdges },
      module: { level: 'module', nodes: moduleNodes, edges: moduleEdges },
      file: { level: 'file', nodes: allFileNodes, edges: dedupedFileEdges },
      code: codeLevel,
    },
    symbols: {
      functions: allFunctions,
      classes: allClasses,
      objects: allObjects,
      variables: allVariables,
    },
    dataFlows: dataFlows.slice(0, 50),
    dependencyAnalysis: {
      circularDependencies,
      unusedImports: unusedImports.slice(0, 80),
      orphanedFiles,
      highlyCoupledNodes,
    },
    complexityMetrics: {
      fileCount: parsedFiles.length,
      functionCount: allFunctions.filter((f) => f.kind !== 'method').length,
      classCount: allClasses.length,
      methodCount: allFunctions.filter((f) => f.kind === 'method').length,
      objectCount: allObjects.length,
      interfaceAndTypeCount: allVariables.filter((v) =>
        ['interface', 'type', 'enum'].includes(v.kind)
      ).length,
      variableAndConstantCount: allVariables.filter((v) =>
        ['variable', 'constant'].includes(v.kind)
      ).length,
      importCount: totalImportCount,
      dependencyCount: externalPackagesUsed.size + params.dependencies.length,
      circularDependencyCount: circularDependencies.length,
      unusedImportCount: unusedImports.length,
      orphanedFileCount: orphanedFiles.length,
      endpointCount: parsedFiles.reduce((s, f) => s + f.endpoints.length, 0),
      socketEventCount: new Set(parsedFiles.flatMap((f) => f.socketEvents.map((e) => e.eventName))).size,
      modelCount: dbCollectionNodes.size,
    },
    cacheMeta: {
      reusedFilesCount,
      parsedFilesCount,
      parseErrors,
      cached: false,
    },
  };

  repoArchitectureCache.set(params.repositoryId, {
    combinedHash,
    intelligence,
    parsedFiles,
  });

  return {
    intelligence,
    parsedFiles,
    legacyGraph: toLegacyArchitectureGraph(intelligence),
  };
}

export function toLegacyArchitectureGraph(
  intelligence: ArchitectureIntelligenceDTO
): ArchitectureGraph {
  const modLevel = intelligence.levels.module;
  const legacyLayerMap: Record<ArchitectureLayer, ArchitectureNode['layer']> = {
    frontend: 'frontend',
    backend: 'backend',
    api: 'api',
    database: 'database',
    service: 'service',
    worker: 'backend',
    realtime: 'service',
    external: 'service',
    shared: 'config',
    config: 'config',
  };

  const nodes: ArchitectureNode[] = modLevel.nodes.slice(0, 16).map((n) => ({
    id: n.id,
    label: n.name,
    layer: legacyLayerMap[n.layer] || 'service',
    description: n.description,
    files: n.metadata?.childFiles?.slice(0, 12) || (n.filePath ? [n.filePath] : []),
    responsibilities: [
      `${n.incomingCount} incoming · ${n.outgoingCount} outgoing dependencies`,
    ],
  }));

  const validIds = new Set(nodes.map((n) => n.id));
  const edges: ArchitectureEdge[] = modLevel.edges
    .filter((e) => validIds.has(e.source) && validIds.has(e.target))
    .slice(0, 32)
    .map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      relationship: e.relation,
    }));

  return { nodes, edges };
}
