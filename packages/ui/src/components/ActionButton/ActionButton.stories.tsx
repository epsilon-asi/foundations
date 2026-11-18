import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { Stack } from '@mui/material';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import type { Meta, StoryObj } from '@storybook/react-vite';
import SaveRounded from '@mui/icons-material/SaveRounded';
import { ActionButton } from './ActionButton';

const meta = {
  play: checkStoryLayout,
  title: 'Components/ActionButton',
  component: ActionButton,
  args: {
    children: 'Save changes'
  }
} satisfies Meta<typeof ActionButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Loading: Story = {
  args: {
    loading: true,
    loadingLabel: 'Saving...'
  }
};

export const WithIcon: Story = {
  args: {
    startIcon: <SaveRounded />,
    variant: 'outlined'
  }
};

export const MobileWidth: Story = {
  args: {
    fullWidthOnMobile: true
  }
};

export const Disabled: Story = { args: { disabled: true } };
export const Variants: Story = { render: (args) => <Stack direction="row" flexWrap="wrap" gap={2}>{(['text', 'outlined', 'contained'] as const).map((variant) => <ActionButton {...args} key={variant} variant={variant}>{variant}</ActionButton>)}</Stack> };
export const Sizes: Story = { render: (args) => <Stack direction="row" flexWrap="wrap" gap={2}>{(['small', 'medium', 'large'] as const).map((size) => <ActionButton {...args} key={size} size={size}>{size}</ActionButton>)}</Stack> };
export const EndIcon: Story = { args: { endIcon: <SaveRounded /> } };
export const LongLabel: Story = { args: { children: 'Save the latest workspace settings and share with your team', fullWidthOnMobile: true, sx: { maxWidth: 280 } } };
export const Dark: Story = { decorators: [withDarkUi] };
