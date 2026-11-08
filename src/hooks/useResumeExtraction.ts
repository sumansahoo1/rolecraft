'use client';

import { useState, useCallback } from 'react';
import {
  createChatCompletion,
  extractJsonFromLLMResponse,
  RESUME_EXTRACTION_PROMPT,
} from '@/lib/ai';
import { getApiKey, getModel, getProvider, setExtractionJson } from '@/lib/storage';
import { parseMasterResume } from '@/lib/resume/normalize';
import type { MasterResume } from '@/types';

interface ExtractionState {
  loading: boolean;
  error: string | null;
  result: MasterResume | null;
  rawJson: Record<string, unknown> | null;
}

export function useResumeExtraction() {
  const [state, setState] = useState<ExtractionState>({
    loading: false,
    error: null,
    result: null,
    rawJson: null,
  });

  const extract = useCallback(async (rawText: string) => {
    const apiKey = getApiKey();
    if (!apiKey) {
      setState({
        loading: false,
        error: 'API key not set. Go to Settings.',
        result: null,
        rawJson: null,
      });
      return null;
    }

    setState({ loading: true, error: null, result: null, rawJson: null });

    try {
      const res = await createChatCompletion({
        provider: getProvider(),
        model: getModel(),
        apiKey,
        messages: [
          { role: 'system', content: RESUME_EXTRACTION_PROMPT },
          {
            role: 'user',
            content: `Extract structured information from this resume:\n\n${rawText}`,
          },
        ],
        temperature: 0.1,
        maxTokens: 16384,
      });

      const raw = extractJsonFromLLMResponse(res.content) as Record<string, unknown>;

      setExtractionJson(raw);

      const parsed = parseMasterResume(raw);

      setState({ loading: false, error: null, result: parsed, rawJson: raw });
      return parsed;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Extraction failed';
      setState({ loading: false, error: message, result: null, rawJson: null });
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ loading: false, error: null, result: null, rawJson: null });
  }, []);

  return { ...state, extract, reset };
}
