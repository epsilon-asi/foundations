import { Table, TableContainer, type TableProps } from '@mui/material';
import { ScrollArea, type ScrollAreaProps } from '../components/ScrollArea';
import { styles, type Density } from './presentation';

interface CompactTableProps extends TableProps {
  'aria-label': string;
  regionLabel?: string;
  axis?: ScrollAreaProps['axis'];
  maxHeight?: ScrollAreaProps['maxHeight'];
  focusable?: boolean;
  density?: Density;
}

/** Keep table sizing and keyboard scrolling consistent across data and rich content. */
export function CompactTable({
  'aria-label': label,
  regionLabel = label,
  axis = 'both',
  maxHeight,
  focusable,
  density,
  sx,
  ...props
}: CompactTableProps) {
  return (
    <TableContainer
      component={ScrollArea}
      aria-label={regionLabel}
      axis={axis}
      maxHeight={maxHeight}
      tabIndex={focusable ? 0 : undefined}
    >
      <Table
        {...props}
        aria-label={label}
        size="small"
        sx={styles(
          {
            '& .MuiTableCell-root': { px: density === 'comfortable' ? 3 : 2, py: 1 }
          },
          sx
        )}
      />
    </TableContainer>
  );
}
