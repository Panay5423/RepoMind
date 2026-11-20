import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FileCode2, MessageSquarePlus, Send } from 'lucide-react';
import type { ConversationDTO, MessageDTO } from '../../../shared/types.ts';
import { api } from '../../lib/api.ts';
import { useToast } from '../../context/ToastContext.tsx';

interface ChatTabProps {
  repositoryId: string;
  repositoryName: string;
  initialConversationId?: string | null;
  onOpenFile: (path: string, startLine?: number, endLine?: number) => void;
}

const STARTER_QUESTIONS = [
  'Explain the complete architecture of this repository.',
  'Where is authentication or request validation implemented?',
  'Which files handle database or persistence operations?',
  'Find potential bugs or edge cases in the core logic.',
  'How can I add a new feature safely following existing patterns?',
];

export function ChatTab({
  repositoryId,
  repositoryName,
  initialConversationId,
  onOpenFile,
}: ChatTabProps) {
  const [conversations, setConversations] = useState<ConversationDTO[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(initialConversationId || null);
  const [messages, setMessages] = useState<MessageDTO[]>([]);
  const [input, setInput] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const { notify } = useToast();

  useEffect(() => {
    let active = true;
    setLoadingList(true);
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
        } else if (!activeConvId && list[0]) {
          setActiveConvId(list[0].id);
        }
      })
      .catch((err) => {
        notify(err instanceof Error ? err.message : 'Unable to load conversations.', 'error');
      })
      .finally(() => {
        if (active) setLoadingList(false);
      });
    return () => {
      active = false;
    };
  }, [repositoryId, repositoryName]);

  useEffect(() => {
    if (!activeConvId) return;
    let active = true;
    setLoadingMessages(true);
    api.chat
      .listMessages(activeConvId)
      .then((res) => {
        if (active) setMessages(res.messages);
      })
      .catch(() => {})
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

  const handleNewConversation = async () => {
    try {
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

  const submitQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || !activeConvId || sending) return;

    const optimisticUser: MessageDTO = {
      id: `temp-${Date.now()}`,
      conversationId: activeConvId,
      role: 'user',
      content: trimmed,
      citations: [],
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUser]);
    setInput('');
    setSending(true);

    try {
      const res = await api.chat.sendMessage(activeConvId, trimmed);
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimisticUser.id),
        res.userMessage,
        res.assistantMessage,
      ]);
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUser.id));
      notify(err instanceof Error ? err.message : 'AI chat request failed.', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitQuestion(input);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 rounded-xl border border-white/[0.08] bg-[#111827] overflow-hidden min-h-[620px]">
      {/* Conversations Sidebar */}
      <aside className="lg:col-span-3 border-b lg:border-b-0 lg:border-r border-white/[0.08] bg-[#0B0F19]/50 flex flex-col">
        <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300">Conversations</span>
          <button
            type="button"
            onClick={() => void handleNewConversation()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
            <span>New</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 max-h-48 lg:max-h-none">
          {loadingList ? (
            <div className="p-3 text-xs text-slate-500">Loading chats...</div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                type="button"
                onClick={() => setActiveConvId(conv.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-colors ${
                  activeConvId === conv.id
                    ? 'bg-[#111827] text-white border border-white/10'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                <p className="font-medium truncate">{conv.title}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {new Date(conv.updatedAt).toLocaleDateString()}
                </p>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Main Chat Viewport */}
      <div className="lg:col-span-9 flex flex-col h-[640px]">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loadingMessages ? (
            <div className="space-y-3">
              <div className="h-16 rounded-lg bg-white/[0.04] animate-pulse" />
              <div className="h-28 rounded-lg bg-white/[0.04] animate-pulse" />
            </div>
          ) : messages.length === 0 ? (
            <div className="py-8 max-w-2xl">
              <h3 className="font-display text-lg font-semibold text-white">
                Ask anything about {repositoryName}
              </h3>
              <p className="mt-1.5 text-sm text-slate-400">
                Answers are grounded via vector RAG retrieval across your indexed source chunks and
                cite exact file paths and line numbers.
              </p>
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {STARTER_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => void submitQuestion(q)}
                    className="text-left p-3 rounded-lg border border-white/[0.08] bg-[#0B0F19] hover:border-blue-500/40 text-xs text-slate-300 hover:text-white transition-colors"
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
                    ? 'ml-auto max-w-2xl rounded-xl bg-blue-600/15 border border-blue-500/30 px-4 py-3 text-sm text-white'
                    : 'max-w-3xl space-y-3'
                }
              >
                {msg.role === 'user' ? (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <div className="rounded-xl border border-white/[0.08] bg-[#0B0F19] p-5 space-y-4">
                    <div className="repomind-prose">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>

                    {msg.citations && msg.citations.length > 0 && (
                      <div className="pt-3 border-t border-white/[0.08]">
                        <p className="text-[11px] font-medium text-slate-400 mb-2">
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
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-white/10 bg-[#111827] hover:border-blue-500/50 text-xs font-mono text-blue-300 transition-colors"
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
                            className="text-left text-xs px-3 py-1.5 rounded-md border border-white/[0.08] text-slate-300 hover:text-white hover:border-white/20 transition-colors"
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
            <div className="max-w-xl rounded-xl border border-white/[0.08] bg-[#0B0F19] p-4 text-xs text-slate-400">
              Retrieving matching code chunks and generating grounded response...
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={handleFormSubmit}
          className="p-4 border-t border-white/[0.08] bg-[#0B0F19] flex items-center gap-3"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about architecture, routes, functions, bugs, or data flow..."
            className="flex-1 rounded-lg border border-white/10 bg-[#111827] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors disabled:opacity-50 shrink-0"
          >
            <Send className="w-4 h-4" />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
}
