import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Download, Edit3, Eye, FileText, RefreshCw, Save } from 'lucide-react';
import type { DocType, DocumentationDTO } from '../../../shared/types.ts';
import { api } from '../../lib/api.ts';
import { useToast } from '../../context/ToastContext.tsx';

interface DocsTabProps {
  repositoryId: string;
  repositoryName: string;
  initialDocs: DocumentationDTO[];
  onDocsUpdated: (docs: DocumentationDTO[]) => void;
}

const DOC_TYPES: Array<{ type: DocType; label: string; filename: string }> = [
  { type: 'readme', label: 'README.md', filename: 'README.md' },
  { type: 'architecture', label: 'Architecture Guide', filename: 'ARCHITECTURE.md' },
  { type: 'api', label: 'API Reference', filename: 'API.md' },
  { type: 'installation', label: 'Installation Guide', filename: 'INSTALL.md' },
  { type: 'environment', label: 'Environment Setup', filename: 'ENVIRONMENT.md' },
  { type: 'modules', label: 'Module Docs', filename: 'MODULES.md' },
];

export function DocsTab({
  repositoryId,
  initialDocs,
  onDocsUpdated,
}: DocsTabProps) {
  const [selectedType, setSelectedType] = useState<DocType>('readme');
  const [viewMode, setViewMode] = useState<'preview' | 'edit'>('preview');
  const [draftContent, setDraftContent] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const { notify } = useToast();

  const currentDoc = initialDocs.find((d) => d.type === selectedType) || null;
  const currentMeta = DOC_TYPES.find((d) => d.type === selectedType)!;

  useEffect(() => {
    setDraftContent(currentDoc?.content || '');
  }, [selectedType, currentDoc?.content]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await api.docs.generate(repositoryId, selectedType);
      const next = [...initialDocs.filter((d) => d.type !== selectedType), res.doc];
      onDocsUpdated(next);
      setDraftContent(res.doc.content);
      setViewMode('preview');
      notify(`Generated ${currentMeta.label}.`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Documentation generation failed.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.docs.update(repositoryId, selectedType, {
        title: currentMeta.label,
        content: draftContent,
      });
      const next = [...initialDocs.filter((d) => d.type !== selectedType), res.doc];
      onDocsUpdated(next);
      notify('Saved documentation changes.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Save failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    if (!draftContent) return;
    await navigator.clipboard.writeText(draftContent);
    notify('Copied Markdown to clipboard.', 'success');
  };

  const handleDownload = () => {
    if (!draftContent) return;
    const blob = new Blob([draftContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentMeta.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Doc Type Selector */}
      <aside className="lg:col-span-3 rounded-xl border border-white/[0.08] bg-[#111827] p-3 h-fit space-y-1">
        <p className="px-3 py-2 text-xs font-semibold text-slate-400">Documentation Suites</p>
        {DOC_TYPES.map((item) => {
          const exists = initialDocs.some((d) => d.type === item.type);
          return (
            <button
              key={item.type}
              type="button"
              onClick={() => setSelectedType(item.type)}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                selectedType === item.type
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-white/[0.04] hover:text-white'
              }`}
            >
              <span className="truncate">{item.label}</span>
              <span
                className={`text-[10px] font-mono ${
                  selectedType === item.type
                    ? 'text-blue-100'
                    : exists
                    ? 'text-emerald-400'
                    : 'text-slate-500'
                }`}
              >
                {exists ? 'Ready' : 'New'}
              </span>
            </button>
          );
        })}
      </aside>

      {/* Editor & Preview */}
      <div className="lg:col-span-9 rounded-xl border border-white/[0.08] bg-[#111827] overflow-hidden flex flex-col min-h-[580px]">
        <div className="px-5 py-3.5 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-sm font-semibold text-white">{currentMeta.label}</h2>
            <div className="inline-flex items-center gap-1 p-0.5 rounded-md bg-[#0B0F19] border border-white/[0.08]">
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium ${
                  viewMode === 'preview' ? 'bg-[#111827] text-white' : 'text-slate-400'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('edit')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium ${
                  viewMode === 'edit' ? 'bg-[#111827] text-white' : 'text-slate-400'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {currentDoc && viewMode === 'edit' && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs font-medium text-emerald-300 hover:bg-white/[0.04]"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Saving...' : 'Save'}</span>
              </button>
            )}
            {draftContent && (
              <>
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs text-slate-300 hover:text-white hover:bg-white/[0.04]"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs text-slate-300 hover:text-white hover:bg-white/[0.04]"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              </>
            )}
            <button
              type="button"
              disabled={generating}
              onClick={() => void handleGenerate()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
              <span>
                {generating
                  ? 'Generating...'
                  : currentDoc
                  ? 'Regenerate'
                  : 'Generate with Gemini'}
              </span>
            </button>
          </div>
        </div>

        <div className="flex-1 p-6 overflow-auto bg-[#0B0F19]/60">
          {!currentDoc && !draftContent ? (
            <div className="h-full flex flex-col items-center justify-center py-16 text-center">
              <FileText className="w-8 h-8 text-slate-500 mb-3" />
              <p className="text-sm font-medium text-white">
                {currentMeta.label} has not been generated yet
              </p>
              <p className="mt-1 text-xs text-slate-400 max-w-md">
                Generate grounded documentation directly from your repository’s file manifest,
                dependencies, and source excerpts.
              </p>
              <button
                type="button"
                disabled={generating}
                onClick={() => void handleGenerate()}
                className="mt-5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
              >
                {generating ? 'Generating...' : `Generate ${currentMeta.label}`}
              </button>
            </div>
          ) : viewMode === 'edit' ? (
            <textarea
              value={draftContent}
              onChange={(e) => setDraftContent(e.target.value)}
              className="w-full h-[500px] rounded-lg border border-white/10 bg-[#070A12] p-4 font-mono text-xs text-slate-200 leading-relaxed focus:outline-none focus:border-blue-500"
            />
          ) : (
            <div className="repomind-prose max-w-3xl">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{draftContent}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
