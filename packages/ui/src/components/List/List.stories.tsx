import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { IconButton } from '../IconButton';
import { List, ListItem, ListItemButton, ListItemText, ListSubheader } from './index';

const meta = {
  title: 'Components/List',
  component: List,
  play: checkStoryLayout,
  args: {
    'aria-label': 'Render queue',
    children: <>
      <ListItem divider><ListItemText primary="Walk cycle" secondary="Rendering frame 4 of 12" /></ListItem>
      <ListItem><ListItemText primary="Landing pose" secondary="Queued" /></ListItem>
    </>
  }
} satisfies Meta<typeof List>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Compact: Story = { args: { dense: true, disablePadding: true } };

export const Ordered: Story = {
  render: () => (
    <List component="ol" aria-label="Revision history" start={3}
      sx={{ pl: 4, listStyleType: 'decimal', '& > li': { display: 'list-item' } }}>
      <ListItem><ListItemText primary="Revised walk cycle" secondary="Updated the contact frames" /></ListItem>
      <ListItem><ListItemText primary="Updated landing frame" secondary="Adjusted the pivot" /></ListItem>
    </List>
  )
};

export const SelectionAndSecondaryActions: Story = {
  render: function AnimationList() {
    const [selected, setSelected] = useState('Idle');
    const [pinned, setPinned] = useState<string[]>([]);
    return (
      <List aria-labelledby="animation-list-heading" sx={{ maxWidth: 400 }}
        subheader={<ListSubheader role="presentation" id="animation-list-heading">Animations</ListSubheader>}>
        {['Idle', 'Walk', 'Jump'].map(name => {
          const isPinned = pinned.includes(name);
          return (
            <ListItem key={name} disablePadding secondaryAction={
              <IconButton aria-label={`Pin ${name}`} aria-pressed={isPinned} size="small" outlined={false}
                onClick={() => setPinned(items => items.includes(name) ? items.filter(item => item !== name) : [...items, name])}>
                <span aria-hidden="true">{isPinned ? '★' : '☆'}</span>
              </IconButton>
            }>
              <ListItemButton component="button" selected={selected === name} aria-current={selected === name || undefined}
                onClick={() => setSelected(name)}>
                <ListItemText primary={name} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    );
  },
  play: async ({ canvasElement }) => {
    const list = within(within(canvasElement).getByRole('list', { name: 'Animations' }));
    await userEvent.click(list.getByRole('button', { name: 'Walk' }));
    await userEvent.click(list.getByRole('button', { name: 'Pin Jump' }));
    await expect(list.getByRole('button', { name: 'Walk', current: true })).toBeVisible();
    await expect(list.getByRole('button', { name: 'Pin Jump', pressed: true })).toHaveFocus();
    await checkStoryLayout({ canvasElement });
  }
};
