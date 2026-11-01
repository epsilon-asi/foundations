import { isRecord, omitUndefined } from '../shared/objects.js';
import { ContainerParseError } from './errors.js';
import { coerceStringRecord } from './internal.js';
import type {
  ContainerFilesystemChange,
  ContainerInspection,
  ContainerMountInfo,
  ContainerStateInfo,
  DockerContainerListSummary,
  DockerDaemonInfo,
} from './types.js';

type FieldReader<T> = (value: unknown) => T | undefined;

/** Maps each output property to the JSON key it is read from and a reader that validates the value. */
type FieldTable<T> = { readonly [K in keyof T]-?: readonly [jsonKey: string, read: FieldReader<T[K]>] };

const readString: FieldReader<string> = (value) => (typeof value === 'string' ? value : undefined);
const readBoolean: FieldReader<boolean> = (value) => (typeof value === 'boolean' ? value : undefined);
const readNumber: FieldReader<number> = (value) => (typeof value === 'number' ? value : undefined);
/** Docker reports `State.Health` only when a healthcheck exists; a status-less object maps to `null`. */
const readHealthStatus: FieldReader<string | null> = (value) =>
  value === undefined ? undefined : ((isRecord(value) ? readString(value.Status) : undefined) ?? null);

/** Reads every field in `table` from `record`, omitting fields that are absent or of the wrong type. */
function readFields<T extends object>(record: Record<string, unknown>, table: FieldTable<T>): T {
  const entries = Object.entries<readonly [string, FieldReader<unknown>]>(table);
  return omitUndefined(Object.fromEntries(entries.map(([key, [jsonKey, read]]) => [key, read(record[jsonKey])]))) as T;
}

const MOUNT_FIELDS: FieldTable<ContainerMountInfo> = {
  source: ['Source', readString],
  destination: ['Destination', readString],
  mode: ['Mode', readString],
  rw: ['RW', readBoolean],
  type: ['Type', readString],
};

const STATE_FIELDS: FieldTable<ContainerStateInfo> = {
  status: ['Status', readString],
  running: ['Running', readBoolean],
  paused: ['Paused', readBoolean],
  restarting: ['Restarting', readBoolean],
  oomKilled: ['OOMKilled', readBoolean],
  dead: ['Dead', readBoolean],
  exitCode: ['ExitCode', readNumber],
  health: ['Health', readHealthStatus],
};

const LIST_SUMMARY_FIELDS: FieldTable<Omit<DockerContainerListSummary, 'id' | 'raw'>> = {
  image: ['Image', readString],
  command: ['Command', readString],
  createdAt: ['CreatedAt', readString],
  names: ['Names', readString],
  labels: ['Labels', readString],
  mounts: ['Mounts', readString],
  state: ['State', readString],
  status: ['Status', readString],
};

const DAEMON_INFO_FIELDS: FieldTable<Omit<DockerDaemonInfo, 'raw'>> = {
  id: ['ID', readString],
  name: ['Name', readString],
  serverVersion: ['ServerVersion', readString],
  operatingSystem: ['OperatingSystem', readString],
  architecture: ['Architecture', readString],
  kernelVersion: ['KernelVersion', readString],
  driver: ['Driver', readString],
  cgroupVersion: ['CgroupVersion', readString],
};

interface PayloadLine {
  /** 1-based position in the payload, counting blank lines. */
  number: number;
  raw: string;
  text: string;
}

/** Splits a payload into trimmed, non-blank lines. */
function nonBlankLines(payload: string): PayloadLine[] {
  return payload
    .split(/\r?\n/)
    .map((raw, index) => ({ number: index + 1, raw, text: raw.trim() }))
    .filter((line) => line.text !== '');
}

function lineError(parser: string, line: PayloadLine, problem: string, options?: ErrorOptions): ContainerParseError {
  return new ContainerParseError(parser, `line ${line.number} ${problem}`, line.raw, options);
}

