import crypto from 'crypto';
import { parse, type ParserPlugin } from '@babel/parser';
import type { StoredRepositoryFile } from '../../models/store.ts';
import { reconstructFileContent } from '../../utils/chunker.ts';

export interface ParsedImport {
  source: string;
  line: number;
  specifiers: Array<{
    local: string;
    imported: string;
    line: number;
    isTypeOnly: boolean;
    used: boolean;
  }>;
}

export interface ParsedExport {
  name: string;
  kind: string;
  line: number;
  reexportSource?: string;
}

export interface ParsedFunction {
  name: string;
  kind: 'function' | 'method' | 'hook';
  className?: string;
  line: number;
  endLine: number;
  parameters: Array<{ name: string; type?: string }>;
  returnType?: string;
  exported: boolean;
  isAsync: boolean;
  isHook: boolean;
  calls: string[];
  variablesUsed: string[];
  instantiates: string[];
}

export interface ParsedClass {
  name: string;
  line: number;
  endLine: number;
  decorators: string[];
  extendsClass?: string;
  implementsInterfaces: string[];
  properties: Array<{ name: string; type?: string; visibility?: string }>;
  constructorParams: Array<{ name: string; type?: string }>;
  methods: string[];
  exported: boolean;
}

export interface ParsedObject {
  name: string;
  line: number;
  endLine: number;
  properties: string[];
  methods: string[];
  exported: boolean;
}

export interface ParsedVariable {
  name: string;
  kind: 'variable' | 'constant' | 'interface' | 'type' | 'enum';
  line: number;
  dataType?: string;
  scope: 'module' | 'function' | 'class' | 'block';
  exported: boolean;
}

export interface ParsedEndpoint {
  method: string;
  path: string;
  line: number;
  middlewares: string[];
  handlers: string[];
  framework: 'express' | 'nestjs' | 'fastapi' | 'flask' | 'router';
}

export interface ParsedHttpCall {
  method: string;
  url: string;
  line: number;
  callerName?: string;
  client: 'fetch' | 'axios' | 'angular_http' | 'other';
}

export interface ParsedDbModel {
  name: string;
  line: number;
  orm: 'mongoose' | 'prisma' | 'sql' | 'typeorm';
}

export interface ParsedDbOp {
  modelName: string;
  operation: 'read' | 'write' | 'query';
  method: string;
  line: number;
  callerName?: string;
}

export interface ParsedSocketEvent {
  eventName: string;
  direction: 'listen' | 'emit';
  line: number;
  callerName?: string;
}

export interface ParsedWorker {
  name: string;
  kind: 'worker' | 'queue' | 'cron';
  line: number;
}

export interface IdentifierAccess {
  name: string;
  line: number;
  access: 'read' | 'write' | 'type';
}

export interface FileAstSummary {
  filePath: string;
  language: string;
  lines: number;
  hash: string;
  content: string;
  parseError?: string;
  imports: ParsedImport[];
  exports: ParsedExport[];
  functions: ParsedFunction[];
  classes: ParsedClass[];
  objects: ParsedObject[];
  variables: ParsedVariable[];
  endpoints: ParsedEndpoint[];
  httpCalls: ParsedHttpCall[];
  dbModels: ParsedDbModel[];
  dbOps: ParsedDbOp[];
  socketEvents: ParsedSocketEvent[];
  workers: ParsedWorker[];
  accesses: IdentifierAccess[];
  decoratorsUsed: string[];
}

// Incremental SHA-256 cache per repository file so unchanged files do not re-parse
const astFileCache = new Map<string, FileAstSummary>();

export function clearAstCacheForRepo(repositoryId: string): void {
  const prefix = `${repositoryId}::`;
  for (const key of astFileCache.keys()) {
    if (key.startsWith(prefix)) {
      astFileCache.delete(key);
    }
  }
}

type AnyNode = Record<string, any>;

function isNode(val: unknown): val is AnyNode {
  return Boolean(val && typeof val === 'object' && typeof (val as AnyNode).type === 'string');
}

function walkAst(node: unknown, visit: (n: AnyNode, parent: AnyNode | null) => void, parent: AnyNode | null = null): void {
  if (!isNode(node)) return;
  visit(node, parent);
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'start' || key === 'end' || key === 'tokens' || key === 'comments' || key === 'extra') {
      continue;
    }
    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        if (isNode(item)) walkAst(item, visit, node);
      }
    } else if (isNode(child)) {
      walkAst(child, visit, node);
    }
  }
}

