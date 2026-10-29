import { describe, expect, it } from 'vitest';
import { appleScriptString } from '../../../src/native/utils/appleScriptEscape.js';

describe('appleScriptString', () => {
  it('escapes quotes, backslashes, spaces, apostrophes, and unicode safely', () => {
    expect(appleScriptString('/Users/me/A "quoted" \\ file’s résumé.pdf'))
      .toBe('"/Users/me/A \\"quoted\\" \\\\ file’s résumé.pdf"');
  });
});
