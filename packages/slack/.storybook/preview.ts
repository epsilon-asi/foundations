import type { Preview } from '@storybook/react-vite';

// The Slack Block Kit addon registers its own decorator and toolbar globals
// (theme + surface), so this only sets Storybook-wide defaults.
const preview: Preview = {
  parameters: {
    layout: 'centered'
  }
};

export default preview;