function extractCalleeName(node: AnyNode | null | undefined): string {
  if (!node) return '';
  if (node.type === 'Identifier') return String(node.name || '');
  if (node.type === 'ThisExpression') return 'this';
  if (node.type === 'Super') return 'super';
  if (node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression') {
    const obj = extractCalleeName(node.object);
    const prop = node.property?.name || node.property?.value || '';
    return obj && prop ? `${obj}.${prop}` : String(prop || obj || '');
  }
  if (node.type === 'CallExpression') {
    return extractCalleeName(node.callee);
  }
  return '';
}

function formatTsType(typeNode: AnyNode | null | undefined): string | undefined {
  if (!typeNode) return undefined;
  const unwrapped = typeNode.type === 'TSTypeAnnotation' ? typeNode.typeAnnotation : typeNode;
  if (!unwrapped) return undefined;
  switch (unwrapped.type) {
    case 'TSStringKeyword':
      return 'string';
    case 'TSNumberKeyword':
      return 'number';
    case 'TSBooleanKeyword':
      return 'boolean';
    case 'TSVoidKeyword':
      return 'void';
    case 'TSAnyKeyword':
      return 'any';
    case 'TSUnknownKeyword':
      return 'unknown';
    case 'TSNullKeyword':
      return 'null';
    case 'TSUndefinedKeyword':
      return 'undefined';
    case 'TSNeverKeyword':
      return 'never';
    case 'TSTypeReference': {
      const name = extractCalleeName(unwrapped.typeName) || 'Type';
      if (Array.isArray(unwrapped.typeParameters?.params) && unwrapped.typeParameters.params.length > 0) {
        const inner = unwrapped.typeParameters.params
          .slice(0, 3)
          .map((p: AnyNode) => formatTsType(p) || 'T')
          .join(', ');
        return `${name}<${inner}>`;
      }
      return name;
    }
    case 'TSArrayType':
      return `${formatTsType(unwrapped.elementType) || 'any'}[]`;
    case 'TSUnionType':
      return (unwrapped.types || [])
        .slice(0, 4)
        .map((t: AnyNode) => formatTsType(t) || 'unknown')
        .join(' | ');
    case 'TSIntersectionType':
      return (unwrapped.types || [])
        .slice(0, 3)
        .map((t: AnyNode) => formatTsType(t) || 'unknown')
        .join(' & ');
    case 'TSFunctionType':
      return '(...) => ...';
    case 'TSTypeLiteral':
      return '{ ... }';
    default:
      return undefined;
  }
}

function extractParamInfo(param: AnyNode): { name: string; type?: string } {
  if (!param) return { name: 'arg' };
  if (param.type === 'TSParameterProperty') {
    return extractParamInfo(param.parameter);
  }
  if (param.type === 'Identifier') {
    return { name: param.name, type: formatTsType(param.typeAnnotation) };
  }
  if (param.type === 'AssignmentPattern') {
    return extractParamInfo(param.left);
  }
  if (param.type === 'RestElement') {
    const inner = extractParamInfo(param.argument);
    return { name: `...${inner.name}`, type: inner.type };
  }
  if (param.type === 'ObjectPattern') {
    return { name: '{ ... }', type: formatTsType(param.typeAnnotation) };
  }
  if (param.type === 'ArrayPattern') {
    return { name: '[ ... ]', type: formatTsType(param.typeAnnotation) };
  }
  return { name: 'param' };
}

function getStringLiteral(node: AnyNode | null | undefined): string | null {
  if (!node) return null;
  if (node.type === 'StringLiteral') return String(node.value);
  if (node.type === 'TemplateLiteral' && node.quasis?.length === 1) {
    return String(node.quasis[0]?.value?.cooked || node.quasis[0]?.value?.raw || '');
  }
  return null;
}

function getDecorators(node: AnyNode): string[] {
  if (!Array.isArray(node.decorators)) return [];
  return node.decorators
    .map((d: AnyNode) => {
      if (d.expression?.type === 'CallExpression') {
        return extractCalleeName(d.expression.callee);
      }
      return extractCalleeName(d.expression);
    })
    .filter(Boolean);
}

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'all']);
const DB_READ_METHODS = new Set([
  'find',
  'findOne',
  'findById',
  'findMany',
  'findUnique',
  'findFirst',
  'count',
  'countDocuments',
  'aggregate',
  'select',
]);
const DB_WRITE_METHODS = new Set([
  'create',
  'insertMany',
  'save',
  'updateOne',
  'updateMany',
  'findByIdAndUpdate',
  'findOneAndUpdate',
  'deleteOne',
  'deleteMany',
  'findByIdAndDelete',
  'upsert',
  'update',
  'delete',
]);
const ANGULAR_HOOKS = new Set([
  'ngOnInit',
  'ngOnChanges',
  'ngDoCheck',
  'ngAfterContentInit',
  'ngAfterContentChecked',
  'ngAfterViewInit',
  'ngAfterViewChecked',
  'ngOnDestroy',
]);

