import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '@mui/material';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { Keycap } from './Keycap';

const meta = { title: 'Components/Keycap', component: Keycap, play: checkStoryLayout, args: { children: 'Esc' } } satisfies Meta<typeof Keycap>;
export default meta; type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Symbols: Story = { render: () => <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>{['⌘', '⇧', '⌥', '↑', 'Enter', 'Space'].map(key => <Keycap key={key}>{key}</Keycap>)}</Box> };
export const LongContent: Story = { args: { children: 'Localized_keyboard_key_abcdefghijklmnopqrstuvwxyz_0123456789' } };
export const Dark: Story = { decorators: [withDarkUi] };
