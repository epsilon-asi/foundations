import { describe, expect, it } from 'vitest';
import {
  ContainerParseError,
  parseDockerCreate,
  parseDockerDiff,
  parseDockerInfo,
  parseDockerInspect,
  parseDockerListJsonLines,
  parseDockerWait,
} from '../../src/container-runtime/index.js';

function parseErrorOf(parse: () => unknown): ContainerParseError {
  try {
    parse();
  } catch (error: unknown) {
    if (error instanceof ContainerParseError) {
      return error;
    }
    throw error;
  }
  throw new Error('expected a ContainerParseError');
}

describe('dockerParsing', () => {
  it('parses docker inspect output into a normalized inspection', () => {
    const inspection = parseDockerInspect(
      JSON.stringify([
        {
          Id: 'abc123',
          Name: '/container-1',
          Config: {
            Image: 'node:24',
            Labels: { 'sandbox.kind': 'coding-agent' },
          },
          State: {
            Status: 'running',
            Running: true,
            ExitCode: 0,
            Health: {
              Status: 'healthy',
            },
          },
          Mounts: [
            {
              Source: '/host/repo',
              Destination: '/workspace',
              RW: true,
              Type: 'bind',
              Mode: 'rw',
            },
          ],
        },
      ]),
    );

    expect(inspection).toEqual({
      id: 'abc123',
      name: 'container-1',
      image: 'node:24',
      mounts: [
        {
          source: '/host/repo',
          destination: '/workspace',
          rw: true,
          type: 'bind',
          mode: 'rw',
        },
      ],
      labels: { 'sandbox.kind': 'coding-agent' },
      state: {
        status: 'running',
        running: true,
        exitCode: 0,
        health: 'healthy',
      },
      raw: expect.any(Object) as unknown,
    });
  });

  it('parses health states without a health check as undefined', () => {
    const inspection = parseDockerInspect(
      JSON.stringify([
        {
          Id: 'abc123',
          Config: { Labels: {} },
          State: { Status: 'created' },
          Mounts: [],
        },
      ]),
    );

    expect(inspection.state?.status).toBe('created');
    expect(inspection.state?.health).toBeUndefined();
  });

  it('throws typed parse errors for empty, malformed, or incomplete inspect payloads', () => {
    expect(() => parseDockerInspect('')).toThrow(ContainerParseError);
    expect(() => parseDockerInspect('not-json')).toThrow(ContainerParseError);
    expect(() => parseDockerInspect(JSON.stringify([{}]))).toThrow(ContainerParseError);
  });

  it('parses docker ls JSON lines into summaries', () => {
    expect(
      parseDockerListJsonLines(
        [
          JSON.stringify({ ID: 'c1', Image: 'node:24', Names: 'one', State: 'running', Status: 'Up 1 second' }),
          JSON.stringify({ ID: 'c2', Image: 'node:24', Names: 'two', State: 'exited', Status: 'Exited (0)' }),
        ].join('\n'),
      ),
    ).toEqual([
      {
        id: 'c1',
        image: 'node:24',
        names: 'one',
        state: 'running',
        status: 'Up 1 second',
        raw: expect.any(Object) as unknown,
      },
      {
        id: 'c2',
        image: 'node:24',
        names: 'two',
        state: 'exited',
        status: 'Exited (0)',
        raw: expect.any(Object) as unknown,
      },
    ]);
  });

  it('returns an empty array for blank ls output and throws for malformed lines', () => {
    expect(parseDockerListJsonLines(' \n\n')).toEqual([]);
    expect(() => parseDockerListJsonLines('{bad-json}')).toThrow(ContainerParseError);
    expect(() => parseDockerListJsonLines(JSON.stringify({ Image: 'node:24' }))).toThrow(ContainerParseError);
  });

  it('parses docker diff output', () => {
    expect(parseDockerDiff('A /workspace/a\nC /workspace/b\nD /workspace/c\n')).toEqual([
      { kind: 'A', path: '/workspace/a' },
      { kind: 'C', path: '/workspace/b' },
      { kind: 'D', path: '/workspace/c' },
    ]);
  });

  it('returns an empty array for blank diff output and throws for malformed lines', () => {
    expect(parseDockerDiff('\n')).toEqual([]);
    expect(() => parseDockerDiff('X /workspace/a')).toThrow(ContainerParseError);
  });

  it('parses docker info payloads', () => {
    expect(
      parseDockerInfo(
        JSON.stringify({
          ID: 'daemon-id',
          Name: 'docker-host',
          ServerVersion: '28.0.0',
          OperatingSystem: 'Docker Engine',
          Architecture: 'x86_64',
          KernelVersion: '6.8.0',
          Driver: 'overlay2',
          CgroupVersion: '2',
        }),
      ),
    ).toEqual({
      id: 'daemon-id',
      name: 'docker-host',
      serverVersion: '28.0.0',
      operatingSystem: 'Docker Engine',
      architecture: 'x86_64',
      kernelVersion: '6.8.0',
      driver: 'overlay2',
      cgroupVersion: '2',
      raw: expect.any(Object) as unknown,
    });
  });

  it('maps a healthcheck without a status to null and ignores mistyped fields', () => {
    const inspection = parseDockerInspect(
      JSON.stringify([
        {
          Id: 'abc123',
          Config: { Image: 42, Labels: { keep: 'yes', drop: 1 } },
          State: { Running: 'yes', Health: {} },
          Mounts: [{ Source: '/host', RW: 'true' }, 'not-a-mount'],
        },
      ]),
    );

    expect(inspection).toEqual({
      id: 'abc123',
      labels: { keep: 'yes' },
      state: { health: null },
      mounts: [{ source: '/host' }, {}],
      raw: expect.any(Object) as unknown,
    });
  });

  it('omits state when the payload has no recognised state fields', () => {
    const minimal = parseDockerInspect(JSON.stringify([{ Id: 'abc123', State: { Unknown: true } }]));
    const noState = parseDockerInspect(JSON.stringify([{ Id: 'abc123' }]));

    expect(minimal).toEqual({ id: 'abc123', mounts: [], labels: {}, raw: { Id: 'abc123', State: { Unknown: true } } });
    expect(noState).not.toHaveProperty('state');
    expect(parseDockerInspect(JSON.stringify([{ Id: 'abc123', State: { Health: null } }])).state).toEqual({
      health: null,
    });
  });

  it('describes inspect parse failures with parser, payload and cause', () => {
    expect(parseErrorOf(() => parseDockerInspect(''))).toMatchObject({
      parser: 'parseDockerInspect',
      payload: '',
      message: 'parseDockerInspect: received an empty payload',
    });
    expect(parseErrorOf(() => parseDockerInspect('not-json')).cause).toBeInstanceOf(SyntaxError);
    expect(parseErrorOf(() => parseDockerInspect('{}')).message).toBe('parseDockerInspect: expected a JSON array');
    expect(parseErrorOf(() => parseDockerInspect('[]')).message).toBe(
      'parseDockerInspect: expected at least one container inspection object',
    );
  });

  it('reports the 1-based line number and raw line of malformed ls output', () => {
    const notJson = parseErrorOf(() => parseDockerListJsonLines('\n  {bad-json}  '));
    expect(notJson.message).toBe('parseDockerListJsonLines: line 2 was not valid JSON');
    expect(notJson.payload).toBe('  {bad-json}  ');
    expect(notJson.cause).toBeInstanceOf(SyntaxError);

    expect(parseErrorOf(() => parseDockerListJsonLines('[1]')).message).toBe(
      'parseDockerListJsonLines: line 1 was not a JSON object',
    );
    expect(parseErrorOf(() => parseDockerListJsonLines('{"ID":""}')).message).toBe(
      'parseDockerListJsonLines: line 1 did not contain an ID field',
    );
  });

  it('handles CRLF diff output and reports malformed diff lines', () => {
    expect(parseDockerDiff('A /a\r\nC /b c\r\n')).toEqual([
      { kind: 'A', path: '/a' },
      { kind: 'C', path: '/b c' },
    ]);
    expect(parseErrorOf(() => parseDockerDiff('A /a\nA')).message).toBe(
      'parseDockerDiff: line 2 was not a valid docker diff entry',
    );
  });

  it('rejects docker info payloads that are not objects', () => {
    expect(parseErrorOf(() => parseDockerInfo('[]')).message).toBe('parseDockerInfo: expected a JSON object');
    expect(parseDockerInfo('{}')).toEqual({ raw: {} });
  });

  it('parses docker create output into a container id', () => {
    expect(parseDockerCreate('abc123\n')).toBe('abc123');
    expect(parseErrorOf(() => parseDockerCreate(' \n')).message).toBe(
      'parseDockerCreate: did not return a container id',
    );
  });

  it('parses docker wait output into an exit code', () => {
    expect(parseDockerWait('17\n')).toBe(17);
    expect(parseDockerWait('-1')).toBe(-1);
    expect(() => parseDockerWait('')).toThrow(ContainerParseError);
    expect(() => parseDockerWait('1.5')).toThrow(ContainerParseError);
  });
});
