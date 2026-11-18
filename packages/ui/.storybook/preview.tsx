import type { Preview } from '@storybook/react-vite';
import * as React from 'react';
import { Box } from '@mui/material';
import { UiProvider } from '../src/theme';

const preview: Preview = {
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    controls: {
      expanded: true
    }
  },
  decorators: [
    (Story) => (
      <UiProvider>
        <Box sx={{ width: '100%', minWidth: 0, p: 2 }}>
          <Story />
        </Box>
      </UiProvider>
    )
  ]
};

export default preview;
