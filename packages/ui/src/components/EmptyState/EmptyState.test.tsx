import { screen } from '@testing-library/react';
import { renderWithUi } from '../../test/renderWithUi';
import { ActionButton } from '../ActionButton';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders the title, description and action', () => {
    renderWithUi(
      <EmptyState
        title="Nothing here"
        description="Create your first item to get started."
        action={<ActionButton>Create item</ActionButton>}
      />
    );

    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.getByText('Create your first item to get started.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create item' })).toBeInTheDocument();
  });
});
