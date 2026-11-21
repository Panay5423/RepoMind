import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, ChevronRight, FileCode2, Folder } from 'lucide-react';
import type { AnalysisDTO, DirectoryNode, RepositoryDTO, RepositoryFileDTO } from '../../../shared/types.ts';
import { InteractiveCard, RM_EASE } from '../ui/PremiumPrimitives.tsx';

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
        className="w-full flex items-center justify-between gap-2 py-1.5 px-2.5 rounded-lg text-left text-xs text-[#334155] hover:bg-[#EFF6FF] hover:text-[#2563EB] transition-colors"
        style={{ paddingLeft: `${depth * 14 + 10}px` }}
      >
        <span className="flex items-center gap-2 min-w-0">
          <FileCode2 className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
          <span className="font-mono truncate">{node.name}</span>
        </span>
        <span className="text-[11px] text-[#64748B] font-mono shrink-0">{node.language}</span>
      </button>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg text-left text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC] transition-colors"
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
        )}
        <Folder className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
        <span className="font-mono truncate">{node.name}</span>
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.16, ease: RM_EASE }}
            className="overflow-hidden"
          >
            {node.children?.map((child) => (
              <TreeBranch
                key={child.path}
                node={child}
                depth={depth + 1}
                onSelectFile={onSelectFile}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
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
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: RM_EASE }}
      className="space-y-6"
    >
      {/* Top Summary Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <InteractiveCard hoverLift={false} className="p-6">
            <h2 className="font-display text-[17px] font-bold text-[#0B1F3A]">
              Project Overview
            </h2>
            <p className="mt-3 text-[13px] text-[#334155] leading-relaxed whitespace-pre-line">
              {analysis.projectOverview}
            </p>
            {analysis.architectureOverview && (
              <>
                <h3 className="mt-6 font-display text-[15px] font-bold text-[#0B1F3A]">
                  Architecture Summary
                </h3>
                <p className="mt-2 text-[13px] text-[#334155] leading-relaxed whitespace-pre-line">
                  {analysis.architectureOverview}
                </p>
              </>
            )}
          </InteractiveCard>

          {/* Important Modules */}
          <InteractiveCard hoverLift={false} className="overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC]/80">
              <h2 className="font-display text-[15px] font-bold text-[#0F172A]">
                Major Modules &amp; Responsibilities
              </h2>
            </div>
            <div className="divide-y divide-[#F1F5F9]">
              {analysis.importantModules.map((mod, idx) => (
                <motion.div
                  key={`${mod.name}-${mod.path}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: Math.min(idx * 0.03, 0.25) }}
                  className="p-5 hover:bg-[#EFF6FF]/40 transition-colors"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-[14px] font-semibold text-[#0F172A]">{mod.name}</h3>
                      <p className="text-[12px] font-mono text-[#2563EB] mt-0.5">{mod.path}</p>
                    </div>
                    <span className="text-[11px] font-mono text-[#64748B] capitalize">
                      Complexity: {mod.complexity}
                    </span>
                  </div>
                  <p className="mt-2 text-[13px] text-[#475569]">{mod.role}</p>
                  {mod.responsibilities.length > 0 && (
                    <ul className="mt-2.5 space-y-1 text-[12px] text-[#475569]">
                      {mod.responsibilities.map((r) => (
                        <li key={r} className="flex items-start gap-2">
                          <span className="text-[#2563EB] font-bold">·</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </motion.div>
              ))}
            </div>
          </InteractiveCard>

          {/* Dependencies */}
          <InteractiveCard hoverLift={false} className="overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC]/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="font-display text-[15px] font-bold text-[#0F172A]">
                Dependencies ({analysis.dependencies.length})
              </h2>
              <input
                type="text"
                value={depFilter}
                onChange={(e) => setDepFilter(e.target.value)}
                placeholder="Filter packages..."
                className="h-8 rounded-lg border border-[#E2E8F0] bg-white px-3 text-[12px] text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#2563EB]"
              />
            </div>
            {filteredDeps.length === 0 ? (
              <div className="p-6 text-[12px] text-[#64748B]">
                No manifest dependencies matched your filter.
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAFC] text-[#64748B] sticky top-0 border-b border-[#E2E8F0]">
                    <tr>
                      <th className="py-2.5 px-5 font-semibold">Package</th>
                      <th className="py-2.5 px-4 font-semibold">Version</th>
                      <th className="py-2.5 px-4 font-semibold">Category</th>
                      <th className="py-2.5 px-5 font-semibold">Ecosystem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {filteredDeps.map((dep, idx) => (
                      <tr key={`${dep.name}-${idx}`} className="hover:bg-[#EFF6FF]/45 transition-colors">
                        <td className="py-2.5 px-5 font-mono font-medium text-[#0F172A]">{dep.name}</td>
                        <td className="py-2.5 px-4 font-mono text-[#475569] tabular-nums">
                          {dep.version}
                        </td>
                        <td className="py-2.5 px-4 text-[#475569] capitalize">{dep.category}</td>
                        <td className="py-2.5 px-5 text-[#64748B]">{dep.ecosystem}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </InteractiveCard>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-4 space-y-6">
          <InteractiveCard hoverLift={false} className="p-5">
            <h2 className="font-display text-[14px] font-bold text-[#0F172A] mb-3">
              Technology Stack
            </h2>
            <p className="text-[13px] text-[#334155] leading-relaxed">
              {analysis.technologyStack.join(' · ') || repository.primaryLanguage}
            </p>
            {repository.languages.length > 0 && (
              <div className="mt-4 pt-4 border-t border-[#E2E8F0] space-y-2">
                {repository.languages.slice(0, 5).map((lang) => (
                  <div key={lang.language} className="flex items-center justify-between text-xs">
                    <span className="text-[#0F172A] font-medium">{lang.language}</span>
                    <span className="font-mono text-[#64748B] tabular-nums">
                      {lang.percentage}% · {lang.files} files
                    </span>
                  </div>
                ))}
              </div>
            )}
          </InteractiveCard>

          <InteractiveCard hoverLift={false} className="p-5">
            <h2 className="font-display text-[14px] font-bold text-[#0F172A] mb-3">
              Complexity Indicators
            </h2>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <p className="text-[#64748B]">Avg File Lines</p>
                <p className="mt-1 font-mono text-base font-bold text-[#0B1F3A] tabular-nums">
                  {analysis.complexityIndicators.averageFileLines}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <p className="text-[#64748B]">Largest File</p>
                <p className="mt-1 font-mono text-base font-bold text-[#0B1F3A] tabular-nums">
                  {analysis.complexityIndicators.maxFileLines}L
                </p>
              </div>
            </div>
            {analysis.complexityIndicators.highComplexityFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-[11px] font-mono text-[#64748B]">Highest branching density</p>
                {analysis.complexityIndicators.highComplexityFiles.slice(0, 4).map((f) => (
                  <button
                    key={f.path}
                    type="button"
                    onClick={() => onOpenFile(f.path)}
                    className="w-full flex items-center justify-between gap-2 text-left text-xs py-1 text-[#334155] hover:text-[#2563EB] transition-colors"
                  >
                    <span className="font-mono truncate">{f.path}</span>
                    <span className="font-mono text-[#64748B] tabular-nums shrink-0">
                      {f.lines}L
                    </span>
                  </button>
                ))}
              </div>
            )}
          </InteractiveCard>

          <InteractiveCard hoverLift={false} className="p-5">
            <h2 className="font-display text-[14px] font-bold text-[#0F172A] mb-3">
              Key Entrypoints &amp; Files
            </h2>
            <div className="space-y-3">
              {analysis.importantFiles.map((item) => (
                <div key={item.path} className="text-xs">
                  <button
                    type="button"
                    onClick={() => onOpenFile(item.path)}
                    className="font-mono font-medium text-[#2563EB] hover:text-[#1D4ED8] underline underline-offset-2 text-left break-all"
                  >
                    {item.path}
                  </button>
                  <p className="text-[#64748B] mt-0.5">{item.reason}</p>
                </div>
              ))}
            </div>
          </InteractiveCard>

          <InteractiveCard hoverLift={false} className="overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#E2E8F0] bg-[#F8FAFC]/80 flex items-center justify-between">
              <h2 className="font-display text-[14px] font-bold text-[#0F172A]">
                Directory Explorer
              </h2>
              <span className="text-[11px] font-mono text-[#64748B] tabular-nums">
                {files.length} files
              </span>
            </div>
            <div className="max-h-96 overflow-y-auto p-2">
              {analysis.directoryTree.map((node) => (
                <TreeBranch key={node.path} node={node} depth={0} onSelectFile={onOpenFile} />
              ))}
            </div>
          </InteractiveCard>
        </div>
      </div>
    </motion.div>
  );
}
