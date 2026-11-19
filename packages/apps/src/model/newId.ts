/** Generate a UUIDv7 with a millisecond timestamp and 74 random bits. */
export function newId(): string {
  const timestamp = Date.now().toString(16).padStart(12, '0');
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(10));
  bytes[0] = (bytes[0] & 0x0f) | 0x70; // Version 7
  bytes[2] = (bytes[2] & 0x3f) | 0x80; // RFC 9562 variant
  const suffix = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');

  return `${timestamp.slice(0, 8)}-${timestamp.slice(8)}-${suffix.slice(0, 4)}-${suffix.slice(4, 8)}-${suffix.slice(8)}`;
}