function collectFunctionDetails(fnNode: AnyNode): {
  calls: string[];
  variablesUsed: string[];
  instantiates: string[];
} {
  const calls = new Set<string>();
  const variablesUsed = new Set<string>();
  const instantiates = new Set<string>();

  walkAst(fnNode.body, (n, parent) => {
    if (n.type === 'CallExpression' || n.type === 'OptionalCallExpression') {
      const callee = extractCalleeName(n.callee);
      if (callee && !callee.startsWith('console.')) {
        calls.add(callee);
      }
    } else if (n.type === 'NewExpression') {
      const cls = extractCalleeName(n.callee);
      if (cls) instantiates.add(cls);
    } else if (n.type === 'Identifier') {
      if (
        parent &&
        ((parent.type === 'MemberExpression' && parent.property === n && !parent.computed) ||
          (parent.type === 'VariableDeclarator' && parent.id === n) ||
          (parent.type === 'FunctionDeclaration' && parent.id === n))
      ) {
        return;
      }
      if (n.name && n.name.length > 1 && !['undefined', 'null', 'true', 'false'].includes(n.name)) {
        variablesUsed.add(n.name);
      }
    }
  });

  return {
    calls: Array.from(calls).slice(0, 35),
    variablesUsed: Array.from(variablesUsed).slice(0, 35),
    instantiates: Array.from(instantiates).slice(0, 20),
  };
}

