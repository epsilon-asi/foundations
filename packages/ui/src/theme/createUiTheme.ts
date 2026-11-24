import { identityTheme } from './category';
import { alpha, createTheme, type ThemeOptions } from '@mui/material/styles';

export const uiThemeOptions: ThemeOptions = {
  identity: identityTheme,
  spacing: 4,
  cssVariables: {
    cssVarPrefix: 'ui'
  },
  colorSchemes: {
    dark: true
  },
  shape: {},
  palette: {
    contrastThreshold: 4.5,
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
      fontSize: '2rem',
      fontWeight: 800,
      letterSpacing: '-0.04em'
    },
    h2: {
      fontSize: '1.75rem',
      fontWeight: 800,
      letterSpacing: '-0.03em'
    },
    h3: {
      fontSize: '1.5rem',
      fontWeight: 700,
      letterSpacing: '-0.02em'
    },
    h4: {
      fontSize: '1.25rem',
      fontWeight: 700,
      letterSpacing: '-0.02em'
    },
    h5: {
      fontSize: '1.125rem',
      fontWeight: 700
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 700
    },
    body1: { fontSize: '0.875rem', lineHeight: 1.5 },
    body2: { fontSize: '0.8125rem', lineHeight: 1.5 },
    subtitle1: { fontSize: '0.875rem', lineHeight: 1.5 },
    subtitle2: { fontSize: '0.8125rem', lineHeight: 1.5 },
    button: {
      fontWeight: 700,
      textTransform: 'none'
    }
  },
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
        size: "small"
        // variant: 'contained'
      },
      styleOverrides: {
        root: {
          borderRadius: 8,
          minHeight: 28,
          paddingInline: 10
        }
      }
    },
    MuiIconButton: { defaultProps: { size: 'small' } },
    MuiTextField: { defaultProps: { size: 'small', margin: 'none' }, styleOverrides: { root: { '& .MuiInputBase-root': { borderRadius: 8 } } } },
    MuiFormControl: { defaultProps: { size: 'small', margin: 'none' } },
    MuiCheckbox: { defaultProps: { size: 'small' } },
    MuiRadio: { defaultProps: { size: 'small' } },
    MuiSwitch: { defaultProps: { size: 'small' } },
    MuiList: { defaultProps: { dense: true } },
    MuiListItemText: { styleOverrides: { root: { minWidth: 0, overflowWrap: 'anywhere' } } },
    MuiButtonGroup: { defaultProps: { size: 'small' }, styleOverrides: { root: { maxWidth: '100%' }, grouped: { minWidth: 0 } } },
    MuiToggleButtonGroup: { defaultProps: { size: 'small' }, styleOverrides: { root: { maxWidth: '100%' } } },
    MuiToggleButton: { styleOverrides: { root: { minWidth: 0, minHeight: 28, padding: '4px 8px', whiteSpace: 'normal', overflowWrap: 'anywhere' } } },
    MuiTab: { styleOverrides: { root: { padding: '6px 10px', minHeight: 32 } } },
    MuiMenuList: { defaultProps: { dense: true } },
    MuiMenuItem: { defaultProps: { dense: true }, styleOverrides: { root: { minHeight: 28 } } },
    MuiCardContent: { styleOverrides: { root: { padding: 12, '&:last-child': { paddingBottom: 12 } } } },
    MuiCardHeader: { styleOverrides: { root: { padding: 12 }, action: { margin: 0 } } },
    MuiCardActions: { styleOverrides: { root: { padding: '8px 12px' } } },
    MuiDialogTitle: { styleOverrides: { root: { padding: '12px 16px' } } },
    MuiDialogContent: { styleOverrides: { root: { padding: '8px 16px 12px' } } },
    MuiDialogActions: { styleOverrides: { root: { padding: '8px 16px 12px', gap: 4 } } },
    MuiPaper: {
      styleOverrides: {
        rounded: {
          borderRadius: 12
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: ({ ownerState }) => ({
          borderRadius: 12,
          ...(ownerState.variant === 'outlined' ? { boxShadow: 'none' }
            : !ownerState.raised && (ownerState.elevation === undefined || ownerState.elevation === 1)
              ? { boxShadow: '0 2px 8px rgba(15, 23, 42, 0.06)' } : {}),
          border: '1px solid rgba(15, 23, 42, 0.08)'
        })
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
