/**
 * Agentic chat loop for the GitHub work summarizer.
 *
 * The LLM decides when to call GitHub tools (returning a JSON tool call) and
 * when to give a final answer. We execute tool calls against the GitHub REST
 * API, feed the results back, and loop until the model produces a final answer
 * or the iteration cap is hit.
 */

import { createChatCompletion } from '@/lib/ai/provider';
import { buildGithubAgentSystemPrompt } from '@/lib/ai/github-agent-prompt';
import { getTool } from '@/lib/github/tools';
import { getApiKey, getGithubPat, getModel, getProvider } from '@/lib/storage';
import { uid } from '@/lib/utils';
import type { ChatTurn, ToolCall } from '@/types';

const MAX_ITERATIONS = 12;
const TOOL_MAX_TOKENS = 1024;
const FINAL_MAX_TOKENS = 4096;

export interface AgentStep {
  toolCalls: ToolCall[];
  finalContent: string;
}

export interface RunAgentOptions {
  turns: ChatTurn[];
  signal?: AbortSignal;
  onToolCall?: (call: ToolCall) => void;
}

type LlmMessage = { role: 'system' | 'user' | 'assistant'; content: string };

function extractToolCall(content: string): { name: string; args: Record<string, unknown> } | null {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Brace-count to pull out the first JSON object.
    const firstBrace = cleaned.indexOf('{');
    if (firstBrace === -1) return null;
    let depth = 0;
    let inString = false;
    let found: unknown;
    for (let i = firstBrace; i < cleaned.length; i++) {
      const ch = cleaned[i];
      if (inString) {
        if (ch === '\\') {
          i++;
          continue;
        }
        if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          try {
            found = JSON.parse(cleaned.slice(firstBrace, i + 1));
          } catch {
            return null;
          }
          break;
        }
      }
    }
    parsed = found;
  }

  if (
    parsed &&
    typeof parsed === 'object' &&
    typeof (parsed as Record<string, unknown>).tool === 'string'
  ) {
    const obj = parsed as Record<string, unknown>;
    const name = obj.tool as string;
    const args =
      obj.args && typeof obj.args === 'object' ? (obj.args as Record<string, unknown>) : {};
    return { name, args };
  }

  return null;
}

function buildMessages(turns: ChatTurn[]): LlmMessage[] {
  const messages: LlmMessage[] = [{ role: 'system', content: buildGithubAgentSystemPrompt() }];

  for (const turn of turns) {
    if (turn.role === 'user') {
      messages.push({ role: 'user', content: turn.content });
    } else {
      messages.push({ role: 'assistant', content: turn.content });
      for (const call of turn.toolCalls ?? []) {
        if (call.status === 'success') {
          messages.push({
            role: 'user',
            content: `Tool result for "${call.name}" with args ${JSON.stringify(call.args)}:\n${JSON.stringify(call.summary ?? '')}`,
          });
        } else if (call.status === 'error') {
          messages.push({
            role: 'user',
            content: `Tool "${call.name}" failed: ${call.error ?? 'unknown error'}. Try a different tool or query.`,
          });
        }
      }
    }
  }

  return messages;
}

// Some providers (Anthropic) reject consecutive same-role messages. Merge the
// content into the previous user message when necessary.
function pushUser(messages: LlmMessage[], content: string): void {
  const last = messages[messages.length - 1];
  if (last && last.role === 'user') {
    last.content += `\n\n${content}`;
  } else {
    messages.push({ role: 'user', content });
  }
}

export async function runAgent(opts: RunAgentOptions): Promise<AgentStep> {
  const { turns, signal, onToolCall } = opts;

  const apiKey = getApiKey();
  if (!apiKey) throw new Error('API key not set. Go to Settings.');

  const githubPat = getGithubPat();
  if (!githubPat) throw new Error('GitHub token not set. Go to Settings.');

  const provider = getProvider();
  const model = getModel();

  const messages = buildMessages(turns);
  const toolCalls: ToolCall[] = [];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    if (signal?.aborted) throw new Error('Cancelled');

    const res = await createChatCompletion({
      provider,
      model,
      apiKey,
      messages,
      temperature: 0.3,
      maxTokens: TOOL_MAX_TOKENS,
    });

    const content = res.content.trim();
    const toolCall = extractToolCall(content);

    if (toolCall && getTool(toolCall.name)) {
      const call: ToolCall = {
        id: uid(),
        name: toolCall.name,
        args: toolCall.args,
        status: 'pending',
      };
      toolCalls.push(call);
      onToolCall?.(call);

      messages.push({ role: 'assistant', content });

      try {
        const tool = getTool(toolCall.name)!;
        const toolResult = await tool.run(toolCall.args, { pat: githubPat, signal });
        const summary = JSON.stringify(toolResult.data);
        call.status = 'success';
        call.summary = summary;
        pushUser(
          messages,
          `Tool result for "${toolCall.name}" with args ${JSON.stringify(toolCall.args)}:\n${summary}`
        );
      } catch (err) {
        call.status = 'error';
        call.error = err instanceof Error ? err.message : 'Unknown error';
        pushUser(
          messages,
          `Tool "${toolCall.name}" failed: ${call.error}. Try a different tool or query.`
        );
      }
      continue;
    }

    // No tool call → the model is ready to answer. Ask it to synthesize a full
    // answer with a larger token budget.
    const finalMessages = [...messages];
    pushUser(
      finalMessages,
      'Now give your final answer to the original question using the data you gathered. Format it clearly in markdown.'
    );

    const finalRes = await createChatCompletion({
      provider,
      model,
      apiKey,
      messages: finalMessages,
      temperature: 0.4,
      maxTokens: FINAL_MAX_TOKENS,
    });

    return { toolCalls, finalContent: finalRes.content.trim() };
  }

  const finalMessages = [...messages];
  pushUser(
    finalMessages,
    'You have reached the tool-call limit. Synthesize a final answer now from the data you already have.'
  );

  const finalRes = await createChatCompletion({
    provider,
    model,
    apiKey,
    messages: finalMessages,
    temperature: 0.4,
    maxTokens: FINAL_MAX_TOKENS,
  });

  return { toolCalls, finalContent: finalRes.content.trim() };
}
