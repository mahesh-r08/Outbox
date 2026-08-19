const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export interface CsvParseResult {
  validEmails: string[];
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  totalDetected: number;
  preview: string[];
  sampleInvalids: string[];
}

/**
 * Parses raw text or CSV content and extracts unique, valid email addresses.
 */
export function parseEmailList(content: string): CsvParseResult {
  if (!content || typeof content !== 'string') {
    return {
      validEmails: [],
      validCount: 0,
      invalidCount: 0,
      duplicateCount: 0,
      totalDetected: 0,
      preview: [],
      sampleInvalids: [],
    };
  }

  // Split by newlines, commas, semicolons, tabs, or quotes
  const rawTokens = content
    .split(/[\r\n,;]+/)
    .map((token) => token.trim().replace(/^["']|["']$/g, '').trim())
    .filter((token) => token.length > 0);

  // Filter out headers like "email", "emails", "lead", "contact"
  const ignoredHeaders = new Set(['email', 'emails', 'lead', 'leads', 'recipient', 'recipients', 'contact', 'to']);

  const seen = new Set<string>();
  const validEmails: string[] = [];
  const sampleInvalids: string[] = [];
  let duplicateCount = 0;
  let invalidCount = 0;

  for (const token of rawTokens) {
    const lower = token.toLowerCase();

    if (ignoredHeaders.has(lower)) {
      continue;
    }

    if (EMAIL_REGEX.test(token)) {
      if (seen.has(lower)) {
        duplicateCount++;
      } else {
        seen.add(lower);
        validEmails.push(token);
      }
    } else {
      invalidCount++;
      if (sampleInvalids.length < 5) {
        sampleInvalids.push(token);
      }
    }
  }

  return {
    validEmails,
    validCount: validEmails.length,
    invalidCount,
    duplicateCount,
    totalDetected: rawTokens.length,
    preview: validEmails.slice(0, 10),
    sampleInvalids,
  };
}
