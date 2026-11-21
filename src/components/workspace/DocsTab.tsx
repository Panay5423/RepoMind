import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Download, Edit3, Eye, FileText, RefreshCw, Save, Sparkles } from 'lucide-react';
import type { DocType, DocumentationDTO } from '../../../shared/types.ts';
import { api } from '../../lib/api.ts';
import { useToast } from '../../context/ToastContext.tsx';
import { PRIMARY_BLUE_BTN, SECONDARY_WHITE_BTN } from '../ui/PremiumPrimitives.tsx';

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
  const [batchProgress, setBatchProgress] = useState<string | null>(null);
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

  const handleGenerateMissing = async () => {
    const missing = DOC_TYPES.filter((d) => !initialDocs.some((doc) => doc.type === d.type));
    if (missing.length === 0) {
      notify('All 6 documentation suites are already generated.', 'info');
      return;
    }
    setGenerating(true);
    let updated = [...initialDocs];
    try {
      for (let i = 0; i < missing.length; i++) {
        const target = missing[i];
        setBatchProgress(`Generating ${target.label} (${i + 1}/${missing.length})...`);
        const res = await api.docs.generate(repositoryId, target.type);
        updated = [...updated.filter((d) => d.type !== target.type), res.doc];
        onDocsUpdated(updated);
        if (target.type === selectedType) {
          setDraftContent(res.doc.content);
        }
      }
      notify(`Generated ${missing.length} documentation suite(s).`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Batch generation stopped.', 'error');
    } finally {
      setBatchProgress(null);
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

  const missingCount = DOC_TYPES.filter(
    (item) => !initialDocs.some((d) => d.type === item.type)
  ).length;
  const wordCount = draftContent.trim() ? draftContent.trim().split(/\s+/).length : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Doc Type Selector */}
      <aside className="lg:col-span-3 rounded-2xl border border-[#E2E8F0] bg-white p-3.5 h-fit space-y-2 shadow-2xs">
        <div className="space-y-1">
          <p className="px-3 py-2 text-xs font-bold text-[#64748B]">
            Documentation Suites ({initialDocs.length}/{DOC_TYPES.length})
          </p>
          {DOC_TYPES.map((item) => {
            const exists = initialDocs.some((d) => d.type === item.type);
            const active = selectedType === item.type;
            return (
              <button
                key={item.type}
                type="button"
                onClick={() => setSelectedType(item.type)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'
                    : 'text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
                }`}
              >
                <span className="truncate">{item.label}</span>
                <span
                  className={`text-[10px] font-mono ${
                    active ? 'text-[#2563EB]' : exists ? 'text-[#059669]' : 'text-[#94A3B8]'
                  }`}
                >
                  {exists ? 'Ready' : 'New'}
                </span>
              </button>
            );
          })}
        </div>

        {missingCount > 0 && (
          <div className="pt-2.5 border-t border-[#E2E8F0]">
            <button
              type="button"
              disabled={generating}
              onClick={() => void handleGenerateMissing()}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] hover:bg-[#DBEAFE] text-xs font-semibold text-[#2563EB] transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{batchProgress || `Generate ${missingCount} Missing`}</span>
            </button>
          </div>
        )}
      </aside>

      {/* Editor & Preview */}
      <div className="lg:col-span-9 rounded-2xl border border-[#E2E8F0] bg-white overflow-hidden flex flex-col min-h-[580px] shadow-2xs">
        <div className="px-5 py-3.5 border-b border-[#E2E8F0] bg-[#F8FAFC]/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-sm font-bold text-[#0F172A]">{currentMeta.label}</h2>
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white border border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                  viewMode === 'preview' ? 'bg-[#EFF6FF] text-[#2563EB]' : 'text-[#64748B]'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('edit')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                  viewMode === 'edit' ? 'bg-[#EFF6FF] text-[#2563EB]' : 'text-[#64748B]'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            </div>
            {wordCount > 0 && (
              <span className="hidden sm:inline text-[11px] font-mono text-[#64748B] tabular-nums">
                {wordCount} words
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {currentDoc && viewMode === 'edit' && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave()}
                className={`${SECONDARY_WHITE_BTN} px-3 py-1.5 text-xs text-[#059669]`}
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
                  className={`${SECONDARY_WHITE_BTN} px-3 py-1.5 text-xs`}
                >
                  <Copy className="w-3.5 h-3.5 text-[#475569]" />
                  <span>Copy</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className={`${SECONDARY_WHITE_BTN} px-3 py-1.5 text-xs`}
                >
                  <Download className="w-3.5 h-3.5 text-[#475569]" />
                  <span>Download</span>
                </button>
              </>
            )}
            <button
              type="button"
              disabled={generating}
              onClick={() => void handleGenerate()}
              className={`${PRIMARY_BLUE_BTN} px-3.5 py-1.5 text-xs`}
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

        <div className="flex-1 p-6 overflow-auto bg-white">
          {!currentDoc && !draftContent ? (
            <div className="h-full flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center mb-3">
                <FileText className="w-6 h-6 text-[#2563EB]" />
              </div>
              <p className="text-sm font-semibold text-[#0F172A]">
                {currentMeta.label} has not been generated yet
              </p>
              <p className="mt-1.5 text-xs text-[#64748B] max-w-md">
                Generate grounded documentation directly from your repository’s file manifest,
                dependencies, and source excerpts.
              </p>
              <button
                type="button"
                disabled={generating}
                onClick={() => void handleGenerate()}
                className={`${PRIMARY_BLUE_BTN} mt-5 px-4 py-2 text-xs`}
              >
                {generating ? 'Generating...' : `Generate ${currentMeta.label}`}
              </button>
            </div>
          ) : viewMode === 'edit' ? (
            <textarea
              value={draftContent}
              onChange={(e) => setDraftContent(e.target.value)}
              className="w-full h-[500px] rounded-xl border border-[#1E3A5F] bg-[#0B1F3A] p-4 font-mono text-xs text-[#E2E8F0] leading-relaxed focus:outline-none focus:border-[#3B82F6]"
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
