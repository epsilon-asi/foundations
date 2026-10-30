import * as React from 'react';
import { Box, CircularProgress } from '@mui/material';

export const DEFAULT_SETTINGS_STORAGE_KEY = 'app.settings';

export type SettingsProviderState<T> = T & {
  _isInitialized: boolean;
};

export type SettingsProviderContextType<T> = SettingsProviderState<T> & {
  reset: () => void;
  update: (settings: Partial<T>) => void;
};

export interface SettingsProviderProps<T> {
  defaults: T;
  storageKey?: string;
  loadingFallback?: React.ReactNode;
  children?: React.ReactNode;
}

export interface SettingsContextBundle<T> {
  SettingsContext: React.Context<SettingsProviderContextType<T>>;
  SettingsProvider: React.FC<SettingsProviderProps<T>>;
  SettingsConsumer: React.Consumer<SettingsProviderContextType<T>>;
  useSettings: () => SettingsProviderContextType<T>;
}

function readStoredSettings<T>(storageKey: string): Partial<T> | null {
  try {
    const restored = window.localStorage.getItem(storageKey);
    return restored ? (JSON.parse(restored) as Partial<T>) : null;
  } catch (error) {
    console.error('Failed to restore settings:', error);
    return null;
  }
}

function writeStoredSettings<T>(storageKey: string, settings: T) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to persist settings:', error);
  }
}

function stripInternal<T>(state: SettingsProviderState<T>): T {
  const { _isInitialized: _ignored, ...settings } = state;
  return settings as T;
}

const defaultLoadingFallback = (
  <Box
    sx={{
      alignItems: 'center',
      display: 'flex',
      height: '100%',
      justifyContent: 'center',
      width: '100%'
    }}
  >
    <CircularProgress size={60} />
  </Box>
);

function createSettingsProvider<T>(
  Context: React.Context<SettingsProviderContextType<T>>
): React.FC<SettingsProviderProps<T>> {
  function SettingsProvider({
    children,
    defaults,
    loadingFallback = defaultLoadingFallback,
    storageKey = DEFAULT_SETTINGS_STORAGE_KEY
  }: SettingsProviderProps<T>) {
    const [state, setState] = React.useState<SettingsProviderState<T>>(() => ({
      ...defaults,
      _isInitialized: false
    }));

    React.useEffect(() => {
      const restored = readStoredSettings<T>(storageKey);

      if (restored) {
        setState((prevState) => ({ ...prevState, ...restored, _isInitialized: true }));
      } else {
        writeStoredSettings(storageKey, defaults);
        setState((prevState) => ({ ...prevState, _isInitialized: true }));
      }
      // Only restore once on mount; later changes to defaults are applied through reset().
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [storageKey]);

    const reset = React.useCallback(() => {
      window.localStorage.removeItem(storageKey);
      setState((prevState) => ({ ...prevState, ...defaults }));
    }, [defaults, storageKey]);

    const update = React.useCallback(
      (settings: Partial<T>) => {
        setState((prevState) => {
          const nextState = { ...prevState, ...settings };
          writeStoredSettings(storageKey, stripInternal(nextState));
          return nextState;
        });
      },
      [storageKey]
    );

    const value = React.useMemo(() => ({ ...state, reset, update }), [state, reset, update]);

    return (
      <Context.Provider value={value}>
        {state._isInitialized ? children : loadingFallback}
      </Context.Provider>
    );
  }

  SettingsProvider.displayName = 'SettingsProvider';

  return SettingsProvider;
}

export function createSettingsContext<T>(): SettingsContextBundle<T> {
  const SettingsContext = React.createContext<SettingsProviderContextType<T>>(null!);
  SettingsContext.displayName = 'SettingsContext';

  const SettingsProvider = createSettingsProvider<T>(SettingsContext);
  const SettingsConsumer = SettingsContext.Consumer;
  const useSettings = () => React.useContext(SettingsContext);

  return {
    SettingsContext,
    SettingsProvider,
    SettingsConsumer,
    useSettings
  };
}
