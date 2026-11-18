import type { Decorator } from '@storybook/react-vite';
import { createTheme } from '@mui/material/styles';
import { UiProvider, uiThemeOptions } from '../src/theme';

const darkTheme = createTheme({
  ...uiThemeOptions,
  cssVariables: false,
  colorSchemes: undefined,
  palette: {
    mode: 'dark',
    primary: { ...uiThemeOptions.palette?.primary, main: '#6E8BFF', contrastText: '#0F172A' },
    secondary: { ...uiThemeOptions.palette?.secondary, main: '#A071FF', contrastText: '#0F172A' }
  }
});

export const withDarkUi: Decorator = (Story) => (
  <UiProvider theme={darkTheme}>
    <Story />
  </UiProvider>
);
