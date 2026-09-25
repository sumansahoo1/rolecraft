'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { runAgent } from '@/lib/github/agent';
import { getChatHistory, setChatHistory, clearChatHistory, getGithubPat } from '@/lib/storage';
import { uid } from '@/lib/utils';
import type { ChatTurn, ToolCall } from '@/types';

export interface ChatAgentState {
  turns: ChatTurn[];
  running: boolean;
  error: string | null;
  activeToolCalls: ToolCall[];
}

export function useChatAgent() {
  const [state, setState] = useState<ChatAgentState>({
    turns: [],
    running: false,
    error: null,
    activeToolCalls: [],
  });
  const [hasPat, setHasPat] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((s) => ({ ...s, turns: getChatHistory() }));
    setHasPat(getGithubPat() !== null);
  }, []);

  const persist = useCallback((turns: ChatTurn[]) => {
    setChatHistory(turns);
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || state.running) return;

      const userTurn: ChatTurn = { id: uid(), role: 'user', content: trimmed };
      const nextTurns = [...state.turns, userTurn];
      setState((s) => ({
        ...s,
        turns: nextTurns,
        running: true,
        error: null,
        activeToolCalls: [],
      }));
      persist(nextTurns);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const result = await runAgent({
          turns: nextTurns,
          signal: controller.signal,
          onToolCall: (call) => {
            setState((s) => ({ ...s, activeToolCalls: [...s.activeToolCalls, call] }));
          },
        });

        const assistantTurn: ChatTurn = {
          id: uid(),
          role: 'assistant',
          content: result.finalContent,
          toolCalls: result.toolCalls,
        };
        const finalTurns = [...nextTurns, assistantTurn];
        setState((s) => ({
          ...s,
          turns: finalTurns,
          running: false,
          activeToolCalls: [],
        }));
        persist(finalTurns);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Request failed';
        setState((s) => ({ ...s, running: false, error: message, activeToolCalls: [] }));
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [state.turns, state.running, persist]
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setState((s) => ({ ...s, running: false, activeToolCalls: [] }));
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    clearChatHistory();
    setState({ turns: [], running: false, error: null, activeToolCalls: [] });
  }, []);

  return { ...state, send, cancel, reset, hasPat };
}
