function tryParse(s: string): unknown | undefined {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

function findJsonBlock(s: string, open: string, close: string): string | undefined {
  let depth = 0;
  let start = -1;
  let inString = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === open) {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === close) {
      depth--;
      if (depth === 0 && start !== -1) return s.slice(start, i + 1);
    }
  }
  return undefined;
}

function sanitize(s: string): string {
  return s
    .replace(/^\uFEFF/, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/,(\s*[}\]])/g, '$1');
}

export function extractJsonFromLLMResponse(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('extractJsonFromLLMResponse: received empty string');
  }

  const cleaned = trimmed
    .replace(/```(?:json)?\s*\n?/gi, '')
    .replace(/```\s*$/gm, '')
    .trim();

  // Strategy 1: direct parse
  let result = tryParse(cleaned);
  if (result !== undefined) return result;

  // Strategy 2: brace-counted object extraction (handles nested properly)
  const objBlock = findJsonBlock(cleaned, '{', '}');
  if (objBlock) {
    result = tryParse(objBlock);
    if (result !== undefined) return result;
  }

  // Strategy 3: brace-counted array extraction
  const arrBlock = findJsonBlock(cleaned, '[', ']');
  if (arrBlock) {
    result = tryParse(arrBlock);
    if (result !== undefined) return result;
  }

  // Strategy 4: sanitize (BOM, control chars, trailing commas) + retry
  const sanitized = sanitize(cleaned);
  result = tryParse(sanitized);
  if (result !== undefined) return result;

  // Strategy 5: sanitize + block extraction
  const sanitizedObjBlock = findJsonBlock(sanitized, '{', '}');
  if (sanitizedObjBlock) {
    result = tryParse(sanitizedObjBlock);
    if (result !== undefined) return result;
  }

  const sanitizedArrBlock = findJsonBlock(sanitized, '[', ']');
  if (sanitizedArrBlock) {
    result = tryParse(sanitizedArrBlock);
    if (result !== undefined) return result;
  }

  throw new Error(
    `extractJsonFromLLMResponse: unable to parse JSON. ` +
      `Raw length: ${raw.length}. ` +
      `First 200 chars: ${raw.slice(0, 200)}. ` +
      `Last 200 chars: ${raw.slice(-200)}`
  );
}
