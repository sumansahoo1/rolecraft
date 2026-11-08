import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAll,
  getApiKey,
  getExtractionJson,
  getJdReaderFallbackEnabled,
  getProvider,
  setJdReaderFallbackEnabled,
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

describe('job-link reader preference', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', new MemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to enabled', () => {
    expect(getJdReaderFallbackEnabled()).toBe(true);
  });

  it('only an explicit false disables the reader', () => {
    localStorage.setItem('rolecraft_jd_reader_fallback', 'false');
    expect(getJdReaderFallbackEnabled()).toBe(false);

    localStorage.setItem('rolecraft_jd_reader_fallback', 'true');
    expect(getJdReaderFallbackEnabled()).toBe(true);

    localStorage.setItem('rolecraft_jd_reader_fallback', 'yes');
    expect(getJdReaderFallbackEnabled()).toBe(true);
  });

  it('writes the preference as true/false', () => {
    setJdReaderFallbackEnabled(false);
    expect(localStorage.getItem('rolecraft_jd_reader_fallback')).toBe('false');

    setJdReaderFallbackEnabled(true);
    expect(localStorage.getItem('rolecraft_jd_reader_fallback')).toBe('true');
  });

  it('removes the preference through clearAll', () => {
    setJdReaderFallbackEnabled(false);
    clearAll();

    expect(localStorage.getItem('rolecraft_jd_reader_fallback')).toBeNull();
    expect(getJdReaderFallbackEnabled()).toBe(true);
  });

  it('returns safe defaults when storage reads throw', () => {
    const blocked = {
      getItem: () => {
        throw new DOMException('denied', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('denied', 'SecurityError');
      },
      removeItem: () => {
        throw new DOMException('denied', 'SecurityError');
      },
    } as unknown as Storage;
    vi.stubGlobal('localStorage', blocked);

    expect(getJdReaderFallbackEnabled()).toBe(true);
    expect(getProvider()).toBe('deepseek');
    expect(getApiKey()).toBeNull();
    expect(getExtractionJson()).toBeNull();
  });
});