function parseJsTsAst(filePath: string, content: string, hash: string, language: string, lines: number): FileAstSummary {
  const lower = filePath.toLowerCase();
  const plugins: ParserPlugin[] = ['decorators-legacy', 'exportDefaultFrom'];

  if (lower.endsWith('.tsx')) {
    plugins.push('typescript', 'jsx');
  } else if (lower.endsWith('.ts') || lower.endsWith('.mts') || lower.endsWith('.cts')) {
    plugins.push('typescript');
  } else {
    plugins.push('jsx');
  }

  let ast: AnyNode;
  try {
    ast = parse(content, {
      sourceType: 'unambiguous',
      errorRecovery: true,
      plugins,
    }) as unknown as AnyNode;
  } catch (err) {
    return {
      filePath,
      language,
      lines,
      hash,
      content,
      parseError: err instanceof Error ? err.message : 'AST parse failed',
      imports: [],
      exports: [],
      functions: [],
      classes: [],
      objects: [],
      variables: [],
      endpoints: [],
      httpCalls: [],
      dbModels: [],
      dbOps: [],
      socketEvents: [],
      workers: [],
      accesses: [],
      decoratorsUsed: [],
    };
  }

  const imports: ParsedImport[] = [];
  const exports: ParsedExport[] = [];
  const functions: ParsedFunction[] = [];
  const classes: ParsedClass[] = [];
  const objects: ParsedObject[] = [];
  const variables: ParsedVariable[] = [];
  const endpoints: ParsedEndpoint[] = [];
  const httpCalls: ParsedHttpCall[] = [];
  const dbModels: ParsedDbModel[] = [];
  const dbOps: ParsedDbOp[] = [];
  const socketEvents: ParsedSocketEvent[] = [];
  const workers: ParsedWorker[] = [];
  const accesses: IdentifierAccess[] = [];
  const decoratorsUsed = new Set<string>();

  const referencedIdentifiers = new Set<string>();
  const importedSpecNodes = new Set<AnyNode>();

  // Pass 1: collect all identifier usages outside import declarations to detect unused imports accurately
  walkAst(ast.program, (node, parent) => {
    if (
      node.type === 'ImportSpecifier' ||
      node.type === 'ImportDefaultSpecifier' ||
      node.type === 'ImportNamespaceSpecifier'
    ) {
      if (node.local) importedSpecNodes.add(node.local);
      return;
    }
    if (node.type === 'Identifier' && !importedSpecNodes.has(node)) {
      if (parent?.type === 'MemberExpression' && parent.property === node && !parent.computed) {
        return;
      }
      if (parent?.type === 'ObjectProperty' && parent.key === node && !parent.shorthand && !parent.computed) {
        return;
      }
      if (parent?.type === 'TSTypeReference' || parent?.type === 'TSExpressionWithTypeArguments') {
        referencedIdentifiers.add(node.name);
        accesses.push({ name: node.name, line: node.loc?.start?.line || 1, access: 'type' });
        return;
      }
      referencedIdentifiers.add(node.name);
      const isWrite =
        (parent?.type === 'AssignmentExpression' && parent.left === node) ||
        parent?.type === 'UpdateExpression';
      accesses.push({
        name: node.name,
        line: node.loc?.start?.line || 1,
        access: isWrite ? 'write' : 'read',
      });
    } else if (node.type === 'JSXIdentifier') {
      referencedIdentifiers.add(node.name);
      accesses.push({ name: node.name, line: node.loc?.start?.line || 1, access: 'read' });
    }
  });

  // Helper to record function-like nodes
  const recordFunction = (
    name: string,
    fnNode: AnyNode,
    exported: boolean,
    kind: 'function' | 'method' | 'hook' = 'function',
    className?: string
  ) => {
    const line = fnNode.loc?.start?.line || 1;
    const endLine = fnNode.loc?.end?.line || line;
    const isHook = /^use[A-Z]/.test(name) || ANGULAR_HOOKS.has(name);
    const resolvedKind = kind === 'method' ? 'method' : isHook ? 'hook' : 'function';
    const details = collectFunctionDetails(fnNode);

    functions.push({
      name,
      kind: resolvedKind,
      className,
      line,
      endLine,
      parameters: Array.isArray(fnNode.params) ? fnNode.params.map(extractParamInfo) : [],
      returnType: formatTsType(fnNode.returnType),
      exported,
      isAsync: Boolean(fnNode.async),
      isHook,
      calls: details.calls,
      variablesUsed: details.variablesUsed,
      instantiates: details.instantiates,
    });
  };

  // Pass 2: Top-level declarations + deep pattern traversal
  const bodyNodes: AnyNode[] = Array.isArray(ast.program?.body) ? ast.program.body : [];

  const processDeclaration = (decl: AnyNode, exported: boolean) => {
    if (!decl) return;
    if (decl.type === 'FunctionDeclaration' && decl.id?.name) {
      recordFunction(decl.id.name, decl, exported, 'function');
      if (exported) exports.push({ name: decl.id.name, kind: 'function', line: decl.loc?.start?.line || 1 });
    } else if (decl.type === 'ClassDeclaration' && decl.id?.name) {
      const decs = getDecorators(decl);
      decs.forEach((d) => decoratorsUsed.add(d));
      const properties: ParsedClass['properties'] = [];
      const constructorParams: ParsedClass['constructorParams'] = [];
      const methods: string[] = [];

      const classLine = decl.loc?.start?.line || 1;
      const classEnd = decl.loc?.end?.line || classLine;

      for (const member of decl.body?.body || []) {
        if (member.type === 'ClassProperty' || member.type === 'PropertyDefinition') {
          const propName = member.key?.name || member.key?.value;
          if (propName) {
            properties.push({
              name: String(propName),
              type: formatTsType(member.typeAnnotation),
              visibility: member.accessibility || undefined,
            });
          }
        } else if (member.type === 'ClassMethod' || member.type === 'MethodDefinition') {
          const mName = String(member.key?.name || member.key?.value || '');
          const mDecs = getDecorators(member);
          mDecs.forEach((d) => decoratorsUsed.add(d));
          if (member.kind === 'constructor' || mName === 'constructor') {
            for (const p of member.params || []) {
              constructorParams.push(extractParamInfo(p));
            }
          } else if (mName) {
            methods.push(mName);
            recordFunction(`${decl.id.name}.${mName}`, member, exported, 'method', decl.id.name);

            // Detect NestJS / decorator routes on class methods (@Get('/path'), @Post(...))
            for (const md of member.decorators || []) {
              const dName = extractCalleeName(md.expression?.callee || md.expression).toLowerCase();
              if (HTTP_METHODS.has(dName)) {
                const routeArg = getStringLiteral(md.expression?.arguments?.[0]) || '/';
                endpoints.push({
                  method: dName.toUpperCase(),
                  path: routeArg,
                  line: member.loc?.start?.line || classLine,
                  middlewares: [],
                  handlers: [`${decl.id.name}.${mName}`],
                  framework: 'nestjs',
                });
              }
            }
          }
        }
      }

      classes.push({
        name: decl.id.name,
        line: classLine,
        endLine: classEnd,
        decorators: decs,
        extendsClass: decl.superClass ? extractCalleeName(decl.superClass) : undefined,
        implementsInterfaces: Array.isArray(decl.implements)
          ? decl.implements.map((imp: AnyNode) => extractCalleeName(imp.expression || imp.id)).filter(Boolean)
          : [],
        properties,
        constructorParams,
        methods,
        exported,
      });

      if (exported) exports.push({ name: decl.id.name, kind: 'class', line: classLine });
    } else if (decl.type === 'VariableDeclaration') {
      const isConst = decl.kind === 'const';
      for (const declarator of decl.declarations || []) {
        if (declarator.id?.type !== 'Identifier') continue;
        const name = String(declarator.id.name);
        const init = declarator.init;
        const line = declarator.loc?.start?.line || decl.loc?.start?.line || 1;
        const endLine = declarator.loc?.end?.line || line;

        if (exported) exports.push({ name, kind: isConst ? 'constant' : 'variable', line });

        if (init && (init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression')) {
          recordFunction(name, init, exported, 'function');
        } else if (init && init.type === 'ObjectExpression') {
          const props: string[] = [];
          const objMethods: string[] = [];
          for (const prop of init.properties || []) {
            const pKey = prop.key?.name || prop.key?.value;
            if (!pKey) continue;
            if (
              prop.type === 'ObjectMethod' ||
              prop.value?.type === 'ArrowFunctionExpression' ||
              prop.value?.type === 'FunctionExpression'
            ) {
              objMethods.push(String(pKey));
              if (prop.type === 'ObjectMethod') {
                recordFunction(`${name}.${pKey}`, prop, exported, 'method', name);
              } else if (prop.value) {
                recordFunction(`${name}.${pKey}`, prop.value, exported, 'method', name);
              }
            } else {
              props.push(String(pKey));
            }
          }
          objects.push({
            name,
            line,
            endLine,
            properties: props,
            methods: objMethods,
            exported,
          });
        } else {
          // Detect Mongoose Schema / Model definitions (`const UserSchema = new Schema(...)` or `mongoose.model('User', ...)`)
          if (init?.type === 'CallExpression') {
            const callee = extractCalleeName(init.callee);
            if (/model$/i.test(callee) && init.arguments?.[0]) {
              const modelStr = getStringLiteral(init.arguments[0]);
              if (modelStr) {
                dbModels.push({ name: modelStr, line, orm: 'mongoose' });
              }
            }
          } else if (init?.type === 'NewExpression') {
            const callee = extractCalleeName(init.callee);
            if (/^(mongoose\.)?Schema$/i.test(callee)) {
              dbModels.push({ name: name.replace(/Schema$/i, '') || name, line, orm: 'mongoose' });
            } else if (/Worker|Queue/i.test(callee)) {
              workers.push({
                name,
                kind: /Queue/i.test(callee) ? 'queue' : 'worker',
                line,
              });
            }
          }

          variables.push({
            name,
            kind: isConst ? 'constant' : 'variable',
            line,
            dataType: formatTsType(declarator.id.typeAnnotation),
            scope: 'module',
            exported,
          });
        }
      }
    } else if (decl.type === 'TSInterfaceDeclaration' && decl.id?.name) {
      const line = decl.loc?.start?.line || 1;
      variables.push({
        name: decl.id.name,
        kind: 'interface',
        line,
        scope: 'module',
        exported,
      });
      if (exported) exports.push({ name: decl.id.name, kind: 'interface', line });
    } else if (decl.type === 'TSTypeAliasDeclaration' && decl.id?.name) {
      const line = decl.loc?.start?.line || 1;
      variables.push({
        name: decl.id.name,
        kind: 'type',
        line,
        dataType: formatTsType(decl.typeAnnotation),
        scope: 'module',
        exported,
      });
      if (exported) exports.push({ name: decl.id.name, kind: 'type', line });
    } else if (decl.type === 'TSEnumDeclaration' && decl.id?.name) {
      const line = decl.loc?.start?.line || 1;
      variables.push({
        name: decl.id.name,
        kind: 'enum',
        line,
        scope: 'module',
        exported,
      });
      if (exported) exports.push({ name: decl.id.name, kind: 'enum', line });
    }
  };

  for (const stmt of bodyNodes) {
    if (stmt.type === 'ImportDeclaration') {
      const source = String(stmt.source?.value || '');
      const line = stmt.loc?.start?.line || 1;
      const specs: ParsedImport['specifiers'] = [];
      for (const s of stmt.specifiers || []) {
        const local = String(s.local?.name || '');
        const imported =
          s.type === 'ImportDefaultSpecifier'
            ? 'default'
            : s.type === 'ImportNamespaceSpecifier'
              ? '*'
              : String(s.imported?.name || s.imported?.value || local);
        const isTypeOnly = stmt.importKind === 'type' || s.importKind === 'type';
        specs.push({
          local,
          imported,
          line,
          isTypeOnly,
          used: referencedIdentifiers.has(local),
        });
      }
      imports.push({ source, line, specifiers: specs });
    } else if (stmt.type === 'ExportNamedDeclaration') {
      if (stmt.declaration) {
        processDeclaration(stmt.declaration, true);
      }
      for (const spec of stmt.specifiers || []) {
        const expName = String(spec.exported?.name || spec.exported?.value || '');
        if (expName) {
          exports.push({
            name: expName,
            kind: 'reexport',
            line: stmt.loc?.start?.line || 1,
            reexportSource: stmt.source?.value ? String(stmt.source.value) : undefined,
          });
        }
      }
      if (stmt.source?.value) {
        imports.push({
          source: String(stmt.source.value),
          line: stmt.loc?.start?.line || 1,
          specifiers: [],
        });
      }
    } else if (stmt.type === 'ExportAllDeclaration' && stmt.source?.value) {
      imports.push({
        source: String(stmt.source.value),
        line: stmt.loc?.start?.line || 1,
        specifiers: [],
      });
      exports.push({
        name: '*',
        kind: 'reexport_all',
        line: stmt.loc?.start?.line || 1,
        reexportSource: String(stmt.source.value),
      });
    } else if (stmt.type === 'ExportDefaultDeclaration') {
      const decl = stmt.declaration;
      if (decl?.type === 'FunctionDeclaration') {
        recordFunction(decl.id?.name || 'default', decl, true, 'function');
        exports.push({ name: decl.id?.name || 'default', kind: 'function', line: decl.loc?.start?.line || 1 });
      } else if (decl?.type === 'ClassDeclaration') {
        processDeclaration(decl, true);
      } else if (decl?.type === 'Identifier') {
        exports.push({ name: decl.name, kind: 'default', line: stmt.loc?.start?.line || 1 });
      } else {
        exports.push({ name: 'default', kind: 'default', line: stmt.loc?.start?.line || 1 });
      }
    } else {
      processDeclaration(stmt, false);
    }
  }

  // Pass 3: Deep semantic AST inspection (Express routes, HTTP calls, DB ops, Socket events, CJS require, Workers, scoped vars)
  const findEnclosingName = (ancestors: AnyNode[]): string | undefined => {
    for (let i = ancestors.length - 1; i >= 0; i--) {
      const a = ancestors[i];
      if (a.type === 'FunctionDeclaration' && a.id?.name) return a.id.name;
      if (a.type === 'ClassMethod' && a.key?.name) return a.key.name;
      if (a.type === 'VariableDeclarator' && a.id?.name) return a.id.name;
    }
    return undefined;
  };

  const traverseWithAncestors = (node: AnyNode, ancestors: AnyNode[]) => {
    if (!isNode(node)) return;
    const line = node.loc?.start?.line || 1;
    const callerName = findEnclosingName(ancestors);

    if (node.type === 'CallExpression' || node.type === 'OptionalCallExpression') {
      const callee = extractCalleeName(node.callee);
      const parts = callee.split('.');
      const methodProp = parts[parts.length - 1] || '';
      const methodLower = methodProp.toLowerCase();
      const receiver = parts.slice(0, -1).join('.');
      const args = node.arguments || [];

      // CommonJS require('...') or dynamic import('...')
      if ((callee === 'require' || node.callee?.type === 'Import') && args[0]) {
        const src = getStringLiteral(args[0]);
        if (src) {
          imports.push({ source: src, line, specifiers: [] });
        }
      }

      // Express / Router endpoints: router.get('/path', mw, handler)
      if (
        (HTTP_METHODS.has(methodLower) || methodLower === 'use') &&
        /(router|app|apirouter|api)/i.test(receiver) &&
        args.length >= 2
      ) {
        const routePath = getStringLiteral(args[0]);
        if (routePath) {
          const fnArgs = args.slice(1).map((a: AnyNode) => {
            if (a.type === 'Identifier') return a.name;
            if (a.type === 'MemberExpression') return extractCalleeName(a);
            if (a.type === 'ArrowFunctionExpression' || a.type === 'FunctionExpression') return callerName || 'inlineHandler';
            return '';
          }).filter(Boolean);
          const middlewares = fnArgs.length > 1 ? fnArgs.slice(0, -1) : [];
          const handlers = fnArgs.length > 0 ? [fnArgs[fnArgs.length - 1]] : [];
          endpoints.push({
            method: methodLower === 'use' ? 'USE' : methodLower.toUpperCase(),
            path: routePath,
            line,
            middlewares,
            handlers,
            framework: 'express',
          });
        }
      }

      // Frontend HTTP calls: fetch('/api/...'), axios.get('/...'), this.http.post('/...'), request('/api/...')
      if (callee === 'fetch' || callee === 'request' || /^(axios|http|this\.http)$/i.test(receiver)) {
        const urlStr = getStringLiteral(args[0]);
        if (urlStr && (urlStr.startsWith('/api') || urlStr.startsWith('http') || urlStr.includes('/'))) {
          httpCalls.push({
            method: HTTP_METHODS.has(methodLower) ? methodLower.toUpperCase() : 'GET',
            url: urlStr,
            line,
            callerName,
            client: callee === 'fetch' ? 'fetch' : /axios/i.test(receiver) ? 'axios' : /http/i.test(receiver) ? 'angular_http' : 'other',
          });
        }
      }

      // Mongoose / DB operations: User.findOne(...), MongooseModels.Repository.find(...)
      if (DB_READ_METHODS.has(methodProp) || DB_WRITE_METHODS.has(methodProp)) {
        const modelCandidate = parts.length >= 2 ? parts[parts.length - 2] : '';
        if (modelCandidate && /^[A-Z]/.test(modelCandidate)) {
          dbOps.push({
            modelName: modelCandidate,
            operation: DB_READ_METHODS.has(methodProp) ? 'read' : 'write',
            method: methodProp,
            line,
            callerName,
          });
        } else if (methodProp === 'query' || methodProp === 'execute') {
          dbOps.push({
            modelName: receiver || 'Database',
            operation: 'query',
            method: methodProp,
            line,
            callerName,
          });
        }
      }

      // Socket.io / EventEmitter: socket.on('event', ...), io.emit('event', ...)
      if ((methodLower === 'on' || methodLower === 'once' || methodLower === 'emit' || methodLower === 'addeventlistener') && args[0]) {
        if (/(socket|io|ws|emitter|bus|events)/i.test(receiver)) {
          const ev = getStringLiteral(args[0]);
          if (ev) {
            socketEvents.push({
              eventName: ev,
              direction: methodLower === 'emit' ? 'emit' : 'listen',
              line,
              callerName,
            });
          }
        }
      }

      // Background jobs: cron.schedule, agenda.define
      if (/^(cron\.schedule|agenda\.define|bull|queue\.process)$/i.test(callee)) {
        const jobName = getStringLiteral(args[0]) || callee;
        workers.push({ name: jobName, kind: callee.includes('cron') ? 'cron' : 'worker', line });
      }
    } else if (node.type === 'NewExpression') {
      const cls = extractCalleeName(node.callee);
      if (/^(mongoose\.)?model$/i.test(cls) && node.arguments?.[0]) {
        const mName = getStringLiteral(node.arguments[0]);
        if (mName) dbModels.push({ name: mName, line, orm: 'mongoose' });
      }
    }

    const nextAncestors = [...ancestors, node];
    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'start' || key === 'end' || key === 'tokens' || key === 'comments' || key === 'extra') {
        continue;
      }
      const child = node[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          if (isNode(item)) traverseWithAncestors(item, nextAncestors);
        }
      } else if (isNode(child)) {
        traverseWithAncestors(child, nextAncestors);
      }
    }
  };

  traverseWithAncestors(ast.program, []);

  return {
    filePath,
    language,
    lines,
    hash,
    content,
    imports,
    exports,
    functions,
    classes,
    objects,
    variables,
    endpoints,
    httpCalls,
    dbModels,
    dbOps,
    socketEvents,
    workers,
    accesses,
    decoratorsUsed: Array.from(decoratorsUsed),
  };
}

