import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { ActionButton } from '../ActionButton';
import { ContactCard } from './ContactCard';

const photo = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#dbeafe"/><circle cx="50" cy="38" r="18" fill="#325dff"/><ellipse cx="50" cy="92" rx="34" ry="30" fill="#325dff"/></svg>')}`;

const meta = {
  play: checkStoryLayout,
  title: 'Components/ContactCard',
  component: ContactCard,
  parameters: { layout: 'fullscreen' },
  args: {
    name: 'Alex Rivera', jobTitle: 'Research lead', skills: ['Analysis', 'Design', 'Strategy'],
    actions: <ActionButton variant="outlined">View profile</ActionButton>,
    sx: { width: 'min(380px, calc(100vw - 32px))' }
  }
} satisfies Meta<typeof ContactCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithPhoto: Story = { args: { photo } };
export const Minimal: Story = { args: { jobTitle: undefined, skills: undefined, actions: undefined } };
export const StartAligned: Story = { args: { align: 'start' } };
export const Narrow: Story = { args: { sx: { width: 280 }, skills: ['Research', 'Cross-functional collaboration', 'Design'] } };
export const Dark: Story = { decorators: [withDarkUi] };

export const EndAligned: Story = { args: { align: 'end' } };
export const WithCover: Story = { args: { photo, graphic: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="100"><rect width="600" height="100" fill="#325dff"/><circle cx="500" cy="50" r="100" fill="#7c4dff"/></svg>')}` } };
export const LongContent: Story = {
  args: { name: 'Alexandria Rivera-Martinez', jobTitle: 'Research and cross-functional collaboration lead',
    skills: ['Cross-functional collaboration and research coordination', 'workspace_abcdefghijklmnopqrstuvwxyz_0123456789'],
    sx: { width: 280, maxWidth: '100%' }, actions: [<ActionButton key="view">View profile</ActionButton>, <ActionButton key="connect">Connect with Alex</ActionButton>] }
};
export const NoSkills: Story = { args: { skills: [] } };
