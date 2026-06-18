// ─── AI Provider ────────────────────────────────────────────

export type DeepSeekModel = "deepseek-chat" | "deepseek-flash";

// ─── Resume Data ────────────────────────────────────────────

export interface Experience {
  company: string;
  role: string;
  duration: string;
  highlights: string[];
}

export interface Education {
  institution: string;
  degree: string;
  field: string;
  year: string;
}

export interface MasterResume {
  name: string;
  email: string;
  phone?: string;
  linkedin?: string;
  portfolio?: string;
  summary: string;
  skills: string[];
  experience: Experience[];
  education: Education[];
  certifications?: string[];
  projects?: string[];
  customSections?: Record<string, string[]>;
}

// ─── AI Pipeline Types ─────────────────────────────────────

export type PipelineStep =
  | "jd-analysis"
  | "experience-mapping"
  | "resume-generation"
  | "resume-critique";

export interface JDAnalysis {
  roleTitle: string;
  requiredSkills: string[];
  niceToHaveSkills: string[];
  keyResponsibilities: string[];
  experienceLevel: string;
  industryContext: string;
  keywords: string[];
}

export interface ExperienceMapping {
  matchedSkills: string[];
  missingSkills: string[];
  experienceGap: string | null;
  relevanceScore: number; // 0-100
  notes: string[];
}

export interface ResumeCritique {
  score: number; // 0-100
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  atsScore: number;
  isConverged: boolean;
}

// ─── Pipeline State ────────────────────────────────────────

export interface PipelineState {
  jd: string;
  masterResume: MasterResume;
  step: PipelineStep;
  analysis: JDAnalysis | null;
  mapping: ExperienceMapping | null;
  currentResume: string | null;
  critique: ResumeCritique | null;
  iteration: number;
  history: Array<{
    iteration: number;
    resume: string;
    critique: ResumeCritique;
  }>;
}

// ─── Storage ────────────────────────────────────────────────

export interface StoredData {
  apiKey?: string;
  model?: DeepSeekModel;
  masterResume?: MasterResume;
  preferences?: {
    tone?: "professional" | "casual" | "technical";
    format?: "bullet" | "paragraph";
  };
}

// ─── App Status ─────────────────────────────────────────────

export type AppStatus = "idle" | "running" | "paused" | "complete" | "error";
