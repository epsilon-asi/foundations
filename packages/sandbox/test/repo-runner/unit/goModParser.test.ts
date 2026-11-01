import { describe, expect, it } from 'vitest';

import { parseGoMod } from '../../../src/repo-runner/runners/golang/goModParser.js';

describe('parseGoMod', () => {
  it('reads module, go, and toolchain directives', () => {
    const source = [
      '// leading comment',
      'module example.com/project // trailing comment',
      '',
      'go 1.22.0',
      'toolchain go1.22.5',
      '',
      'require (',
      '\tgo.uber.org/zap v1.27.0',
      '\tgolang.org/x/tools v0.20.0 // indirect',
      ')',
    ].join('\n');

    expect(parseGoMod(source)).toEqual({
      modulePath: 'example.com/project',
      goVersion: '1.22.0',
      toolchain: 'go1.22.5',
    });
  });

  it('returns null for absent optional directives and handles CRLF and quoted module paths', () => {
    expect(parseGoMod('module "example.com/quoted"\r\n')).toEqual({
      modulePath: 'example.com/quoted',
      goVersion: null,
      toolchain: null,
    });
  });

  it('ignores commented-out directives and keeps the first occurrence', () => {
    expect(parseGoMod('// module example.com/wrong\nmodule example.com/right\nmodule example.com/later\n')).toEqual({
      modulePath: 'example.com/right',
      goVersion: null,
      toolchain: null,
    });
  });

  it('throws when the module directive is missing', () => {
    expect(() => parseGoMod('go 1.22\n')).toThrow('missing module directive');
  });
});
