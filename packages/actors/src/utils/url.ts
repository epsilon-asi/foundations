export function resolveUrl(baseUrl: string, urlOrPath: string): string {
  try {
    return new URL(urlOrPath).toString();
  } catch {
    return new URL(urlOrPath, baseUrl).toString();
  }
}
