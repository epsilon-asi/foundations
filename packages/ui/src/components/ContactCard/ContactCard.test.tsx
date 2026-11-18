import { defaultUiTheme } from '../../theme';
import { createRef } from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithUi } from '../../test/renderWithUi';
import { ActionButton } from '../ActionButton';
import { ContactCard } from './ContactCard';

describe('ContactCard', () => {
  it('renders contact details and skills with an accessible photo', () => {
    renderWithUi(<ContactCard name="Chris Taylor" photo="/avatar.png" jobTitle="Research lead" skills={['Analysis', 'Design']} />);
    expect(screen.getByRole('heading', { name: 'Chris Taylor', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Chris Taylor' })).toHaveAttribute('src', '/avatar.png');
    expect(screen.getByText('Research lead')).toBeInTheDocument();
    expect(screen.getByText('Analysis')).toBeInTheDocument();
    expect(screen.getByText('Design')).toBeInTheDocument();
  });

  it('falls back to initials when a photo is absent and updates them when the contact changes', () => {
    const { rerender } = renderWithUi(<ContactCard name="  Chris   Taylor " />);
    expect(screen.getByText('CT')).toBeInTheDocument();
    rerender(<ContactCard name="Alex Rivera" />);
    expect(screen.getByText('AR')).toBeInTheDocument();
  });

  it('renders supplied actions and updates optional content', () => {
    const onClick = vi.fn();
    const { rerender } = renderWithUi(
      <ContactCard name="Chris" actions={<ActionButton onClick={onClick}>Connect</ActionButton>} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(<ContactCard name="Alex" jobTitle="Designer" skills={[]} />);
    expect(screen.getByRole('heading', { name: 'Alex' })).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('forwards refs, native roles and theme-aware root styles', () => {
    const ref = createRef<HTMLDivElement>();
    renderWithUi(<ContactCard ref={ref} name="Chris" role="article" align="start"
      sx={[{ padding: '1px' }, (theme) => ({ padding: `${theme.shape.borderRadius}px` })]} />);
    expect(ref.current).toBe(screen.getByRole('article'));
    expect(ref.current).toHaveStyle({ padding: `${defaultUiTheme.shape.borderRadius}px` });
  });
});