function parsePythonLightweight(filePath: string, content: string, hash: string, lines: number): FileAstSummary {
  const imports: ParsedImport[] = [];
  const functions: ParsedFunction[] = [];
  const classes: ParsedClass[] = [];
  const endpoints: ParsedEndpoint[] = [];
  const srcLines = content.split('\n');

  srcLines.forEach((raw, idx) => {
    const lineNum = idx + 1;
    const trimmed = raw.trim();
    const impMatch = trimmed.match(/^(?:from\s+([^\s]+)\s+import\s+(.+)|import\s+([^\s]+))/);
    if (impMatch) {
      const src = impMatch[1] || impMatch[3] || '';
      const specs = (impMatch[2] || '')
        .split(',')
        .map((s) => s.trim().split(/\s+as\s+/)[0])
        .filter(Boolean)
        .map((local) => ({ local, imported: local, line: lineNum, isTypeOnly: false, used: true }));
      imports.push({ source: src, line: lineNum, specifiers: specs });
    }
    const clsMatch = trimmed.match(/^class\s+([A-Za-z_][A-Za-z0-9_]*)(?:\(([^)]*)\))?:/);
    if (clsMatch) {
      classes.push({
        name: clsMatch[1],
        line: lineNum,
        endLine: lineNum,
        decorators: [],
        extendsClass: clsMatch[2]?.split(',')[0]?.trim() || undefined,
        implementsInterfaces: [],
        properties: [],
        constructorParams: [],
        methods: [],
        exported: true,
      });
    }
    const defMatch = trimmed.match(/^(?:async\s+)?def\s+([A-Za-z_][A-Za-z0-9_]*)\(([^)]*)\)/);
    if (defMatch) {
      const params = defMatch[2]
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p && p !== 'self')
        .map((p) => ({ name: p.split(':')[0].trim(), type: p.split(':')[1]?.trim() }));
      functions.push({
        name: defMatch[1],
        kind: 'function',
        line: lineNum,
        endLine: lineNum,
        parameters: params,
        exported: !defMatch[1].startsWith('_'),
        isAsync: trimmed.startsWith('async '),
        isHook: false,
        calls: [],
        variablesUsed: [],
        instantiates: [],
      });
    }
    const routeMatch = trimmed.match(/^@(?:app|router|bp)\.(get|post|put|patch|delete|route)\(\s*['"]([^'"]+)['"]/i);
    if (routeMatch) {
      endpoints.push({
        method: routeMatch[1].toUpperCase(),
        path: routeMatch[2],
        line: lineNum,
        middlewares: [],
        handlers: [],
        framework: 'fastapi',
      });
    }
  });

  return {
    filePath,
    language: 'Python',
    lines,
    hash,
    content,
    imports,
    exports: [],
    functions,
    classes,
    objects: [],
    variables: [],
    endpoints,
    httpCalls: [],
    dbModels: [],
    dbOps: [],
    socketEvents: [],
    workers: [],
    accesses: [],
    decoratorsUsed: [],
  };
}

