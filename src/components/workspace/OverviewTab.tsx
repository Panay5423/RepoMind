import { useState } from 'react';
import { ChevronDown, ChevronRight, FileCode2, Folder } from 'lucide-react';
import type { AnalysisDTO, DirectoryNode, RepositoryDTO, RepositoryFileDTO } from '../../../shared/types.ts';

interface OverviewTabProps {
  repository: RepositoryDTO;
  analysis: AnalysisDTO;
  files: RepositoryFileDTO[];
  onOpenFile: (path: string) => void;
}

function TreeBranch({
  node,
  depth,
  onSelectFile,
}: {
  node: DirectoryNode;
  depth: number;
  onSelectFile: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 1);

  if (node.type === 'file') {
    return (
      <button
        type="button"
        onClick={() => onSelectFile(node.path)}
        className="w-full flex items-center justify-between gap-2 py-1.5 px-2 rounded-md text-left text-xs text-slate-300 hover:bg-white/[0.04] hover:text-white transition-colors"
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
        <span className="flex items-center gap-2 min-w-0">
          <FileCode2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span className="font-mono truncate">{node.name}</span>
        </span>
        <span className="text-[11px] text-slate-500 font-mono shrink-0">{node.language}</span>
      </button>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-1.5 py-1.5 px-2 rounded-md text-left text-xs font-medium text-slate-200 hover:bg-white/[0.04] transition-colors"
        style={{ paddingLeft: `${depth * 14 + 6}px` }}
      >
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        )}
        <Folder className="w-3.5 h-3.5 text-blue-400 shrink-0" />
        <span className="font-mono truncate">{node.name}</span>
      </button>
      {expanded &&
        node.children?.map((child) => (
          <TreeBranch
            key={child.path}
            node={child}
            depth={depth + 1}
            onSelectFile={onSelectFile}
          />
        ))}
    </div>
  );
}

