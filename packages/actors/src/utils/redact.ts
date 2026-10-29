const DEFAULT_REDACTION_KEYS = [
  'password',
  'passwd',
  'secret',
  'token',
  'apiKey',
  'api_key',
  'authorization',
  'auth',
  'cookie',
  'session',
  'credential',
  'refreshToken',
  'accessToken'
];

export interface RedactOptions {
  replacement?: string;
  sensitiveKeys?: string[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function keyIsSensitive(key: string, sensitiveKeys: string[]): boolean {
  const normalized = key.toLowerCase();
  return sensitiveKeys.some(sensitiveKey => normalized.includes(sensitiveKey.toLowerCase()));
}

export function redact<T>(value: T, options: RedactOptions = {}): T {
  const replacement = options.replacement ?? '[REDACTED]';
  const sensitiveKeys = options.sensitiveKeys ?? DEFAULT_REDACTION_KEYS;

  const visit = (input: unknown): unknown => {
    if (Array.isArray(input)) {
      return input.map(item => visit(item));
    }

    if (!isPlainObject(input)) {
      return input;
    }

    return Object.fromEntries(
      Object.entries(input).map(([key, nestedValue]) => [
        key,
        keyIsSensitive(key, sensitiveKeys) ? replacement : visit(nestedValue)
      ])
    );
  };

  return visit(value) as T;
}
