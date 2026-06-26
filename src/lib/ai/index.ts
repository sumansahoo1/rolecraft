export { createChatCompletion, PROVIDER_CONFIGS, getProviderConfig, getDefaultModel } from "./provider";
export { extractJsonFromLLMResponse } from "./json-parser";
export type { ChatMessage, ChatCompletionOptions, ChatCompletionResult } from "./provider";
export {
  RESUME_EXTRACTION_PROMPT,
  JD_ANALYSIS_PROMPT,
  EXPERIENCE_MAPPING_PROMPT,
  RESUME_GENERATION_PROMPT,
  RESUME_REVISION_PROMPT,
  RESUME_CRITIQUE_PROMPT,
  RESUME_SPEC_GENERATION_PROMPT,
} from "./prompts";
