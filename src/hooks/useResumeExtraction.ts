"use client";

import { useState, useCallback } from "react";
import { createChatCompletion, RESUME_EXTRACTION_PROMPT } from "@/lib/ai";
import { getApiKey, getModel } from "@/lib/storage";
import type { MasterResume, Project, OpenSource, OtherWork } from "@/types";

interface ExtractionState {
  loading: boolean;
  error: string | null;
  result: MasterResume | null;
}

function parseProjects(raw: unknown): Project[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  if (raw.length === 0) return undefined;
  return raw.map((item: unknown) => {
    if (typeof item === "string") {
      return { name: item, description: "" };
    }
    const p = item as Record<string, unknown>;
    return {
      name: String(p.name ?? ""),
      description: String(p.description ?? ""),
      url: p.url ? String(p.url) : undefined,
      technologies: Array.isArray(p.technologies)
        ? p.technologies.map(String)
        : undefined,
      duration: p.duration ? String(p.duration) : undefined,
      highlights: Array.isArray(p.highlights)
        ? p.highlights.map(String)
        : undefined,
    };
  });
}

function parseOpenSource(raw: unknown): OpenSource[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  if (raw.length === 0) return undefined;
  return raw.map((item: unknown) => {
    const o = item as Record<string, unknown>;
    return {
      name: String(o.name ?? ""),
      description: String(o.description ?? ""),
      url: o.url ? String(o.url) : undefined,
      role: o.role ? String(o.role) : undefined,
      technologies: Array.isArray(o.technologies)
        ? o.technologies.map(String)
        : undefined,
      highlights: Array.isArray(o.highlights)
        ? o.highlights.map(String)
        : undefined,
    };
  });
}

function parseOtherWorks(raw: unknown): OtherWork[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  if (raw.length === 0) return undefined;
  return raw.map((item: unknown) => {
    const w = item as Record<string, unknown>;
    return {
      title: String(w.title ?? ""),
      type: String(w.type ?? "other"),
      description: String(w.description ?? ""),
      url: w.url ? String(w.url) : undefined,
      date: w.date ? String(w.date) : undefined,
    };
  });
}

export function useResumeExtraction() {
  const [state, setState] = useState<ExtractionState>({
    loading: false,
    error: null,
    result: null,
  });

  const extract = useCallback(async (rawText: string) => {
    const apiKey = getApiKey();
    if (!apiKey) {
      setState({ loading: false, error: "API key not set. Go to Settings.", result: null });
      return null;
    }

    setState({ loading: true, error: null, result: null });

    try {
      const res = await createChatCompletion({
        model: getModel(),
        apiKey,
        messages: [
          { role: "system", content: RESUME_EXTRACTION_PROMPT },
          {
            role: "user",
            content: `Extract structured information from this resume:\n\n${rawText}`,
          },
        ],
        temperature: 0.1,
        maxTokens: 4096,
      });

      const jsonStr = res.content.replace(/```json\n?|```\n?/g, "").trim();
      const raw = JSON.parse(jsonStr);

      const parsed: MasterResume = {
        name: raw.name ?? "",
        email: raw.email ?? "",
        phone: raw.phone ?? null,
        linkedin: raw.linkedin ?? null,
        portfolio: raw.portfolio ?? null,
        summary: raw.summary ?? "",
        skills: Array.isArray(raw.skills) ? raw.skills : [],
        experience: Array.isArray(raw.experience)
          ? raw.experience.map((e: Record<string, unknown>) => ({
              company: e.company ?? "",
              role: e.role ?? "",
              duration: e.duration ?? "",
              highlights: Array.isArray(e.highlights) ? e.highlights : [],
            }))
          : [],
        education: Array.isArray(raw.education)
          ? raw.education.map((e: Record<string, unknown>) => ({
              institution: e.institution ?? "",
              degree: e.degree ?? "",
              field: e.field ?? "",
              year: e.year ?? "",
            }))
          : [],
        certifications: Array.isArray(raw.certifications)
          ? raw.certifications
          : null,
        projects: parseProjects(raw.projects),
        openSource: parseOpenSource(raw.openSource),
        otherWorks: parseOtherWorks(raw.otherWorks),
      };

      setState({ loading: false, error: null, result: parsed });
      return parsed;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Extraction failed";
      setState({ loading: false, error: message, result: null });
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ loading: false, error: null, result: null });
  }, []);

  return { ...state, extract, reset };
}
