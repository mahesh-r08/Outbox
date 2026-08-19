import { describe, it, expect } from 'vitest';

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

function parseEmailList(content: string) {
  if (!content || typeof content !== 'string') {
    return { validEmails: [], validCount: 0, invalidCount: 0, duplicateCount: 0 };
  }

  const rawTokens = content
    .split(/[\r\n,;]+/)
    .map((token) => token.trim().replace(/^["']|["']$/g, '').trim())
    .filter((token) => token.length > 0);

  const ignoredHeaders = new Set(['email', 'emails', 'lead', 'leads', 'recipient', 'recipients', 'contact', 'to']);

  const seen = new Set<string>();
  const validEmails: string[] = [];
  let duplicateCount = 0;
  let invalidCount = 0;

  for (const token of rawTokens) {
    const lower = token.toLowerCase();
    if (ignoredHeaders.has(lower)) continue;

    if (EMAIL_REGEX.test(token)) {
      if (seen.has(lower)) {
        duplicateCount++;
      } else {
        seen.add(lower);
        validEmails.push(token);
      }
    } else {
      invalidCount++;
    }
  }

  return {
    validEmails,
    validCount: validEmails.length,
    invalidCount,
    duplicateCount,
  };
}

describe('CSV & Text Email Lead Parser', () => {
  it('correctly parses plain comma-separated emails', () => {
    const input = 'alex@example.com, sarah@company.io, mike@domain.org';
    const result = parseEmailList(input);

    expect(result.validCount).toBe(3);
    expect(result.validEmails).toEqual(['alex@example.com', 'sarah@company.io', 'mike@domain.org']);
    expect(result.invalidCount).toBe(0);
    expect(result.duplicateCount).toBe(0);
  });

  it('filters out column headers like "email", "recipients"', () => {
    const input = `email\njohn@example.com\njane@company.com`;
    const result = parseEmailList(input);

    expect(result.validCount).toBe(2);
    expect(result.validEmails).toEqual(['john@example.com', 'jane@company.com']);
  });

  it('deduplicates emails case-insensitively', () => {
    const input = `john@example.com\nJOHN@EXAMPLE.COM\nJohn@Example.com\nsarah@company.com`;
    const result = parseEmailList(input);

    expect(result.validCount).toBe(2);
    expect(result.duplicateCount).toBe(2);
    expect(result.validEmails).toEqual(['john@example.com', 'sarah@company.com']);
  });

  it('identifies and ignores invalid email structures', () => {
    const input = `valid@example.com\nnot-an-email\n@missing-username.com\ninvalid@domain\nanother.valid@domain.co.uk`;
    const result = parseEmailList(input);

    expect(result.validCount).toBe(2);
    expect(result.invalidCount).toBe(3);
    expect(result.validEmails).toEqual(['valid@example.com', 'another.valid@domain.co.uk']);
  });
});
