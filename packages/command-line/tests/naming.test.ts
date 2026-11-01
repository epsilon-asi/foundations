import { describe, expect, it } from 'vitest';
import { commandNameFromClass, parseFlags, toKebabCase, toScreamingSnakeCase } from '../src/index.js';

describe('naming', () => {
  it('converts to kebab-case', () => {
    expect(toKebabCase('logLevel')).toBe('log-level');
    expect(toKebabCase('HTTPServer')).toBe('http-server');
    expect(toKebabCase('my tool_name')).toBe('my-tool-name');
  });

  it('converts to SCREAMING_SNAKE_CASE', () => {
    expect(toScreamingSnakeCase('agent-engineer')).toBe('AGENT_ENGINEER');
    expect(toScreamingSnakeCase('myCli')).toBe('MY_CLI');
    expect(toScreamingSnakeCase('@scope/tool.js')).toBe('SCOPE_TOOL_JS');
  });

  it('derives command names from class names', () => {
    expect(commandNameFromClass('InfoCommand')).toBe('info');
    expect(commandNameFromClass('AgentEngineerCli')).toBe('agent-engineer');
    expect(commandNameFromClass('Command')).toBe('command');
  });

  it('parses the flag names out of commander flags', () => {
    expect(parseFlags('-l, --log-level <level>')).toEqual({ short: 'l', long: 'log-level' });
    expect(parseFlags('--dry-run')).toEqual({ short: undefined, long: 'dry-run' });
    expect(parseFlags('-v --verbosity [v]')).toEqual({ short: 'v', long: 'verbosity' });
    expect(parseFlags('-x')).toEqual({ short: 'x', long: undefined });
  });
});
