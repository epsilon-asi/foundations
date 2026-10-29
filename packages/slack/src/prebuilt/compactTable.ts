import { header, section } from '../blocks';
import { defineComponent, type RenderedComponent } from '../core/component';
import type { Primitive, SlackBlock } from '../types/slack';
import { compactJoin, formatPrimitive, truncate } from '../utils/text';

export interface TableColumn<Row extends Record<string, Primitive> = Record<string, Primitive>> {
  key: keyof Row & string;
  label?: string;
  width?: number;
  align?: 'left' | 'right';
}

export interface CompactTableOptions<Row extends Record<string, Primitive> = Record<string, Primitive>> {
  title: string;
  columns: Array<TableColumn<Row>>;
  rows: Row[];
  maxRows?: number;
  emptyText?: string;
}

function pad(value: string, width: number, align: 'left' | 'right' = 'left'): string {
  const shortened = truncate(value, width, '…');
  return align === 'right' ? shortened.padStart(width) : shortened.padEnd(width);
}

function renderRows<Row extends Record<string, Primitive>>(columns: Array<TableColumn<Row>>, rows: Row[]): string {
  const headerRow = columns.map((column) => pad(column.label ?? column.key, column.width ?? 14, column.align)).join(' ');
  const separator = columns.map((column) => ''.padEnd(column.width ?? 14, '─')).join(' ');
  const bodyRows = rows.map((row) =>
    columns.map((column) => pad(formatPrimitive(row[column.key]), column.width ?? 14, column.align)).join(' ')
  );
  return ['```', headerRow, separator, ...bodyRows, '```'].join('\n');
}

function renderCompactTable(options: CompactTableOptions): RenderedComponent {
  const rows = options.rows.slice(0, options.maxRows ?? 8);
  const blocks: SlackBlock[] = [header(`🧾 ${options.title}`)];

  if (rows.length === 0) {
    blocks.push(section(options.emptyText ?? 'No rows to show.'));
  } else {
    blocks.push(section(renderRows(options.columns, rows)));
  }

  const omitted = options.rows.length - rows.length;
  if (omitted > 0) {
    blocks.push(section(`_${omitted} more row${omitted === 1 ? '' : 's'} omitted._`));
  }

  return {
    blocks,
    fallbackText: compactJoin([options.title, `${rows.length} row${rows.length === 1 ? '' : 's'}`])
  };
}

export const compactTable = defineComponent<CompactTableOptions>('prebuilt.compactTable', renderCompactTable);
