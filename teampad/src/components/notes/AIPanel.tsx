import { useState, useRef, useEffect } from 'react';
import { Bot, X, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { restApi } from '@/api/restApi';
import type { Group, Note } from '@/types';

interface AIPanelProps {
  isOpen: boolean;
  onClose: () => void;
  noteContent: string;
  workspaceId?: string;
  availableNotes?: Note[];
  availableGroups?: Group[];
  currentNoteId?: string | null;
  currentNote?: Note | null;
  notesLimit?: number;
  onLoadMoreNotes?: () => void;
  onApplyToNote?: (mode: 'insert' | 'replace', text: string) => Promise<void>;
}

const MAX_HISTORY_MESSAGES = 6;
const GREETING_MESSAGE = 'Hello! Ask me to summarize, pull action items, or draft next steps.';

type ConversationMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export function AIPanel({
  isOpen,
  onClose,
  workspaceId,
}: AIPanelProps) {
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);

  // Streaming state
  const [promptText, setPromptText] = useState('');
  const [streamingAnswer, setStreamingAnswer] = useState('');
  const [sources, setSources] = useState<unknown[]>([]);
  const [streaming, setStreaming] = useState(false);
  const streamControllerRef = useRef<AbortController | null>(null);
  const greetingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRequestIdRef = useRef(0);
  const completedRequestIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    setConversation([]);
    completedRequestIdsRef.current.clear();
    activeRequestIdRef.current = 0;
  }, [workspaceId]);

  useEffect(() => {
    if (greetingTimerRef.current) {
      clearTimeout(greetingTimerRef.current);
      greetingTimerRef.current = null;
    }
    if (!isOpen) {
      return;
    }
    const hasGreeting = conversation.some(
      (message) => message.role === 'assistant' && message.content === GREETING_MESSAGE,
    );
    if (hasGreeting || streaming) return;
    greetingTimerRef.current = setTimeout(() => {
      setConversation((prev) => {
        if (prev.some((message) => message.role === 'assistant' && message.content === GREETING_MESSAGE)) {
          return prev;
        }
        return [{ role: 'assistant', content: GREETING_MESSAGE }, ...prev];
      });
      greetingTimerRef.current = null;
    }, 1500);
    return () => {
      if (greetingTimerRef.current) {
        clearTimeout(greetingTimerRef.current);
        greetingTimerRef.current = null;
      }
    };
  }, [isOpen, conversation, streaming]);

  const buildPrompt = (basePrompt: string, history: ConversationMessage[] = []) => {
    const historyLines = history
      .filter((msg) => msg.content !== GREETING_MESSAGE)
      .slice(-MAX_HISTORY_MESSAGES)
      .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n');
    if (!historyLines) {
      return { fullPrompt: basePrompt };
    }
    return { fullPrompt: `${basePrompt}\n\nConversation so far:\n${historyLines}` };
  };

  const renderInline = (text: string) => {
    const tokens = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
    return tokens.map((token, index) => {
      if (token.startsWith('**') && token.endsWith('**')) {
        return <strong key={`${token}-${index}`}>{token.slice(2, -2)}</strong>;
      }
      if (token.startsWith('*') && token.endsWith('*')) {
        return <em key={`${token}-${index}`}>{token.slice(1, -1)}</em>;
      }
      return <span key={`${token}-${index}`}>{token}</span>;
    });
  };

  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    const blocks: JSX.Element[] = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) {
        blocks.push(<div key={`spacer-${i}`} className="h-2" />);
        i += 1;
        continue;
      }
      if (/^###\s+/.test(line)) {
        blocks.push(
          <h3 key={`h3-${i}`} className="text-sm font-semibold text-foreground">
            {renderInline(line.replace(/^###\s+/, ''))}
          </h3>
        );
        i += 1;
        continue;
      }
      if (/^##\s+/.test(line)) {
        blocks.push(
          <h2 key={`h2-${i}`} className="text-sm font-semibold text-foreground">
            {renderInline(line.replace(/^##\s+/, ''))}
          </h2>
        );
        i += 1;
        continue;
      }
      if (/^#\s+/.test(line)) {
        blocks.push(
          <h1 key={`h1-${i}`} className="text-base font-semibold text-foreground">
            {renderInline(line.replace(/^#\s+/, ''))}
          </h1>
        );
        i += 1;
        continue;
      }
      if (/^[-*]\s+/.test(line)) {
        const items: string[] = [];
        while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^[-*]\s+/, ''));
          i += 1;
        }
        blocks.push(
          <ul key={`ul-${i}`} className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
            {items.map((item, idx) => (
              <li key={`ul-${i}-${idx}`}>{renderInline(item)}</li>
            ))}
          </ul>
        );
        continue;
      }
      if (/^\d+\.\s+/.test(line)) {
        const items: string[] = [];
        while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\d+\.\s+/, ''));
          i += 1;
        }
        blocks.push(
          <ol key={`ol-${i}`} className="list-decimal pl-5 text-sm text-muted-foreground space-y-1">
            {items.map((item, idx) => (
              <li key={`ol-${i}-${idx}`}>{renderInline(item)}</li>
            ))}
          </ol>
        );
        continue;
      }
      blocks.push(
        <p key={`p-${i}`} className="text-sm text-muted-foreground leading-relaxed">
          {renderInline(line)}
        </p>
      );
      i += 1;
    }
    return <div className="space-y-2">{blocks}</div>;
  };

  const startStream = async (
    promptOverride?: string,
    displayPrompt?: string,
    options: { includeHistory?: boolean; historyLabel?: string } = {},
  ) => {
    if (!workspaceId || streaming) return;
    const basePrompt = (promptOverride ?? promptText).trim();
    if (!basePrompt) return;
    const history = options.includeHistory === false ? [] : conversation;
    const { fullPrompt } = buildPrompt(basePrompt, history);
    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;
    setConversation((prev) =>
      [...prev, { role: 'user', content: options.historyLabel ?? basePrompt }],
    );
    setResult(null);
    setStreaming(true);
    setPromptText('');
    setStreamingAnswer('');
    setSources([]);

    const onEvent = (ev: { event: string; data: unknown }) => {
      if (ev.event === 'message' || ev.event === 'data') {
        setStreamingAnswer((s) => s + String(ev.data));
      } else if (ev.event === 'sources') {
        setSources((Array.isArray(ev.data) ? ev.data : []) as unknown[]);
      } else if (ev.event === 'end') {
        setStreaming(false);
      } else if (ev.event === 'error') {
        setStreaming(false);
        const errorText =
          typeof ev.data === 'object' && ev.data !== null && 'message' in ev.data
            ? (ev.data as { message?: string }).message || JSON.stringify(ev.data)
            : JSON.stringify(ev.data);
        setStreamingAnswer((s) => (s ? `${s}\n[ERROR] ${errorText}` : `[ERROR] ${errorText}`));
      }
    };

    streamControllerRef.current = restApi.streamWorkspace(workspaceId, fullPrompt, onEvent);
  };

  const stopStream = () => {
    if (streamControllerRef.current) {
      streamControllerRef.current.abort();
      setStreaming(false);
      streamControllerRef.current = null;
    }
  };


  const handleCopy = () => {
    const text = answerText || latestAssistantMessage?.content || '';
    if (text) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const showConversation = Boolean(conversation.length || result || streamingAnswer || streaming);
  const answerText = (streamingAnswer || result || '').trim();
  const latestAssistantMessage = [...conversation].reverse().find((message) => message.role === 'assistant');

  useEffect(() => {
    if (streaming) return;
    const requestId = activeRequestIdRef.current;
    if (!requestId || !answerText || completedRequestIdsRef.current.has(requestId)) return;
    completedRequestIdsRef.current.add(requestId);
    setConversation((prev) =>
      [...prev, { role: 'assistant', content: answerText }],
    );
    setStreamingAnswer('');
  }, [streaming, answerText]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/20 backdrop-blur-[1px]"
        onClick={onClose}
        aria-label="Close AI panel"
      />
      <div
        className="absolute right-0 top-0 h-full w-full max-w-[28rem] bg-card shadow-2xl flex flex-col animate-slide-down"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="p-4 bg-gradient-to-r from-primary/15 via-transparent to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
                <span className="absolute -right-1 -bottom-1 h-3 w-3 rounded-full bg-emerald-500" />
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              className="h-9 w-9 rounded-full bg-background/80 text-muted-foreground shadow-sm hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label="Close AI panel"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
          <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4">
            <p className="text-sm font-semibold text-foreground">Let’s talk about your workspace.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Ask anything about what you are working on, and I will respond in real time.
            </p>
          </div>

          {showConversation ? (
            <div className="space-y-3">
              {conversation.map((message, index) =>
                message.role === 'user' ? (
                  <div key={`${message.role}-${index}`} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl bg-primary text-primary-foreground px-3 py-2 shadow-sm">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-primary-foreground/70">
                        You
                      </div>
                      <div className="mt-1 text-sm whitespace-pre-line">{message.content}</div>
                    </div>
                  </div>
                ) : (
                  <div key={`${message.role}-${index}`} className="flex items-start gap-2">
                    <div className="mt-1 w-8 h-8 rounded-xl bg-secondary flex items-center justify-center">
                      <Bot className="w-4 h-4 text-foreground" />
                    </div>
                    <div className="flex-1 rounded-2xl bg-background/70 px-3 py-2 shadow-sm">
                      {renderMarkdown(message.content)}
                    </div>
                  </div>
                ),
              )}

              {(streaming || streamingAnswer) ? (
                <div className="flex items-start gap-2">
                  <div className="mt-1 w-8 h-8 rounded-xl bg-secondary flex items-center justify-center">
                    <Bot className="w-4 h-4 text-foreground" />
                  </div>
                  <div className="flex-1 rounded-2xl bg-background/70 px-3 py-2 shadow-sm">
                    <div className="flex items-center justify-end">
                      {answerText ? (
                        <Button variant="ghost" size="icon-sm" onClick={handleCopy} className="h-7 w-7">
                          {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      ) : null}
                    </div>
                    {streaming ? (
                      streamingAnswer ? (
                        renderMarkdown(streamingAnswer)
                      ) : (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground py-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:-0.2s]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:-0.1s]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-bounce" />
                          <span className="ml-2">Thinking...</span>
                        </div>
                      )
                    ) : (
                      renderMarkdown(streamingAnswer)
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Ask anything</span>
            <span className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.2em]">
              Live
            </span>
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-lg bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Ask about this workspace or note..."
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
            />
            {!streaming ? (
              <Button
                onClick={() => {
                  startStream();
                }}
                disabled={!workspaceId || streaming || !promptText.trim()}
              >
                Ask
              </Button>
            ) : (
              <Button variant="destructive" onClick={stopStream}>
                Stop
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Responses are generated from notes you can access.
          </p>
        </div>
      </div>
    </div>
  );
}
