import type { Meta, StoryObj } from '@storybook/react-vite';
import { DataTable } from './DataTable';

import { narrowConversation, longLabel, tableRows } from '../../../.storybook/conversationExamples';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';

const meta = {
  title: 'Components/DataTable',
  component: DataTable<(typeof tableRows)[number]>,
  args: {
    'aria-label': 'Documents',
    rows: tableRows,
    getRowKey: (row) => row.id,
    columns: [
      { id: 'name', header: 'Name', render: (row) => row.id, sortable: true },
      { id: 'count', header: 'Count', render: (row) => row.count, align: 'end' }
    ]
  },
  play: checkStoryLayout
} satisfies Meta<typeof DataTable<(typeof tableRows)[number]>>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Loading: Story = { args: { loading: true } };
export const Empty: Story = { args: { rows: [] } };
export const Selected: Story = { args: { selectedKeys: ['Draft'], onSelectionChange: () => {} } };
export const Sorted: Story = { args: { sort: { columnId: 'name', direction: 'desc' }, stickyHeader: true } };
export const LongContent: Story = { args: { rows: [{ id: longLabel, count: 3 }] } };
export const Narrow: Story = { decorators: [narrowConversation], args: { rows: [{ id: longLabel, count: 3 }] } };
export const Dark: Story = { decorators: [withDarkUi] };
