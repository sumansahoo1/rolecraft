/**
 * Local storage utilities for RoleCraft.
 *
 * All user data (API key, master resume, preferences) is stored in the
 * browser's localStorage. Nothing is sent to any server — API calls go
 * directly from the browser to the AI provider.
 */

import type { StoredData, MasterResume, Provider } from "@/types";

const KEYS = {
  // Legacy generic key (backward compat)
  apiKey: "rolecraft_api_key",
  // Per-provider keys
  provider: "rolecraft_provider",
  apiKey_deepseek: "rolecraft_api_key_deepseek",
  apiKey_openai: "rolecraft_api_key_openai",
  apiKey_anthropic: "rolecraft_api_key_anthropic",
  apiKey_google: "rolecraft_api_key_google",
  apiKey_openrouter: "rolecraft_api_key_openrouter",
  model: "rolecraft_model",
  masterResume: "rolecraft_master_resume",
  preferences: "rolecraft_preferences",
} as const;

const API_KEY_KEYS: Record<Provider, string> = {
  deepseek: KEYS.apiKey_deepseek,
  openai: KEYS.apiKey_openai,
  anthropic: KEYS.apiKey_anthropic,
  google: KEYS.apiKey_google,
  openrouter: KEYS.apiKey_openrouter,
};

// ─── Provider ─────────────────────────────────────────────────

export function getProvider(): Provider {
  if (typeof window === "undefined") return "deepseek";
  const stored = localStorage.getItem(KEYS.provider);
  if (stored === "deepseek" || stored === "openai" || stored === "anthropic" || stored === "google" || stored === "openrouter") {
    return stored;
  }
  return "deepseek";
}

export function setProvider(provider: Provider): void {
  localStorage.setItem(KEYS.provider, provider);
}

// ─── API Key (per-provider + legacy compat) ───────────────────

export function getApiKey(provider?: Provider): string | null {
  if (typeof window === "undefined") return null;

  // If a specific provider is requested, read its per-provider key
  if (provider) {
    return localStorage.getItem(API_KEY_KEYS[provider]);
  }

  // No provider specified: read currently-selected provider's key
  const currentProvider = getProvider();
  const perProviderKey = localStorage.getItem(API_KEY_KEYS[currentProvider]);
  if (perProviderKey) return perProviderKey;

  // Backward compat: check legacy key and migrate it
  const legacyKey = localStorage.getItem(KEYS.apiKey);
  if (legacyKey) {
    // Migrate to deepseek (the only provider that existed before multi-provider)
    localStorage.setItem(API_KEY_KEYS.deepseek, legacyKey);
    // Clear the legacy key so we don't keep migrating
    localStorage.removeItem(KEYS.apiKey);
    return legacyKey;
  }

  return null;
}

export function setApiKey(key: string, provider?: Provider): void {
  const p = provider ?? getProvider();
  localStorage.setItem(API_KEY_KEYS[p], key);
  // Clear legacy key when using per-provider storage
  localStorage.removeItem(KEYS.apiKey);
}

export function clearApiKey(): void {
  // Clear all provider keys + legacy
  localStorage.removeItem(KEYS.apiKey);
  Object.values(API_KEY_KEYS).forEach((k) => localStorage.removeItem(k));
}

// ─── Model ───────────────────────────────────────────────────

export function getModel(): string {
  if (typeof window === "undefined") return "deepseek-v4-pro";
  return localStorage.getItem(KEYS.model) ?? "deepseek-v4-pro";
}

export function setModel(model: string): void {
  localStorage.setItem(KEYS.model, model);
}

// ─── Master Resume ──────────────────────────────────────────

export function getMasterResume(): MasterResume | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEYS.masterResume);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MasterResume;
  } catch {
    return null;
  }
}

export function setMasterResume(resume: MasterResume): void {
  localStorage.setItem(KEYS.masterResume, JSON.stringify(resume));
}

export function clearMasterResume(): void {
  localStorage.removeItem(KEYS.masterResume);
}

// ─── Preferences ────────────────────────────────────────────

export function getPreferences(): StoredData["preferences"] | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEYS.preferences);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredData["preferences"];
  } catch {
    return null;
  }
}

export function setPreferences(
  prefs: NonNullable<StoredData["preferences"]>
): void {
  localStorage.setItem(KEYS.preferences, JSON.stringify(prefs));
}

// ─── Bulk ───────────────────────────────────────────────────

export function getAllStoredData(): Partial<StoredData> {
  return {
    apiKey: getApiKey() ?? undefined,
    provider: getProvider(),
    model: getModel(),
    masterResume: getMasterResume() ?? undefined,
    preferences: getPreferences() ?? undefined,
  };
}

export function clearAll(): void {
  Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
}
