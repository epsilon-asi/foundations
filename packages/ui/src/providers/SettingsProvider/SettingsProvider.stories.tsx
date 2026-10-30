import type { Meta, StoryObj } from '@storybook/react-vite';
import { Stack, Switch, Typography } from '@mui/material';
import { ActionButton } from '../../components/ActionButton';
import { createSettingsContext } from './SettingsProvider';

interface DemoSettings {
  dark: boolean;
  color: string;
  object: {
    size: number;
  };
}

const { SettingsProvider, useSettings } = createSettingsContext<DemoSettings>();

function SettingsDemo() {
  const settings = useSettings();

  return (
    <Stack spacing={2}>
      <Stack alignItems="center" direction="row" spacing={1}>
        <Switch
          checked={settings.dark}
          onChange={(event) => settings.update({ dark: event.target.checked })}
        />
        <Typography>{settings.dark ? 'Dark mode' : 'Light mode'}</Typography>
      </Stack>

      <Typography>Color: {settings.color}</Typography>
      <Typography>Size: {settings.object.size}</Typography>

      <Stack direction="row" spacing={1}>
        <ActionButton
          onClick={() =>
            settings.update({ color: 'green', object: { size: settings.object.size + 1 } })
          }
        >
          Grow
        </ActionButton>
        <ActionButton variant="outlined" onClick={() => settings.reset()}>
          Reset
        </ActionButton>
      </Stack>
    </Stack>
  );
}

const meta = {
  title: 'Providers/SettingsProvider',
  component: SettingsProvider,
  args: {
    storageKey: 'storybook.settings',
    defaults: {
      dark: false,
      color: 'red',
      object: {
        size: 99
      }
    },
    children: <SettingsDemo />
  }
} satisfies Meta<typeof SettingsProvider>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
