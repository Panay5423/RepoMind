import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  AlertCircle,
  Copy,
  Download,
  FileCode2,
  MessageSquarePlus,
  RotateCcw,
  Send,
  Trash2,
} from 'lucide-react';
import type { ChatMode, ConversationDTO, MessageDTO } from '../../../shared/types.ts';
import { api } from '../../lib/api.ts';
import { useToast } from '../../context/ToastContext.tsx';
import { PRIMARY_BLUE_BTN, SECONDARY_WHITE_BTN } from '../ui/PremiumPrimitives.tsx';

export interface PendingChatPrompt {
  text: string;
  mode?: ChatMode;
  nonce: number;
}

interface ChatTabProps {
  repositoryId: string;
  repositoryName: string;
  initialConversationId?: string | null;
  pendingPrompt?: PendingChatPrompt | null;
  onOpenFile: (path: string, startLine?: number, endLine?: number) => void;
}

const STARTER_QUESTIONS = [
  'Explain the complete architecture of this repository.',
  'Where is authentication or request validation implemented?',
  'Which files handle database or persistence operations?',
  'Find potential bugs or edge cases in the core logic.',
  'How can I add a new feature safely following existing patterns?',
];

const CHAT_MODES: Array<{ id: ChatMode; label: string; hint: string }> = [
  { id: 'qa', label: 'Q&A', hint: 'Grounded architectural answers with citations' },
  { id: 'flow', label: 'Trace Flow', hint: 'Step-by-step execution & data flow tracing' },
  { id: 'tests', label: 'Write Tests', hint: 'Unit & integration test cases for real files' },
  { id: 'refactor', label: 'Refactor', hint: 'Actionable code quality & structure improvements' },
];

