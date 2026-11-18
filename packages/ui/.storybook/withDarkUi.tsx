import type { Decorator } from '@storybook/react-vite';
import { createTheme } from '@mui/material/styles';
import { UiProvider, uiThemeOptions } from '../src/theme';

const darkTheme = createTheme({
  ...uiThemeOptions,
  cssVariables: false,
  colorSchemes: undefined,
  palette: {
    mode: 'dark',
    primary: { ...uiThemeOptions.palette?.primary, main: '#9CAFFF', light: '#C4CFFF', dark: '#7E96F4', contrastText: '#0F172A' },
    secondary: { ...uiThemeOptions.palette?.secondary, main: '#C2A7FF', light: '#DDD0FF', dark: '#A48CE5', contrastText: '#0F172A' }
  }
});

export const withDarkUi: Decorator = (Story) => (
  <UiProvider theme={darkTheme}>
    <Story />
  </UiProvider>
);
