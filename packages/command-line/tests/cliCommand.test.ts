import { describe, expect, it } from 'vitest';
import {
  CliCommand,
  CliDefinitionError,
  Command,
  OUTPUT_FORMATS,
  Option,
  describeCommand,
  renderOutput,
  runCli,
  runtimeInfo,
  type CliInfo,
  type CommandContext,
} from '../src/index.js';
import { captureIO } from './helpers/captureIO.js';

const CLI: CliInfo = { name: 'tool', version: '1.2.3', description: 'A tool.', package: undefined };

describe('renderOutput', () => {
  it('writes one padded line per property as text', () => {
    expect(renderOutput({ name: 'tool', version: '1.2.3' }, 'text')).toBe('name      tool\nversion   1.2.3\n');
  });

  it('widens the key column for long keys', () => {
    expect(renderOutput({ a: 1, repository: 'x' }, 'text')).toBe('a           1\nrepository  x\n');
  });

  it('writes object values as JSON and everything else as a string', () => {
    expect(renderOutput({ tags: ['a', 'b'], owner: { id: 1 }, none: null, ok: true }, 'text')).toBe(
      'tags      ["a","b"]\nowner     {"id":1}\nnone      null\nok        true\n',
    );
  });

  it('writes nothing as text for an empty object', () => {
    expect(renderOutput({}, 'text')).toBe('');
  });

  it('writes indented JSON', () => {
    expect(renderOutput({ name: 'tool', count: 2 }, 'json')).toBe('{\n  "name": "tool",\n  "count": 2\n}\n');
  });
});

describe('runtimeInfo', () => {
  it('reports the CLI and the runtime it runs on', () => {
    expect(runtimeInfo(CLI)).toEqual({
      name: 'tool',
      version: '1.2.3',
      node: process.version,
      platform: `${process.platform}-${process.arch}`,
    });
  });
});

describe('CliCommand', () => {
  @Command({ description: 'Show the status.' })
  class StatusCommand extends CliCommand {
    run({ io }: CommandContext): void {
      io.stdout(this.render({ state: 'clean', ahead: 2 }));
    }
  }

  @Command({ name: 'tool', version: '1.2.3', commands: [StatusCommand] })
  class Tool {}

  it('gives every subclass the format option', () => {
    const [status] = describeCommand(Tool).commands;
    expect(status?.options.map((option) => option.flags)).toEqual(['-f, --format <format>']);
    expect(OUTPUT_FORMATS).toEqual(['text', 'json']);
  });

  it('renders as text by default', async () => {
    const { io, stdout } = captureIO();

    await expect(runCli(Tool, ['status'], { io })).resolves.toBe(0);
    expect(stdout()).toBe('state     clean\nahead     2\n');
  });

  it('renders the format asked for', async () => {
    const { io, stdout } = captureIO();

    await expect(runCli(Tool, ['status', '-f', 'json'], { io })).resolves.toBe(0);
    expect(JSON.parse(stdout())).toEqual({ state: 'clean', ahead: 2 });
  });

  it('rejects other formats', async () => {
    const { io, stderr } = captureIO();

    await expect(runCli(Tool, ['status', '--format', 'xml'], { io })).resolves.toBe(1);
    expect(stderr()).toContain('Allowed choices are text, json');
  });

  it('lets a subclass report runtime info and replace render()', async () => {
    @Command()
    class Version extends CliCommand<Version> {
      run({ io, cli }: CommandContext<Version>): void {
        io.stdout(this.render(this.runtimeInfo(cli)));
      }

      protected override render(data: object): string {
        return this.format === 'text' ? `${Object.values(data).join(' ')}\n` : super.render(data);
      }
    }

    const text = captureIO();
    await runCli(Version, [], { io: text.io });
    expect(text.stdout()).toMatch(/^version 0\.0\.0-undefined-version v\d+/);

    const json = captureIO();
    await runCli(Version, ['-f', 'json'], { io: json.io });
    expect(JSON.parse(json.stdout())).toMatchObject({ name: 'version', node: process.version });
  });

  it('rejects a subclass that declares format again', () => {
    @Command()
    class Twice extends CliCommand {
      @Option.choice({ choices: OUTPUT_FORMATS, default: 'json' })
      override format: 'text' | 'json' = 'json';

      run(): void {}
    }

    expect(() => describeCommand(Twice)).toThrow(CliDefinitionError);
    expect(() => describeCommand(Twice)).toThrow('property "format" is decorated more than once.');
  });
});
