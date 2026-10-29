import { truncate } from './text';

export function slugify(value: string, fallback = 'item'): string {
  const slug = value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return truncate(slug || fallback, 80, '');
}

export function actionId(label: string, prefix = 'action'): string {
  return `${slugify(prefix)}_${slugify(label, 'button')}`;
}

export function blockId(label: string, prefix = 'block'): string {
  return `${slugify(prefix)}_${slugify(label, 'content')}`;
}
