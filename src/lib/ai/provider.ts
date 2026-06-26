import type { DeepSeekModel } from "@/types";
import { sleep } from "@/lib/utils";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionOptions {
  model: DeepSeekModel;
  messages: ChatMessage[];
  apiKey: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatCompletionResult {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

const BASE_URL = "https://api.deepseek.com/v1";

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [1000, 2000, 4000];
const RETRYABLE_STATUSES = new Set([429, 503]);

export async function createChatCompletion(
  opts: ChatCompletionOptions
): Promise<ChatCompletionResult> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${opts.apiKey}`,
        },
        body: JSON.stringify({
          model: opts.model,
          messages: opts.messages,
          temperature: opts.temperature ?? 0.7,
          max_tokens: opts.maxTokens,
        }),
      });

      if (!res.ok) {
        const status = res.status;
        if (RETRYABLE_STATUSES.has(status) && attempt < MAX_RETRIES) {
          const delay = RETRY_DELAYS_MS[attempt];
          console.warn(
            `DeepSeek ${status}, retrying in ${delay}ms (${attempt + 1}/${MAX_RETRIES})`
          );
          await sleep(delay);
          continue;
        }
        const err = await res.text();
        throw new Error(`DeepSeek error (${status}): ${err}`);
      }

      const data = await res.json();
      return {
        content: data.choices[0].message.content,
        model: data.model,
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens,
              completionTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens,
            }
          : undefined,
      };
    } catch (err) {
      if (err instanceof TypeError && attempt < MAX_RETRIES) {
        // Network errors (DNS failure, connection refused, etc.) are retryable
        const delay = RETRY_DELAYS_MS[attempt];
        console.warn(
          `Network error, retrying in ${delay}ms (${attempt + 1}/${MAX_RETRIES}): ${(err as Error).message}`
        );
        await sleep(delay);
        lastError = err as Error;
        continue;
      }
      // Non-TypeError errors (e.g. HTTP 4xx/5xx thrown above) — propagate immediately
      throw err;
    }
  }

  throw lastError ?? new Error("DeepSeek request failed after all retries");
}