export function ChatTab({
  repositoryId,
  repositoryName,
  initialConversationId,
  pendingPrompt,
  onOpenFile,
}: ChatTabProps) {
  const [conversations, setConversations] = useState<ConversationDTO[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(initialConversationId || null);
  const [messages, setMessages] = useState<MessageDTO[]>([]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<ChatMode>('qa');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [deletingConvId, setDeletingConvId] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lastProcessedNonceRef = useRef<number | null>(null);
  const { notify } = useToast();

  useEffect(() => {
    let active = true;
    setLoadingList(true);
    setChatError(null);
    setMessages([]);
    setActiveConvId(initialConversationId || null);

    api.chat
      .listConversations(repositoryId)
      .then(async (res) => {
        if (!active) return;
        let list = res.conversations;
        if (list.length === 0) {
          const created = await api.chat.createConversation(
            repositoryId,
            `Architecture · ${repositoryName}`
          );
          list = [created.conversation];
        }
        setConversations(list);
        if (initialConversationId && list.some((c) => c.id === initialConversationId)) {
          setActiveConvId(initialConversationId);
        } else if (list[0]) {
          setActiveConvId(list[0].id);
        }
      })
      .catch((err) => {
        if (!active) return;
        const msg = err instanceof Error ? err.message : 'Unable to load conversations.';
        setChatError(msg);
        notify(msg, 'error');
      })
      .finally(() => {
        if (active) setLoadingList(false);
      });

    return () => {
      active = false;
    };
  }, [repositoryId, repositoryName, initialConversationId, notify]);

  useEffect(() => {
    if (!activeConvId) return;
    let active = true;
    setLoadingMessages(true);
    api.chat
      .listMessages(activeConvId)
      .then((res) => {
        if (active) setMessages(res.messages);
      })
      .catch((err) => {
        if (active) {
          setChatError(err instanceof Error ? err.message : 'Unable to load messages.');
        }
      })
      .finally(() => {
        if (active) setLoadingMessages(false);
      });
    return () => {
      active = false;
    };
  }, [activeConvId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  useEffect(() => {
    if (!pendingPrompt || loadingList) return;
    if (lastProcessedNonceRef.current === pendingPrompt.nonce) return;
    lastProcessedNonceRef.current = pendingPrompt.nonce;
    if (pendingPrompt.mode) setMode(pendingPrompt.mode);
    setInput(pendingPrompt.text);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 60);
  }, [pendingPrompt, loadingList]);

  const handleNewConversation = async () => {
    try {
      setChatError(null);
      const res = await api.chat.createConversation(
        repositoryId,
        `Session ${conversations.length + 1}`
      );
      setConversations((prev) => [res.conversation, ...prev]);
      setActiveConvId(res.conversation.id);
      setMessages([]);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not create conversation.', 'error');
    }
  };

  const handleDeleteConversation = async (convId: string) => {
    setDeletingConvId(convId);
    try {
      await api.chat.deleteConversation(convId);
      const remaining = conversations.filter((c) => c.id !== convId);
      if (remaining.length === 0) {
        const created = await api.chat.createConversation(
          repositoryId,
          `Architecture · ${repositoryName}`
        );
        setConversations([created.conversation]);
        setActiveConvId(created.conversation.id);
        setMessages([]);
      } else {
        setConversations(remaining);
        if (activeConvId === convId) {
          setActiveConvId(remaining[0].id);
        }
      }
      notify('Conversation removed.', 'info');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not delete conversation.', 'error');
    } finally {
      setDeletingConvId(null);
    }
  };

  const submitQuestion = async (questionText: string, overrideMode?: ChatMode) => {
    const trimmed = questionText.trim();
    const activeMode = overrideMode || mode;
    if (!trimmed || sending) return;

    setChatError(null);
    setLastFailedPrompt(null);
    setSending(true);

    let targetConvId = activeConvId;
    try {
      if (!targetConvId) {
        const created = await api.chat.createConversation(
          repositoryId,
          `Chat · ${repositoryName}`
        );
        targetConvId = created.conversation.id;
        setConversations((prev) => [created.conversation, ...prev]);
        setActiveConvId(targetConvId);
      }

      const optimisticUser: MessageDTO = {
        id: `temp-${Date.now()}`,
        conversationId: targetConvId,
        role: 'user',
        content: trimmed,
        citations: [],
        createdAt: new Date().toISOString(),
      };
      const isFirstMessage = messages.length === 0;
      setMessages((prev) => [...prev, optimisticUser]);
      setInput('');

      const res = await api.chat.sendMessage(targetConvId, trimmed, activeMode);
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimisticUser.id),
        res.userMessage,
        res.assistantMessage,
      ]);

      if (isFirstMessage) {
        const compact = trimmed.replace(/\s+/g, ' ').slice(0, 52);
        const nextTitle = compact.length < trimmed.length ? `${compact}...` : compact;
        setConversations((prev) =>
          prev.map((c) =>
            c.id === targetConvId && /^(Architecture ·|Session |Chat ·)/.test(c.title)
              ? { ...c, title: nextTitle, updatedAt: new Date().toISOString() }
              : c
          )
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI chat request failed.';
      setMessages((prev) => prev.filter((m) => !m.id.startsWith('temp-')));
      setChatError(msg);
      setLastFailedPrompt(trimmed);
      notify(msg, 'error');
    } finally {
      setSending(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitQuestion(input);
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submitQuestion(input);
    }
  };

  const handleCopyMessage = async (content: string) => {
    await navigator.clipboard.writeText(content);
    notify('Copied response to clipboard.', 'success');
  };

  const handleExportChat = () => {
    if (messages.length === 0) return;
    const convTitle =
      conversations.find((c) => c.id === activeConvId)?.title || repositoryName;
    const md = [
      `# RepoMind AI Code Chat — ${repositoryName}`,
      `Session: ${convTitle}`,
      `Exported: ${new Date().toISOString()}`,
      '',
      ...messages.map((m) => {
        const roleHeading = m.role === 'user' ? '## Developer Question' : '## RepoMind Answer';
        const cites =
          m.citations?.length > 0
            ? `\n\n**Verified References:** ${m.citations
                .map((c) => `\`${c.filePath}${c.startLine ? `:${c.startLine}` : ''}\``)
                .join(', ')}`
            : '';
        return `${roleHeading}\n\n${m.content}${cites}\n`;
      }),
    ].join('\n---\n\n');

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${repositoryName.replace(/[^a-z0-9_-]+/gi, '-')}-chat.md`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Exported conversation as Markdown.', 'success');
  };

  const activeModeMeta = CHAT_MODES.find((m) => m.id === mode)!;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_30px_-14px_rgba(37,99,235,0.1)] overflow-hidden min-h-[650px]">
      {/* Conversations Sidebar */}
      <aside className="lg:col-span-3 border-b lg:border-b-0 lg:border-r border-[#E2E8F0] bg-[#F8FAFC] flex flex-col">
        <div className="p-4 border-b border-[#E2E8F0] bg-white flex items-center justify-between">
          <span className="text-xs font-bold text-[#0F172A]">
            Conversations ({conversations.length})
          </span>
          <button
            type="button"
            onClick={() => void handleNewConversation()}
            className={`${PRIMARY_BLUE_BTN} px-2.5 py-1.5 text-xs`}
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
            <span>New</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2.5 space-y-1 max-h-48 lg:max-h-[590px]">
          {loadingList ? (
            <div className="p-3 text-xs text-[#64748B]">Loading chats...</div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={`group flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs transition-colors ${
                  activeConvId === conv.id
                    ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] shadow-2xs'
                    : 'text-[#475569] hover:text-[#0F172A] hover:bg-white'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveConvId(conv.id);
                    setChatError(null);
                  }}
                  className="flex-1 min-w-0 text-left"
                >
                  <p className="font-semibold truncate">{conv.title}</p>
                  <p className="text-[11px] text-[#64748B] mt-0.5">
                    {new Date(conv.updatedAt).toLocaleDateString()}
                  </p>
                </button>
                <button
                  type="button"
                  disabled={deletingConvId === conv.id}
                  onClick={() => void handleDeleteConversation(conv.id)}
                  title="Delete conversation"
                  aria-label={`Delete ${conv.title}`}
                  className="p-1 rounded text-[#64748B] hover:text-[#E11D48] opacity-70 group-hover:opacity-100 transition-opacity shrink-0 disabled:opacity-40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main Chat Viewport */}
      <div className="lg:col-span-9 flex flex-col h-[680px] bg-white">
        {/* Mode & Export Bar */}
        <div className="px-5 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC]/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white border border-[#E2E8F0]">
              {CHAT_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    mode === m.id
                      ? 'bg-[#2563EB] text-white shadow-2xs'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <span className="hidden sm:inline text-[11px] text-[#64748B]">
              {activeModeMeta.hint}
            </span>
          </div>

          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleExportChat}
              className={`${SECONDARY_WHITE_BTN} px-2.5 py-1 text-xs`}
            >
              <Download className="w-3.5 h-3.5 text-[#475569]" />
              <span>Export</span>
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#F8FAFC]/50">
          {loadingMessages ? (
            <div className="space-y-3">
              <div className="h-16 rounded-xl bg-white border border-[#E2E8F0] animate-pulse" />
              <div className="h-28 rounded-xl bg-white border border-[#E2E8F0] animate-pulse" />
            </div>
          ) : messages.length === 0 ? (
            <div className="py-6 max-w-2xl">
              <h3 className="font-display text-lg font-bold text-[#0B1F3A]">
                Ask anything about {repositoryName}
              </h3>
              <p className="mt-1.5 text-sm text-[#475569]">
                Answers are grounded via vector RAG retrieval across your indexed source chunks and
                cite exact file paths and line numbers.
              </p>
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {STARTER_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    disabled={sending}
                    onClick={() => void submitQuestion(q)}
                    className="text-left p-3.5 rounded-xl border border-[#E2E8F0] bg-white hover:border-[#93C5FD] hover:bg-[#EFF6FF]/40 text-xs font-medium text-[#334155] hover:text-[#2563EB] shadow-2xs transition-all disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={
                  msg.role === 'user'
                    ? 'ml-auto max-w-2xl rounded-2xl bg-[#EFF6FF] border border-[#BFDBFE] px-4 py-3 text-sm text-[#0B1F3A] font-medium shadow-2xs'
                    : 'max-w-3xl space-y-3'
                }
              >
                {msg.role === 'user' ? (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 space-y-4 shadow-[0_4px_16px_-6px_rgba(15,23,42,0.06)]">
                    <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#F1F5F9]">
                      <span className="text-[11px] font-mono font-semibold text-[#2563EB]">
                        RepoMind Grounded Answer
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleCopyMessage(msg.content)}
                        className="inline-flex items-center gap-1 text-[11px] text-[#64748B] hover:text-[#0F172A] transition-colors"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </button>
                    </div>

                    <div className="repomind-prose">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>

                    {msg.citations && msg.citations.length > 0 && (
                      <div className="pt-3 border-t border-[#E2E8F0]">
                        <p className="text-[11px] font-semibold text-[#64748B] mb-2">
                          Verified File References
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {msg.citations.map((cit, i) => (
                            <button
                              key={`${cit.filePath}-${i}`}
                              type="button"
                              onClick={() =>
                                onOpenFile(cit.filePath, cit.startLine, cit.endLine)
                              }
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] hover:bg-[#DBEAFE] text-xs font-mono font-medium text-[#2563EB] transition-colors"
                            >
                              <FileCode2 className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                {cit.filePath}
                                {cit.startLine
                                  ? `:${cit.startLine}${
                                      cit.endLine && cit.endLine !== cit.startLine
                                        ? `-${cit.endLine}`
                                        : ''
                                    }`
                                  : ''}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {msg.suggestedFollowUps && msg.suggestedFollowUps.length > 0 && (
                      <div className="pt-2 flex flex-wrap gap-2">
                        {msg.suggestedFollowUps.map((fup) => (
                          <button
                            key={fup}
                            type="button"
                            disabled={sending}
                            onClick={() => void submitQuestion(fup)}
                            className="text-left text-xs px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-[#475569] hover:text-[#2563EB] hover:border-[#93C5FD] transition-colors"
                          >
                            {fup}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}

          {sending && (
            <div className="max-w-xl rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] p-4 text-xs font-medium text-[#2563EB]">
              Retrieving matching code chunks and generating grounded response...
            </div>
          )}

          {chatError && (
            <div className="max-w-2xl rounded-2xl border border-[#FECDD3] bg-[#FFF1F2] p-4 flex items-start justify-between gap-4">
              <div className="flex items-start gap-2.5 text-xs text-[#E11D48]">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{chatError}</span>
              </div>
              {lastFailedPrompt && (
                <button
                  type="button"
                  onClick={() => void submitQuestion(lastFailedPrompt)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-medium shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
              )}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={handleFormSubmit}
          className="p-4 border-t border-[#E2E8F0] bg-white flex items-end gap-3"
        >
          <textarea
            ref={textareaRef}
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleTextareaKeyDown}
            placeholder="Ask about architecture, routes, functions, bugs, or paste a snippet (Enter to send, Shift+Enter for newline)..."
            className="flex-1 resize-none rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:bg-white focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 leading-relaxed transition-all"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className={`${PRIMARY_BLUE_BTN} px-4 py-2.5 text-sm`}
          >
            <Send className="w-4 h-4" />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
}
