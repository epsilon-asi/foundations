export function exampleFiles() {
  const pixels = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='), (character) => character.charCodeAt(0));
  return [new File([pixels], 'character-preview.png', { type: 'image/png', lastModified: 1 }), new File(['Production notes for the selected character asset.'], 'production-notes.txt', { type: 'text/plain', lastModified: 1 })];
}
