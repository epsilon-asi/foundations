import { alpha, createTheme, type ThemeOptions } from '@mui/material/styles';

export const uiThemeOptions: ThemeOptions = {
  cssVariables: {
    cssVarPrefix: 'ui'
  },
  colorSchemes: {
    dark: true
  },
  shape: {
    borderRadius: 14
  },
  palette: {
    primary: {
      main: '#325DFF',
      light: '#6E8BFF',
      dark: '#203EC2',
      contrastText: '#FFFFFF'
    },
    secondary: {
      main: '#7C4DFF',
      light: '#A071FF',
      dark: '#5B36C7',
      contrastText: '#FFFFFF'
    },
    success: {
      main: '#0F9D58'
    },
    warning: {
      main: '#ED6C02'
    },
    error: {
      main: '#D32F2F'
    },
    background: {
      default: '#F7F8FC',
      paper: '#FFFFFF'
    },
    text: {
      primary: '#0F172A',
      secondary: '#475569'
    },
    divider: alpha('#0F172A', 0.08)
  },
  typography: {
    fontFamily: [
      'Inter',
      'ui-sans-serif',
      'system-ui',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'sans-serif'
    ].join(', '),
    h1: {
      fontWeight: 800,
      letterSpacing: '-0.04em'
    },
    h2: {
      fontWeight: 800,
      letterSpacing: '-0.03em'
    },
    h3: {
      fontWeight: 700,
      letterSpacing: '-0.02em'
    },
    h4: {
      fontWeight: 700,
      letterSpacing: '-0.02em'
    },
    h5: {
      fontWeight: 700
    },
    h6: {
      fontWeight: 700
    },
    button: {
      fontWeight: 700,
      textTransform: 'none'
    }
  },
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
        // variant: 'contained'
      },
      styleOverrides: {
        root: {
          // borderRadius: 999,
          paddingInline: 18
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        rounded: {
          borderRadius: 18
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 18,
          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
          border: '1px solid rgba(15, 23, 42, 0.08)'
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 700
        }
      }
    }
  }
};

export function createUiTheme(options: ThemeOptions = {}) {
  return createTheme(uiThemeOptions, options);
}

export const defaultUiTheme = createUiTheme();
