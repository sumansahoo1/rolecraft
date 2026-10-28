/**
 * Local storage utilities for RoleCraft.
 *
 * Data stays in the browser. Requests go directly to AI providers,
 * ATS job-board APIs, and — only when the reader fallback is enabled —
 * r.jina.ai.
 */

import type { StoredData, Provider } from '@/types';

const KEYS = {
  // Legacy generic key (backward compat)
  apiKey: 'rolecraft_api_key',
  // Per-provider keys
  provider: 'rolecraft_provider',
  apiKey_deepseek: 'rolecraft_api_key_deepseek',
  apiKey_openai: 'rolecraft_api_key_openai',
  apiKey_anthropic: 'rolecraft_api_key_anthropic',
  apiKey_google: 'rolecraft_api_key_google',
  apiKey_openrouter: 'rolecraft_api_key_openrouter',
  model: 'rolecraft_model',
  extractionJson: 'rolecraft_extraction_json',

  preferences: 'rolecraft_preferences',
  jdReaderFallback: 'rolecraft_jd_reader_fallback',
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
  if (typeof window === 'undefined') return 'deepseek';
  try {
    const stored = localStorage.getItem(KEYS.provider);
    if (
      stored === 'deepseek' ||
      stored === 'openai' ||
      stored === 'anthropic' ||
      stored === 'google' ||
      stored === 'openrouter'
    ) {
      return stored;
    }
    return 'deepseek';
  } catch {
    return 'deepseek';
  }
}

export function setProvider(provider: Provider): void {
  localStorage.setItem(KEYS.provider, provider);
}

// ─── API Key (per-provider + legacy compat) ───────────────────

export function getApiKey(provider?: Provider): string | null {
  if (typeof window === 'undefined') return null;

  try {
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
  } catch {
    return null;
  }
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
  if (typeof window === 'undefined') return 'deepseek-v4-pro';
  return localStorage.getItem(KEYS.model) ?? 'deepseek-v4-pro';
}

export function setModel(model: string): void {
  localStorage.setItem(KEYS.model, model);
}

// ─── Raw Extraction JSON ──────────────────────────────────

export function getExtractionJson(): Record<string, unknown> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEYS.extractionJson);
    if (!raw) return null;
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function setExtractionJson(json: Record<string, unknown>): void {
  localStorage.setItem(KEYS.extractionJson, JSON.stringify(json));
}

export function clearExtractionJson(): void {
  localStorage.removeItem(KEYS.extractionJson);
}

// ─── Preferences ────────────────────────────────────────────

export function getPreferences(): StoredData['preferences'] | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(KEYS.preferences);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredData['preferences'];
  } catch {
    return null;
  }
}

export function setPreferences(prefs: NonNullable<StoredData['preferences']>): void {
  localStorage.setItem(KEYS.preferences, JSON.stringify(prefs));
}

// ─── Job-link reader fallback ──────────────────────────────

/**
 * Defaults to enabled. Only an explicit stored 'false' disables it.
 * Reads are guarded so private-mode/quota failures fall back to the default.
 */
export function getJdReaderFallbackEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(KEYS.jdReaderFallback) !== 'false';
  } catch {
    return true;
  }
}

export function setJdReaderFallbackEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEYS.jdReaderFallback, enabled ? 'true' : 'false');
}

// ─── Bulk ───────────────────────────────────────────────────

export function getAllStoredData(): Partial<StoredData> {
  return {
    apiKey: getApiKey() ?? undefined,
    provider: getProvider(),
    model: getModel(),
    extractionJson: getExtractionJson() ?? undefined,
    preferences: getPreferences() ?? undefined,
  };
}

export function clearAll(): void {
  Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
}