function parseSchemaFile(filePath: string, content: string, hash: string, language: string, lines: number): FileAstSummary {
  const dbModels: ParsedDbModel[] = [];
  const srcLines = content.split('\n');
  srcLines.forEach((line, idx) => {
    const prismaMatch = line.match(/^\s*model\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/);
    if (prismaMatch) {
      dbModels.push({ name: prismaMatch[1], line: idx + 1, orm: 'prisma' });
    }
    const sqlMatch = line.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?([A-Za-z_][A-Za-z0-9_]*)[`"']?/i);
    if (sqlMatch) {
      dbModels.push({ name: sqlMatch[1], line: idx + 1, orm: 'sql' });
    }
  });

  return {
    filePath,
    language,
    lines,
    hash,
    content,
    imports: [],
    exports: [],
    functions: [],
    classes: [],
    objects: [],
    variables: [],
    endpoints: [],
    httpCalls: [],
    dbModels,
    dbOps: [],
    socketEvents: [],
    workers: [],
    accesses: [],
    decoratorsUsed: [],
  };
}

export function parseRepositoryFilesWithCache(
  repositoryId: string,
  files: StoredRepositoryFile[]
): {
  parsedFiles: FileAstSummary[];
  reusedFilesCount: number;
  parsedFilesCount: number;
  combinedHash: string;
} {
  const parsedFiles: FileAstSummary[] = [];
  let reusedFilesCount = 0;
  let parsedFilesCount = 0;
  const hashParts: string[] = [];

  for (const file of files) {
    const content = reconstructFileContent(file.chunks);
    const hash = crypto.createHash('sha256').update(`${file.path}\n${content}`).digest('hex');
    hashParts.push(`${file.path}:${hash}`);
    const cacheKey = `${repositoryId}::${file.path}::${hash}`;
    const cached = astFileCache.get(cacheKey);
    if (cached) {
      parsedFiles.push(cached);
      reusedFilesCount++;
      continue;
    }

    const lower = file.path.toLowerCase();
    let summary: FileAstSummary;
    if (/\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/.test(lower)) {
      summary = parseJsTsAst(file.path, content, hash, file.language, file.lines);
      parsedFilesCount++;
    } else if (lower.endsWith('.py')) {
      summary = parsePythonLightweight(file.path, content, hash, file.lines);
      parsedFilesCount++;
    } else if (lower.endsWith('.prisma') || lower.endsWith('.sql')) {
      summary = parseSchemaFile(file.path, content, hash, file.language, file.lines);
      parsedFilesCount++;
    } else {
      summary = {
        filePath: file.path,
        language: file.language,
        lines: file.lines,
        hash,
        content,
        imports: [],
        exports: [],
        functions: [],
        classes: [],
        objects: [],
        variables: [],
        endpoints: [],
        httpCalls: [],
        dbModels: [],
        dbOps: [],
        socketEvents: [],
        workers: [],
        accesses: [],
        decoratorsUsed: [],
      };
    }

    astFileCache.set(cacheKey, summary);
    parsedFiles.push(summary);
  }

  const combinedHash = crypto.createHash('sha256').update(hashParts.sort().join('|')).digest('hex');
  return { parsedFiles, reusedFilesCount, parsedFilesCount, combinedHash };
}
