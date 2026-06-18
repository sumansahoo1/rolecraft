import type { DeepSeekModel } from "@/types";

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

export async function createChatCompletion(
  opts: ChatCompletionOptions
): Promise<ChatCompletionResult> {
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
    const err = await res.text();
    throw new Error(`DeepSeek error (${res.status}): ${err}`);
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
}
