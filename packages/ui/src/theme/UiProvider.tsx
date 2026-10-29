import * as React from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import type { Theme, ThemeOptions } from '@mui/material/styles';
import { createUiTheme, defaultUiTheme } from './createUiTheme';

export interface UiProviderProps {
  children: React.ReactNode;
  theme?: Theme;
  themeOptions?: ThemeOptions;
  disableCssBaseline?: boolean;
}

export function UiProvider({
  children,
  theme,
  themeOptions,
  disableCssBaseline = false
}: UiProviderProps) {
  const resolvedTheme = theme ?? (themeOptions ? createUiTheme(themeOptions) : defaultUiTheme);

  return (
    <ThemeProvider theme={resolvedTheme}>
      {!disableCssBaseline ? <CssBaseline /> : null}
      {children}
    </ThemeProvider>
  );
}
