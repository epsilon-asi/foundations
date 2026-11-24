import { Box, TableBody, TableCell, TableHead, TableRow, TableSortLabel } from '@mui/material';
import { CompactTable } from '../../internal/CompactTable';
import { Checkbox } from '../Checkbox';
import { Text } from '../Text';
import { Skeleton } from '../Skeleton';
import { EmptyState } from '../EmptyState';
import type { SurfaceProps } from '../../internal/presentation';
export interface DataColumn<Row> {
  id: string;
  header: React.ReactNode;
  render: (row: Row) => React.ReactNode;
  width?: number | string;
  align?: 'start' | 'end' | 'center';
  sortable?: boolean;
  truncate?: boolean;
}
export interface DataTableSort {
  columnId: string;
  direction: 'asc' | 'desc';
}
export interface DataTableProps<Row> extends SurfaceProps {
  'aria-label': string;
  columns: readonly DataColumn<Row>[];
  rows: readonly Row[];
  getRowKey: (row: Row) => string;
  sort?: DataTableSort;
  onSortChange?: (sort: DataTableSort) => void;
  onRowActivate?: (row: Row) => void;
  rowActions?: (row: Row) => React.ReactNode;
  selectedKeys?: readonly string[];
  onSelectionChange?: (keys: string[]) => void;
  stickyHeader?: boolean;
  loading?: boolean;
  emptyState?: React.ReactNode;
}
export function DataTable<Row>({
  columns,
  rows,
  getRowKey,
  sort,
  onSortChange,
  onRowActivate,
  rowActions,
  selectedKeys = [],
  onSelectionChange,
  stickyHeader,
  loading,
  emptyState,
  density,
  sx,
  'aria-label': label,
  ...props
}: DataTableProps<Row>) {
  const selectable = !!onSelectionChange || selectedKeys.length > 0;
  const toggle = (key: string) =>
    onSelectionChange?.(
      selectedKeys.includes(key) ? selectedKeys.filter((k) => k !== key) : [...selectedKeys, key]
    );
  const count = columns.length + Number(selectable) + Number(!!rowActions);
  return (
    <Box {...props} sx={sx}>
      <CompactTable
        aria-label={label}
        aria-busy={loading || undefined}
        stickyHeader={stickyHeader}
        maxHeight={stickyHeader ? 360 : undefined}
        density={density}
        sx={{
          '& .MuiTableCell-root': { py: 0, height: density === 'comfortable' ? 40 : 32 },
          '& .MuiTableRow-root:focus-visible': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: -2
          },
          '& .MuiCheckbox-root': { p: 0.5 }
        }}
      >
        <TableHead>
          <TableRow>
            {selectable && <TableCell scope="col">Select</TableCell>}
            {columns.map((c) => (
              <TableCell
                key={c.id}
                scope="col"
                sortDirection={sort?.columnId === c.id ? sort.direction : false}
                sx={{ width: c.width, textAlign: c.align ?? 'start' }}
              >
                {c.sortable ? (
                  <TableSortLabel
                    component="button"
                    type="button"
                    active={sort?.columnId === c.id}
                    direction={sort?.columnId === c.id ? sort.direction : 'asc'}
                    onClick={() =>
                      onSortChange?.({
                        columnId: c.id,
                        direction: sort?.columnId === c.id && sort.direction === 'asc' ? 'desc' : 'asc'
                      })
                    }
                  >
                    {c.header}
                  </TableSortLabel>
                ) : (
                  c.header
                )}
              </TableCell>
            ))}
            {rowActions && <TableCell>Actions</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {loading ? (
            Array.from({ length: 3 }, (_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={count}>
                  <Skeleton />
                </TableCell>
              </TableRow>
            ))
          ) : rows.length ? (
            rows.map((row) => {
              const key = getRowKey(row);
              return (
                <TableRow
                  key={key}
                  selected={selectedKeys.includes(key)}
                  hover={!!onRowActivate}
                  tabIndex={onRowActivate ? 0 : undefined}
                  aria-selected={selectable ? selectedKeys.includes(key) : undefined}
                  onClick={(e) => {
                    if (!(e.target as Element).closest('button,a,input,select,textarea,label,[data-row-actions]'))
                      onRowActivate?.(row);
                  }}
                  onKeyDown={(e) => {
                    if (e.target === e.currentTarget && onRowActivate && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      onRowActivate(row);
                    }
                  }}
                >
                  {selectable && (
                    <TableCell>
                      <Checkbox
                        checked={selectedKeys.includes(key)}
                        readOnly={!onSelectionChange}
                        slotProps={{ input: { 'aria-label': 'Select ' + key } }}
                        onChange={() => toggle(key)}
                      />
                    </TableCell>
                  )}
                  {columns.map((c) => (
                    <TableCell
                      key={c.id}
                      sx={{ textAlign: c.align ?? 'start', maxWidth: c.truncate ? (c.width ?? 240) : undefined }}
                    >
                      {c.truncate ? <Text truncate>{c.render(row)}</Text> : c.render(row)}
                    </TableCell>
                  ))}
                  {rowActions && <TableCell data-row-actions="">{rowActions(row)}</TableCell>}
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={count}>{emptyState ?? <EmptyState title="No rows" />}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </CompactTable>
    </Box>
  );
}