function parseJson(parser: string, payload: string): unknown {
  if (payload.trim() === '') {
    throw new ContainerParseError(parser, 'received an empty payload', payload);
  }
  try {
    return JSON.parse(payload) as unknown;
  } catch (cause: unknown) {
    throw new ContainerParseError(parser, 'received malformed JSON', payload, { cause });
  }
}

function parseMount(value: unknown): ContainerMountInfo {
  return isRecord(value) ? readFields(value, MOUNT_FIELDS) : {};
}

function parseState(value: unknown): ContainerStateInfo | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const state = readFields(value, STATE_FIELDS);
  return Object.keys(state).length > 0 ? state : undefined;
}

/** Parses `docker container inspect <id>` output (first element of the JSON array). */
export function parseDockerInspect(payload: string): ContainerInspection {
  const parser = 'parseDockerInspect';
  const parsed = parseJson(parser, payload);
  if (!Array.isArray(parsed)) {
    throw new ContainerParseError(parser, 'expected a JSON array', payload);
  }

  const [first] = parsed as unknown[];
  if (!isRecord(first)) {
    throw new ContainerParseError(parser, 'expected at least one container inspection object', payload);
  }

  const id = readString(first.Id);
  if (id === undefined || id.length === 0) {
    throw new ContainerParseError(parser, 'inspection payload did not contain an Id field', payload);
  }

  const config: Record<string, unknown> = isRecord(first.Config) ? first.Config : {};
  return {
    id,
    mounts: Array.isArray(first.Mounts) ? (first.Mounts as unknown[]).map(parseMount) : [],
    labels: coerceStringRecord(config.Labels),
    raw: first,
    ...omitUndefined({
      name: readString(first.Name)?.replace(/^\//, ''),
      image: readString(config.Image),
      state: parseState(first.State),
    }),
  };
}

/** Parses `docker container ls --format '{{json .}}'` output (one JSON object per line). */
export function parseDockerListJsonLines(payload: string): DockerContainerListSummary[] {
  const parser = 'parseDockerListJsonLines';
  return nonBlankLines(payload).map((line) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line.text) as unknown;
    } catch (cause: unknown) {
      throw lineError(parser, line, 'was not valid JSON', { cause });
    }
    if (!isRecord(parsed)) {
      throw lineError(parser, line, 'was not a JSON object');
    }

    const id = readString(parsed.ID);
    if (id === undefined || id.length === 0) {
      throw lineError(parser, line, 'did not contain an ID field');
    }
    return { id, ...readFields(parsed, LIST_SUMMARY_FIELDS), raw: parsed };
  });
}

/** Parses `docker container diff` output (`A|C|D <path>` per line). */
export function parseDockerDiff(payload: string): ContainerFilesystemChange[] {
  return nonBlankLines(payload).map((line) => {
    const [, kind, changedPath] = /^([ACD])\s+(.+)$/.exec(line.text) ?? [];
    if (kind === undefined || changedPath === undefined) {
      throw lineError('parseDockerDiff', line, 'was not a valid docker diff entry');
    }
    return { kind: kind as ContainerFilesystemChange['kind'], path: changedPath };
  });
}

/** Parses `docker info --format '{{json .}}'` output. */
export function parseDockerInfo(payload: string): DockerDaemonInfo {
  const parser = 'parseDockerInfo';
  const parsed = parseJson(parser, payload);
  if (!isRecord(parsed)) {
    throw new ContainerParseError(parser, 'expected a JSON object', payload);
  }
  return { ...readFields(parsed, DAEMON_INFO_FIELDS), raw: parsed };
}

/** Parses `docker container create` output into the new container id. */
export function parseDockerCreate(payload: string): string {
  const id = payload.trim();
  if (id === '') {
    throw new ContainerParseError('parseDockerCreate', 'did not return a container id', payload);
  }
  return id;
}

/** Parses `docker container wait` output into the container's exit code. */
export function parseDockerWait(payload: string): number {
  const text = payload.trim();
  if (!/^-?\d+$/.test(text)) {
    throw new ContainerParseError('parseDockerWait', `expected a numeric exit code but received: ${text}`, payload);
  }
  return Number(text);
}
