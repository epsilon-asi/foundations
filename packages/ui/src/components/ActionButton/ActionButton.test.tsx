import { screen } from '@testing-library/react';
import { renderWithUi } from '../../test/renderWithUi';
import { ActionButton } from './ActionButton';

describe('ActionButton', () => {
  it('renders button content', () => {
    renderWithUi(<ActionButton>Save</ActionButton>);

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('shows a loading state', () => {
    renderWithUi(
      <ActionButton loading loadingLabel="Saving...">
        Save
      </ActionButton>
    );

    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});
