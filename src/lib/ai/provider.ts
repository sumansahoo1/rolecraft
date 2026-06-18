/**
 * AI Provider interface for RoleCraft.
 *
 * Architecture: RoleCraft calls the AI provider directly from the browser.
 * The user's API key is stored in localStorage and passed with each request.
 * No backend proxy needed — the app is fully client-side.
 *
 * Supported Providers:
 * - OpenAI (GPT-4o / GPT-4o-mini)
 * - Anthropic (Claude Sonnet / Haiku)
 * - Google (Gemini)
 * - OpenRouter (multi-model access)
 *
 * To add a new provider:
 * 1. Add a case in `createChatCompletion`
 * 2. Add the provider type to `AIProvider` type
 */

export type AIProvider = "openai" | "anthropic" | "google" | "openrouter";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionOptions {
  provider: AIProvider;
  model: string;
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

const PROVIDER_BASE_URLS: Record<AIProvider, string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  google: "https://generativelanguage.googleapis.com/v1beta",
  openrouter: "https://openrouter.ai/api/v1",
};

export async function createChatCompletion(
  opts: ChatCompletionOptions
): Promise<ChatCompletionResult> {
  const baseUrl = PROVIDER_BASE_URLS[opts.provider];

  // --- OpenAI ---
  if (opts.provider === "openai") {
    const res = await fetch(`${baseUrl}/chat/completions`, {
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
      throw new Error(`OpenAI error (${res.status}): ${err}`);
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

  // --- Anthropic ---
  if (opts.provider === "anthropic") {
    const res = await fetch(`${baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": opts.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: opts.model,
        max_tokens: opts.maxTokens ?? 4096,
        messages: opts.messages.filter((m) => m.role !== "system"),
        system:
          opts.messages.find((m) => m.role === "system")?.content ?? undefined,
        temperature: opts.temperature ?? 0.7,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic error (${res.status}): ${err}`);
    }

    const data = await res.json();
    return {
      content: data.content[0].text,
      model: data.model,
    };
  }

  // --- Google Gemini ---
  if (opts.provider === "google") {
    const sysMsg = opts.messages.find((m) => m.role === "system");
    const contents = opts.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const body: Record<string, unknown> = { contents };
    if (sysMsg) {
      body.systemInstruction = {
        parts: [{ text: sysMsg.content }],
      };
    }

    const res = await fetch(
      `${baseUrl}/models/${opts.model}:generateContent?key=${opts.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Google AI error (${res.status}): ${err}`);
    }

    const data = await res.json();
    return {
      content:
        data.candidates?.[0]?.content?.parts?.[0]?.text ?? "No response",
      model: opts.model,
    };
  }

  // --- OpenRouter (OpenAI-compatible) ---
  if (opts.provider === "openrouter") {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.apiKey}`,
        "HTTP-Referer": window.location.origin,
        "X-Title": "RoleCraft",
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
      throw new Error(`OpenRouter error (${res.status}): ${err}`);
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

  throw new Error(`Unsupported provider: ${opts.provider}`);
}
