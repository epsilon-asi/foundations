import type { Preview } from '@storybook/react-vite';
import * as React from 'react';
import { Box } from '@mui/material';
import { UiProvider } from '../src/theme';

const preview: Preview = {
  parameters: {
    layout: 'centered',
    controls: {
      expanded: true
    }
  },
  decorators: [
    (Story) => (
      <UiProvider>
        <Box sx={{ minWidth: 320, p: 2 }}>
          <Story />
        </Box>
      </UiProvider>
    )
  ]
};

export default preview;
