'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Send,
  Square,
  MessageSquare,
  Plus,
  AlertTriangle,
  ChevronDown,
  Check,
  X,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Markdown } from '@/components/chat/Markdown';
import { useChatAgent } from '@/hooks/useChatAgent';
import type { ChatTurn, ToolCall } from '@/types';

function ToolActivity({ calls }: { calls: ToolCall[] }) {
  const [open, setOpen] = useState(false);

  if (calls.length === 0) return null;

  return (
    <div className="mt-2 w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
      >
        <ChevronDown className={cn('size-3 transition-transform', open && 'rotate-180')} />
        {calls.length} GitHub {calls.length === 1 ? 'call' : 'calls'}
      </button>
      {open && (
        <div className="mt-1.5 flex flex-col gap-1.5">
          {calls.map((call) => (
            <div key={call.id} className="bg-background/60 rounded-md border px-2 py-1.5">
              <div className="flex items-center gap-1.5 text-xs">
                {call.status === 'success' ? (
                  <Check className="size-3 text-green-600" />
                ) : call.status === 'error' ? (
                  <X className="size-3 text-red-600" />
                ) : (
                  <Loader2 className="size-3 animate-spin" />
                )}
                <code className="font-mono font-medium">{call.name}</code>
                {call.status === 'error' && (
                  <span className="truncate text-red-600">{call.error}</span>
                )}
              </div>
              {Object.keys(call.args).length > 0 && (
                <div className="text-muted-foreground mt-1 text-[11px] break-all">
                  {JSON.stringify(call.args)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Turn({ turn }: { turn: ChatTurn }) {
  if (turn.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="bg-primary text-primary-foreground max-w-[80%] rounded-2xl rounded-br-sm px-4 py-2 text-sm">
          <p className="break-words whitespace-pre-wrap">{turn.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="bg-card max-w-[85%] rounded-2xl rounded-bl-sm border px-4 py-2 text-sm">
        <Markdown text={turn.content} />
        <ToolActivity calls={turn.toolCalls ?? []} />
      </div>
    </div>
  );
}

export function ChatScreen() {
  const { turns, running, error, activeToolCalls, send, cancel, reset, hasPat } = useChatAgent();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, running, activeToolCalls]);

  const handleSend = () => {
    if (!input.trim() || running) return;
    const text = input;
    setInput('');
    void send(text);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="text-muted-foreground size-4" />
          <h2 className="text-sm font-semibold">GitHub Chat</h2>
          {hasPat ? (
            <Badge variant="secondary" className="text-xs">
              Connected
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-amber-600">
              No token
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={reset} disabled={turns.length === 0}>
          <Plus className="mr-1.5 size-3.5" />
          New chat
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
          {!hasPat && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <div>
                <p className="font-medium text-amber-700 dark:text-amber-400">
                  GitHub token required
                </p>
                <p className="text-muted-foreground">
                  Add a personal access token (with <code>repo</code> and <code>read:org</code>{' '}
                  scopes) to let me read your GitHub data.{' '}
                  <Link href="/app/settings" className="underline">
                    Open Settings
                  </Link>
                </p>
              </div>
            </div>
          )}

          {turns.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <MessageSquare className="text-muted-foreground/40 size-10" />
              <p className="text-muted-foreground mt-3 text-sm">
                Ask about your GitHub work — PRs, issues, commits, and reviews.
              </p>
              <div className="text-muted-foreground mt-4 flex flex-col gap-2 text-xs">
                <span>&ldquo;What PRs did I open last week?&rdquo;</span>
                <span>&ldquo;Summarize the issues in repo X.&rdquo;</span>
                <span>&ldquo;What did I commit this month?&rdquo;</span>
              </div>
            </div>
          )}

          {turns.map((turn) => (
            <Turn key={turn.id} turn={turn} />
          ))}

          {running && activeToolCalls.length > 0 && (
            <div className="flex justify-start">
              <div className="bg-card rounded-2xl border px-4 py-2 text-sm">
                <div className="text-muted-foreground flex items-center gap-2">
                  <Loader2 className="size-3.5 animate-spin" />
                  <span className="font-mono text-xs">
                    Calling {activeToolCalls[activeToolCalls.length - 1].name}…
                  </span>
                </div>
              </div>
            </div>
          )}

          {running && activeToolCalls.length === 0 && (
            <div className="flex justify-start">
              <div className="bg-card flex items-center gap-1.5 rounded-2xl border px-4 py-2.5">
                <span className="bg-muted-foreground size-1.5 animate-pulse rounded-full" />
                <span className="bg-muted-foreground size-1.5 animate-pulse rounded-full [animation-delay:150ms]" />
                <span className="bg-muted-foreground size-1.5 animate-pulse rounded-full [animation-delay:300ms]" />
              </div>
            </div>
          )}

          {error && (
            <div className="border-destructive/50 bg-destructive/10 text-destructive rounded-lg border p-4 text-sm">
              {error}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-4">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask about your GitHub work…"
            rows={1}
            disabled={!hasPat}
            className="max-h-40 min-h-10 flex-1 resize-none"
          />
          {running ? (
            <Button variant="destructive" size="icon" onClick={cancel} aria-label="Cancel">
              <Square className="size-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!input.trim() || !hasPat}
              aria-label="Send"
            >
              <Send className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
