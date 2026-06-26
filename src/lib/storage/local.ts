/**
 * Local storage utilities for RoleCraft.
 *
 * All user data (API key, master resume, preferences) is stored in the
 * browser's localStorage. Nothing is sent to any server — API calls go
 * directly from the browser to the AI provider.
 */

import type { StoredData, MasterResume, DeepSeekModel } from "@/types";

const KEYS = {
  apiKey: "rolecraft_api_key",
  model: "rolecraft_model",
  masterResume: "rolecraft_master_resume",
  preferences: "rolecraft_preferences",
} as const;

// ─── API Key ────────────────────────────────────────────────

export function getApiKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEYS.apiKey);
}

export function setApiKey(key: string): void {
  localStorage.setItem(KEYS.apiKey, key);
}

export function clearApiKey(): void {
  localStorage.removeItem(KEYS.apiKey);
}

// ─── Model ───────────────────────────────────────────────────

export function getModel(): DeepSeekModel {
  if (typeof window === "undefined") return "deepseek-v4-pro";
  return (localStorage.getItem(KEYS.model) as DeepSeekModel) ?? "deepseek-v4-pro";
}

export function setModel(model: DeepSeekModel): void {
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
    model: getModel(),
    masterResume: getMasterResume() ?? undefined,
    preferences: getPreferences() ?? undefined,
  };
}

export function clearAll(): void {
  Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
}
