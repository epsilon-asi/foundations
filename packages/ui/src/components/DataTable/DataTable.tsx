import { Box } from '@mui/material';
import { ActionButton } from '../ActionButton';
import { ScrollArea } from '../ScrollArea';
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
      <ScrollArea aria-label={label} axis="both" maxHeight={stickyHeader ? 360 : undefined}>
        <Box
          component="table"
          aria-label={label}
          aria-busy={loading || undefined}
          sx={{
            width: '100%',
            borderCollapse: 'separate',
            borderSpacing: 0,
            typography: 'body2',
            '& :is(th,td)': {
              px: density === 'comfortable' ? 3 : 2,
              py: 0,
              borderBottom: 1,
              borderColor: 'divider',
              height: density === 'comfortable' ? 40 : 32
            },
            '& th': {
              textAlign: 'start',
              bgcolor: 'background.paper',
              ...(stickyHeader && { position: 'sticky', top: 0, zIndex: 1 })
            },
            '& tr:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 },
            '& .MuiCheckbox-root': { p: 0.5 },
            '& tbody tr[aria-selected=true]': { bgcolor: 'action.selected' }
          }}
        >
          <thead>
            <tr>
              {selectable && <th scope="col">Select</th>}
              {columns.map((c) => (
                <Box
                  component="th"
                  key={c.id}
                  scope="col"
                  aria-sort={
                    sort?.columnId === c.id ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined
                  }
                  sx={{ width: c.width, textAlign: c.align ?? 'start' }}
                >
                  {c.sortable ? (
                    <ActionButton
                      onClick={() =>
                        onSortChange?.({
                          columnId: c.id,
                          direction: sort?.columnId === c.id && sort.direction === 'asc' ? 'desc' : 'asc'
                        })
                      }
                    >
                      {c.header} {sort?.columnId === c.id ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </ActionButton>
                  ) : (
                    c.header
                  )}
                </Box>
              ))}
              {rowActions && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 3 }, (_, i) => (
                <tr key={i}>
                  <td colSpan={count}>
                    <Skeleton />
                  </td>
                </tr>
              ))
            ) : rows.length ? (
              rows.map((row) => {
                const key = getRowKey(row);
                return (
                  <tr
                    key={key}
                    tabIndex={onRowActivate ? 0 : undefined}
                    aria-selected={selectable ? selectedKeys.includes(key) : undefined}
                    onClick={(e) => {
                      if (
                        !(e.target as Element).closest('button,a,input,select,textarea,label,[data-row-actions]')
                      )
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
                      <td>
                        <Checkbox
                          checked={selectedKeys.includes(key)}
                          readOnly={!onSelectionChange}
                          slotProps={{ input: { 'aria-label': 'Select ' + key } }}
                          onChange={() => toggle(key)}
                        />
                      </td>
                    )}
                    {columns.map((c) => (
                      <Box
                        component="td"
                        key={c.id}
                        sx={{ textAlign: c.align ?? 'start', maxWidth: c.truncate ? (c.width ?? 240) : undefined }}
                      >
                        {c.truncate ? <Text truncate>{c.render(row)}</Text> : c.render(row)}
                      </Box>
                    ))}
                    {rowActions && <td data-row-actions="">{rowActions(row)}</td>}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={count}>{emptyState ?? <EmptyState title="No rows" />}</td>
              </tr>
            )}
          </tbody>
        </Box>
      </ScrollArea>
    </Box>
  );
}
