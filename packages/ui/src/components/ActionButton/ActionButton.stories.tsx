import type { Meta, StoryObj } from '@storybook/react-vite';
import SaveRounded from '@mui/icons-material/SaveRounded';
import { ActionButton } from './ActionButton';

const meta = {
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
