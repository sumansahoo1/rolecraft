import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAll,
  clearApiKey,
  clearGitHubToken,
  getApiKey,
  getGitHubToken,
  getProvider,
  getProviderApiKey,
  setApiKey,
  setGitHubToken,
  setPreferences,
  setProvider,
} from './local';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal('window', {});
  vi.stubGlobal('localStorage', storage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Local storage', () => {
  it('sets, reads, and clears the GitHub token', () => {
    expect(getGitHubToken()).toBeNull();
    setGitHubToken('  ghp_test  ');
    expect(getGitHubToken()).toBe('ghp_test');
    clearGitHubToken();
    expect(getGitHubToken()).toBeNull();
  });

  it('clears the GitHub token through clearAll', () => {
    setGitHubToken('ghp_test');
    setPreferences({ tone: 'technical' });
    clearAll();
    expect(getGitHubToken()).toBeNull();
    expect(localStorage.getItem('rolecraft_preferences')).toBeNull();
  });

  it('migrates a legacy DeepSeek key but ignores it for other providers', () => {
    localStorage.setItem('rolecraft_api_key', 'legacy-key');
    expect(getProviderApiKey('deepseek')).toBe('legacy-key');
    expect(localStorage.getItem('rolecraft_api_key_deepseek')).toBe('legacy-key');
    expect(localStorage.getItem('rolecraft_api_key')).toBeNull();

    localStorage.setItem('rolecraft_api_key', 'legacy-key-2');
    expect(getProviderApiKey('openai')).toBeNull();
    expect(localStorage.getItem('rolecraft_api_key')).toBe('legacy-key-2');
  });

  it('keeps provider keys isolated and follows the selected provider', () => {
    setApiKey('deepseek-key', 'deepseek');
    setApiKey('openai-key', 'openai');
    expect(getApiKey('deepseek')).toBe('deepseek-key');
    expect(getApiKey('openai')).toBe('openai-key');
    setProvider('openai');
    expect(getProvider()).toBe('openai');
    expect(getApiKey()).toBe('openai-key');
  });

  it('clears the legacy key on write and all provider keys on clear', () => {
    localStorage.setItem('rolecraft_api_key', 'legacy');
    setApiKey('new-key', 'deepseek');
    expect(localStorage.getItem('rolecraft_api_key')).toBeNull();
    setApiKey('openai-key', 'openai');
    clearApiKey();
    expect(getApiKey('deepseek')).toBeNull();
    expect(getApiKey('openai')).toBeNull();
  });
});
