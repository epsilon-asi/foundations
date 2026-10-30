import { fireEvent, screen } from '@testing-library/react';
import { renderWithUi } from '../../test/renderWithUi';
import { createSettingsContext, DEFAULT_SETTINGS_STORAGE_KEY } from './SettingsProvider';

interface TestSettings {
  dark: boolean;
  color: string;
  object: {
    size: number;
  };
}

const defaults: TestSettings = {
  dark: false,
  color: 'red',
  object: {
    size: 10
  }
};

const { SettingsProvider, SettingsConsumer, useSettings } = createSettingsContext<TestSettings>();

function SettingsReadout() {
  const settings = useSettings();

  return (
    <>
      <div data-testid="color_mode">{settings.dark ? 'DARK' : 'LIGHT'}</div>
      <div data-testid="color">{settings.color}</div>
      <div data-testid="object_size">{settings.object.size}</div>
      <button
        type="button"
        onClick={() =>
          settings.update({
            dark: true,
            color: 'green',
            object: { size: 20 }
          })
        }
      >
        Change
      </button>
      <button type="button" onClick={() => settings.reset()}>
        Reset
      </button>
    </>
  );
}

describe('SettingsProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders defaults and applies updates through the hook', () => {
    renderWithUi(
      <SettingsProvider defaults={defaults}>
        <SettingsReadout />
      </SettingsProvider>
    );

    expect(screen.getByTestId('color_mode')).toHaveTextContent('LIGHT');
    expect(screen.getByTestId('color')).toHaveTextContent('red');
    expect(screen.getByTestId('object_size')).toHaveTextContent('10');

    fireEvent.click(screen.getByRole('button', { name: 'Change' }));

    expect(screen.getByTestId('color_mode')).toHaveTextContent('DARK');
    expect(screen.getByTestId('color')).toHaveTextContent('green');
    expect(screen.getByTestId('object_size')).toHaveTextContent('20');
  });

  it('exposes settings through the consumer render prop', () => {
    renderWithUi(
      <SettingsProvider defaults={defaults}>
        <SettingsConsumer>
          {(settings) => <div data-testid="color">{settings.color}</div>}
        </SettingsConsumer>
      </SettingsProvider>
    );

    expect(screen.getByTestId('color')).toHaveTextContent('red');
  });

  it('persists updates to localStorage and restores them on mount', () => {
    const { unmount } = renderWithUi(
      <SettingsProvider defaults={defaults}>
        <SettingsReadout />
      </SettingsProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Change' }));

    expect(JSON.parse(window.localStorage.getItem(DEFAULT_SETTINGS_STORAGE_KEY)!)).toEqual({
      dark: true,
      color: 'green',
      object: { size: 20 }
    });

    unmount();

    renderWithUi(
      <SettingsProvider defaults={defaults}>
        <SettingsReadout />
      </SettingsProvider>
    );

    expect(screen.getByTestId('color')).toHaveTextContent('green');
    expect(screen.getByTestId('object_size')).toHaveTextContent('20');
  });

  it('resets to defaults and clears storage', () => {
    renderWithUi(
      <SettingsProvider defaults={defaults}>
        <SettingsReadout />
      </SettingsProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

    expect(screen.getByTestId('color')).toHaveTextContent('red');
    expect(window.localStorage.getItem(DEFAULT_SETTINGS_STORAGE_KEY)).toBeNull();
  });

  it('uses a custom storage key when provided', () => {
    renderWithUi(
      <SettingsProvider defaults={defaults} storageKey="custom.settings">
        <SettingsReadout />
      </SettingsProvider>
    );

    expect(window.localStorage.getItem('custom.settings')).not.toBeNull();
    expect(window.localStorage.getItem(DEFAULT_SETTINGS_STORAGE_KEY)).toBeNull();
  });
});