export function OverviewTab({ repository, analysis, files, onOpenFile }: OverviewTabProps) {
  const [depFilter, setDepFilter] = useState('');

  const filteredDeps = analysis.dependencies.filter(
    (d) =>
      !depFilter ||
      d.name.toLowerCase().includes(depFilter.toLowerCase()) ||
      d.category.toLowerCase().includes(depFilter.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Summary Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <section className="rounded-xl border border-white/[0.08] bg-[#111827] p-6">
            <h2 className="font-display text-lg font-semibold text-white">Project Overview</h2>
            <p className="mt-3 text-sm text-slate-300 leading-relaxed whitespace-pre-line">
              {analysis.projectOverview}
            </p>
            {analysis.architectureOverview && (
              <>
                <h3 className="mt-6 font-display text-base font-semibold text-white">
                  Architecture Summary
                </h3>
                <p className="mt-2 text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                  {analysis.architectureOverview}
                </p>
              </>
            )}
          </section>

          {/* Important Modules */}
          <section className="rounded-xl border border-white/[0.08] bg-[#111827] overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.08]">
              <h2 className="font-display text-base font-semibold text-white">
                Major Modules & Responsibilities
              </h2>
            </div>
            <div className="divide-y divide-white/[0.06]">
              {analysis.importantModules.map((mod) => (
                <div key={`${mod.name}-${mod.path}`} className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-white">{mod.name}</h3>
                      <p className="text-xs font-mono text-blue-400 mt-0.5">{mod.path}</p>
                    </div>
                    <span className="text-xs font-mono text-slate-400 capitalize">
                      Complexity: {mod.complexity}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{mod.role}</p>
                  {mod.responsibilities.length > 0 && (
                    <ul className="mt-2.5 space-y-1 text-xs text-slate-400">
                      {mod.responsibilities.map((r) => (
                        <li key={r} className="flex items-start gap-2">
                          <span className="text-blue-400">·</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Dependencies */}
          <section className="rounded-xl border border-white/[0.08] bg-[#111827] overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="font-display text-base font-semibold text-white">
                Dependencies ({analysis.dependencies.length})
              </h2>
              <input
                type="text"
                value={depFilter}
                onChange={(e) => setDepFilter(e.target.value)}
                placeholder="Filter packages..."
                className="rounded-lg border border-white/10 bg-[#0B0F19] px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            {filteredDeps.length === 0 ? (
              <div className="p-6 text-xs text-slate-400">
                No manifest dependencies matched your filter.
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0B0F19] text-slate-400 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-5 font-medium">Package</th>
                      <th className="py-2.5 px-4 font-medium">Version</th>
                      <th className="py-2.5 px-4 font-medium">Category</th>
                      <th className="py-2.5 px-5 font-medium">Ecosystem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {filteredDeps.map((dep, idx) => (
                      <tr key={`${dep.name}-${idx}`} className="hover:bg-white/[0.02]">
                        <td className="py-2.5 px-5 font-mono text-slate-200">{dep.name}</td>
                        <td className="py-2.5 px-4 font-mono text-slate-400 tabular-nums">
                          {dep.version}
                        </td>
                        <td className="py-2.5 px-4 text-slate-400 capitalize">{dep.category}</td>
                        <td className="py-2.5 px-5 text-slate-500">{dep.ecosystem}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Stack, Complexity, Important Files & Directory Tree */}
        <div className="lg:col-span-4 space-y-6">
          <section className="rounded-xl border border-white/[0.08] bg-[#111827] p-5">
            <h2 className="font-display text-sm font-semibold text-white mb-3">
              Technology Stack
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              {analysis.technologyStack.join(' · ') || repository.primaryLanguage}
            </p>
            {repository.languages.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/[0.08] space-y-2">
                {repository.languages.slice(0, 5).map((lang) => (
                  <div key={lang.language} className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">{lang.language}</span>
                    <span className="font-mono text-slate-400 tabular-nums">
                      {lang.percentage}% · {lang.files} files
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-white/[0.08] bg-[#111827] p-5">
            <h2 className="font-display text-sm font-semibold text-white mb-3">
              Complexity Indicators
            </h2>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-[#0B0F19] border border-white/[0.06]">
                <p className="text-slate-400">Avg File Lines</p>
                <p className="mt-1 font-mono text-base font-semibold text-white tabular-nums">
                  {analysis.complexityIndicators.averageFileLines}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-[#0B0F19] border border-white/[0.06]">
                <p className="text-slate-400">Largest File</p>
                <p className="mt-1 font-mono text-base font-semibold text-white tabular-nums">
                  {analysis.complexityIndicators.maxFileLines}L
                </p>
              </div>
            </div>
            {analysis.complexityIndicators.highComplexityFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-slate-400">Highest branching density</p>
                {analysis.complexityIndicators.highComplexityFiles.slice(0, 4).map((f) => (
                  <button
                    key={f.path}
                    type="button"
                    onClick={() => onOpenFile(f.path)}
                    className="w-full flex items-center justify-between gap-2 text-left text-xs py-1 hover:text-blue-400 transition-colors"
                  >
                    <span className="font-mono text-slate-300 truncate">{f.path}</span>
                    <span className="font-mono text-slate-500 tabular-nums shrink-0">
                      {f.lines}L
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-white/[0.08] bg-[#111827] p-5">
            <h2 className="font-display text-sm font-semibold text-white mb-3">
              Key Entrypoints & Files
            </h2>
            <div className="space-y-3">
              {analysis.importantFiles.map((item) => (
                <div key={item.path} className="text-xs">
                  <button
                    type="button"
                    onClick={() => onOpenFile(item.path)}
                    className="font-mono text-blue-400 hover:text-blue-300 underline underline-offset-2 text-left break-all"
                  >
                    {item.path}
                  </button>
                  <p className="text-slate-400 mt-0.5">{item.reason}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-white/[0.08] bg-[#111827] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/[0.08] flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-white">
                Directory Explorer
              </h2>
              <span className="text-xs font-mono text-slate-500 tabular-nums">
                {files.length} files
              </span>
            </div>
            <div className="max-h-96 overflow-y-auto p-2">
              {analysis.directoryTree.map((node) => (
                <TreeBranch key={node.path} node={node} depth={0} onSelectFile={onOpenFile} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
