// esbuild permits this optional import. The metafile check must still reject it.
export const fs = import('node:fs').catch(() => undefined);
