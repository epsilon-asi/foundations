import { createRef } from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { userEvent } from 'storybook/test';
import { renderWithUi } from '../../test/renderWithUi';
import { InspectorSection } from './InspectorSection';

it('supports Enter and Space with linked disclosure semantics and unmounts collapsed content', async () => {
  const changed = vi.fn();
  renderWithUi(<InspectorSection title="Transform" defaultExpanded={false} onExpandedChange={changed}><input aria-label="X" /></InspectorSection>);
  const toggle = screen.getByRole('button', { name: 'Transform' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  toggle.focus();
  await userEvent.keyboard('{Enter}');
  expect(changed).toHaveBeenCalledWith(true);
  expect(screen.getByRole('region', { name: 'Transform' }).id).toBe(toggle.getAttribute('aria-controls'));
  await userEvent.keyboard(' ');
  expect(changed).toHaveBeenLastCalledWith(false);
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});

it('keeps controlled state unchanged until the parent updates it', () => {
  const changed = vi.fn();
  const { rerender } = renderWithUi(<InspectorSection title="Transform" expanded onExpandedChange={changed}>Position</InspectorSection>);
  fireEvent.click(screen.getByRole('button', { name: 'Transform' }));
  expect(changed).toHaveBeenCalledWith(false);
  expect(screen.getByText('Position')).toBeVisible();
  rerender(<InspectorSection title="Transform" expanded={false} onExpandedChange={changed}>Position</InspectorSection>);
  expect(screen.queryByText('Position')).not.toBeInTheDocument();
});

it('can retain hidden state without leaving collapsed controls in the tab order', async () => {
  renderWithUi(<InspectorSection title="Transform" keepMounted><input aria-label="X" defaultValue="12" /></InspectorSection>);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '24' } });
  await userEvent.click(screen.getByRole('button', { name: 'Transform' }));
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.getByDisplayValue('24')).not.toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Transform' }));
  expect(screen.getByRole('textbox')).toHaveValue('24');
});

it('does not toggle when a separate header action is clicked', () => {
  const changed = vi.fn(); const action = vi.fn();
  renderWithUi(<InspectorSection title="Transform" onExpandedChange={changed} headerAction={<button onClick={action}>Reset</button>}>Position</InspectorSection>);
  fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
  expect(action).toHaveBeenCalledTimes(1); expect(changed).not.toHaveBeenCalled();
});

it('supports a static section and forwards refs and native props', () => {
  const ref = createRef<HTMLDivElement>();
  renderWithUi(<InspectorSection ref={ref} data-testid="section" title="Facts" collapsible={false} expanded={false}>Dimensions</InspectorSection>);
  expect(ref.current).toBe(screen.getByTestId('section'));
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Facts');
  expect(screen.getByText('Dimensions')).toBeVisible();
});
