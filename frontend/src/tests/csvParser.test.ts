import { describe, it, expect } from 'vitest';
import { parseEmailList } from '../lib/csvParser.js';

describe('Frontend CSV / Lead Parser', () => {
  it('parses multi-line text input and strips quotes', () => {
    const raw = `"lead1@test.com"\n'lead2@test.com'\nlead3@test.com`;
    const result = parseEmailList(raw);

    expect(result.validCount).toBe(3);
    expect(result.validEmails).toEqual(['lead1@test.com', 'lead2@test.com', 'lead3@test.com']);
  });

  it('correctly tracks duplicate leads count without adding to valid list', () => {
    const raw = `alex@test.com\nalex@test.com\nALEX@TEST.COM\nsarah@test.com`;
    const result = parseEmailList(raw);

    expect(result.validCount).toBe(2);
    expect(result.duplicateCount).toBe(2);
    expect(result.validEmails).toEqual(['alex@test.com', 'sarah@test.com']);
  });

  it('returns sample invalid lines and count', () => {
    const raw = `valid@reachinbox.ai\nbad-line-here\nmissing-at-sign.com`;
    const result = parseEmailList(raw);

    expect(result.validCount).toBe(1);
    expect(result.invalidCount).toBe(2);
    expect(result.sampleInvalids.length).toBe(2);
  });
});
