import type { Provider, ProviderConfig } from "@/types";
import { sleep } from "@/lib/utils";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionOptions {
  provider: Provider;
  model: string;
  messages: ChatMessage[];
  apiKey: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatCompletionResult {
  content: string;
  model: string;
  provider: Provider;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ─── Provider Registry ────────────────────────────────────────

export const PROVIDER_CONFIGS: Record<Provider, ProviderConfig> = {
  deepseek: {
    baseUrl: "https://api.deepseek.com",
    chatEndpoint: "/chat/completions",
    headers: (apiKey) => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    }),
    models: [
      { value: "deepseek-v4-pro", label: "Pro (deepseek-v4-pro)", desc: "Most capable model for complex tasks" },
      { value: "deepseek-v4-flash", label: "Flash (deepseek-v4-flash)", desc: "Faster and cheaper for simpler tasks" },
    ],
    defaultModel: "deepseek-v4-pro",
  },
  openai: {
    baseUrl: "https://api.openai.com",
    chatEndpoint: "/v1/chat/completions",
    headers: (apiKey) => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    }),
    models: [
      { value: "gpt-4o", label: "GPT-4o", desc: "Most capable multimodal model" },
      { value: "gpt-4o-mini", label: "GPT-4o Mini", desc: "Fast and affordable" },
    ],
    defaultModel: "gpt-4o",
  },
  anthropic: {
    baseUrl: "https://api.anthropic.com",
    chatEndpoint: "/v1/messages",
    headers: (apiKey) => ({
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    }),
    models: [
      { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4", desc: "Best balance of speed and capability" },
      { value: "claude-opus-4-20250514", label: "Claude Opus 4", desc: "Most powerful" },
      { value: "claude-haiku-4-20250514", label: "Claude Haiku 4", desc: "Fastest" },
    ],
    defaultModel: "claude-sonnet-4-20250514",
  },
  google: {
    baseUrl: "https://generativelanguage.googleapis.com",
    chatEndpoint: "/v1beta/models/{model}:generateContent",
    headers: () => ({
      "Content-Type": "application/json",
    }),
    models: [
      { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro", desc: "Most capable" },
      { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash", desc: "Fast and efficient" },
    ],
    defaultModel: "gemini-2.5-pro",
  },
  openrouter: {
    baseUrl: "https://openrouter.ai",
    chatEndpoint: "/api/v1/chat/completions",
    headers: (apiKey) => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    }),
    models: [
      { value: "openai/gpt-4o", label: "GPT-4o (OpenRouter)", desc: "OpenAI GPT-4o via OpenRouter" },
      { value: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4 (OpenRouter)", desc: "Anthropic Claude Sonnet 4 via OpenRouter" },
    ],
    defaultModel: "openai/gpt-4o",
  },
};

// ─── Helpers ──────────────────────────────────────────────────

export function getProviderConfig(provider: Provider): ProviderConfig {
  return PROVIDER_CONFIGS[provider];
}

export function getDefaultModel(provider: Provider): string {
  return PROVIDER_CONFIGS[provider].defaultModel;
}

// ─── Body builders (per-provider) ─────────────────────────────

function buildOpenAICompatBody(opts: ChatCompletionOptions) {
  return {
    model: opts.model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens,
  };
}

function buildDeepSeekBody(opts: ChatCompletionOptions) {
  return {
    model: opts.model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens,
    // V4 models have thinking enabled by default.
    // Disable — we need structured JSON output, not chain-of-thought.
    // When thinking is enabled, content can be null/empty if all
    // tokens are consumed by reasoning.
    thinking: { type: "disabled" as const },
  };
}

function buildAnthropicBody(opts: ChatCompletionOptions) {
  const systemMessages = opts.messages.filter((m) => m.role === "system");
  const nonSystemMessages = opts.messages.filter((m) => m.role !== "system");

  return {
    model: opts.model,
    max_tokens: opts.maxTokens ?? 4096,
    system: systemMessages.length > 0
      ? systemMessages.map((m) => m.content).join("\n\n")
      : undefined,
    messages: nonSystemMessages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    temperature: opts.temperature ?? 0.7,
  };
}

function buildGoogleBody(opts: ChatCompletionOptions) {
  // Google uses a flat list of contents with role + parts
  // Map system + user/assistant messages into a single contents array
  const contents = opts.messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  // Merge consecutive same-role entries to avoid Google API errors
  const merged: typeof contents = [];
  for (const c of contents) {
    const last = merged[merged.length - 1];
    if (last && last.role === c.role) {
      last.parts.push(...c.parts);
    } else {
      merged.push(c);
    }
  }

  return {
    contents: merged,
    generationConfig: {
      temperature: opts.temperature ?? 0.7,
      maxOutputTokens: opts.maxTokens,
    },
  };
}

function buildRequestBody(provider: Provider, opts: ChatCompletionOptions): unknown {
  switch (provider) {
    case "deepseek":
      return buildDeepSeekBody(opts);
    case "openai":
    case "openrouter":
      return buildOpenAICompatBody(opts);
    case "anthropic":
      return buildAnthropicBody(opts);
    case "google":
      return buildGoogleBody(opts);
  }
}

// ─── Response parsers (per-provider) ─────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseOpenAIUsage(usage: any) {
  if (!usage) return undefined;
  return {
    promptTokens: usage.prompt_tokens ?? usage.promptTokens ?? 0,
    completionTokens: usage.completion_tokens ?? usage.completionTokens ?? 0,
    totalTokens: usage.total_tokens ?? usage.totalTokens ?? 0,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseAnthropicUsage(usage: any) {
  if (!usage) return undefined;
  return {
    promptTokens: usage.input_tokens ?? 0,
    completionTokens: usage.output_tokens ?? 0,
    totalTokens: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseResponseBody(provider: Provider, data: any): ChatCompletionResult {
  switch (provider) {
    case "deepseek":
    case "openai":
    case "openrouter":
      return {
        content: data.choices[0].message.content,
        model: data.model ?? "",
        provider,
        usage: parseOpenAIUsage(data.usage),
      };
    case "anthropic":
      return {
        content: data.content
          .filter((c: { type: string }) => c.type === "text")
          .map((c: { text: string }) => c.text)
          .join(""),
        model: data.model ?? "",
        provider,
        usage: parseAnthropicUsage(data.usage),
      };
    case "google":
      return {
        content: data.candidates[0].content.parts
          .map((p: { text: string }) => p.text)
          .join(""),
        model: data.modelVersion ?? "",
        provider,
      };
  }
}

// ─── URL builder ──────────────────────────────────────────────

function buildUrl(provider: Provider, opts: ChatCompletionOptions): string {
  const config = PROVIDER_CONFIGS[provider];
  let endpoint = config.chatEndpoint;

  // Google: substitute {model} in the URL path
  if (provider === "google") {
    endpoint = endpoint.replace("{model}", opts.model);
  }

  let url = `${config.baseUrl}${endpoint}`;

  // Google: append API key as query parameter
  if (provider === "google") {
    url += `?key=${encodeURIComponent(opts.apiKey)}`;
  }

  return url;
}

// ─── Retry config ─────────────────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [1000, 2000, 4000];
const RETRYABLE_STATUSES = new Set([429, 503]);

// ─── Main API function ────────────────────────────────────────

export async function createChatCompletion(
  opts: ChatCompletionOptions
): Promise<ChatCompletionResult> {
  const url = buildUrl(opts.provider, opts);
  const config = PROVIDER_CONFIGS[opts.provider];
  const body = buildRequestBody(opts.provider, opts);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: config.headers(opts.apiKey),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const status = res.status;
        if (RETRYABLE_STATUSES.has(status) && attempt < MAX_RETRIES) {
          const delay = RETRY_DELAYS_MS[attempt];
          console.warn(
            `${opts.provider} ${status}, retrying in ${delay}ms (${attempt + 1}/${MAX_RETRIES})`
          );
          await sleep(delay);
          continue;
        }
        const err = await res.text();
        throw new Error(`${opts.provider} error (${status}): ${err}`);
      }

      const data = await res.json();
      const result = parseResponseBody(opts.provider, data);

      // Defensive: surface empty responses clearly
      if (!result.content || result.content.trim().length === 0) {
        console.error(
          `[createChatCompletion] Empty content from ${opts.provider}. ` +
          `status=${res.status} model=${opts.model} ` +
          `dataKeys=${Object.keys(data).join(",")} ` +
          `choices=${JSON.stringify(data.choices?.slice(0, 1))}`
        );
        throw new Error(
          `${opts.provider} returned empty content. ` +
          `Model "${opts.model}" may be invalid or API key may be unauthorized. ` +
          `HTTP ${res.status}. Raw data keys: ${Object.keys(data).join(", ")}`
        );
      }

      return result;
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

  throw lastError ?? new Error(`${opts.provider} request failed after all retries`);
}
