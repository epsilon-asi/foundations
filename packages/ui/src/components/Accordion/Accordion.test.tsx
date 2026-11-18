import { createRef } from 'react';
import { act, fireEvent, screen } from '@testing-library/react';
import { userEvent } from 'storybook/test';
import { renderWithUi } from '../../test/renderWithUi';
import { Accordion } from './Accordion';
import { ActionButton } from '../ActionButton';

it('starts collapsed with a heading and linked disclosure region, and supports Enter and Space', async () => {
  const changed = vi.fn();
  renderWithUi(<Accordion title="Details" onExpandedChange={changed}><p>Asset information</p></Accordion>);
  const header = screen.getByRole('button', { name: 'Details' });
  expect(screen.getByRole('heading', { level: 3 })).toContainElement(header);
  expect(header).toHaveAttribute('aria-expanded', 'false'); expect(screen.queryByText('Asset information')).not.toBeInTheDocument();
  act(() => header.focus()); await userEvent.keyboard('{Enter}');
  const region = screen.getByRole('region', { name: 'Details' }); expect(region.id).toBe(header.getAttribute('aria-controls'));
  expect(region).toHaveAttribute('aria-labelledby', header.id); expect(header).toHaveFocus(); expect(changed).toHaveBeenLastCalledWith(true);
  await userEvent.keyboard(' '); expect(header).toHaveAttribute('aria-expanded', 'false'); expect(changed).toHaveBeenLastCalledWith(false);
});
it('keeps controlled expansion until the parent updates it and uses fresh callbacks', async () => {
  const first = vi.fn(); const latest = vi.fn();
  const { rerender } = renderWithUi(<Accordion title="Details" expanded onExpandedChange={first}>Body</Accordion>);
  await userEvent.click(screen.getByRole('button')); expect(first).toHaveBeenCalledExactlyOnceWith(false); expect(screen.getByText('Body')).toBeVisible();
  rerender(<Accordion title="Details" expanded={false} onExpandedChange={latest}>Body</Accordion>);
  await userEvent.click(screen.getByRole('button')); expect(latest).toHaveBeenCalledExactlyOnceWith(true); expect(screen.queryByText('Body')).not.toBeInTheDocument();
});
it('disables only the disclosure and never toggles through pointer or keyboard events', async () => {
  const changed = vi.fn(); const action = vi.fn();
  renderWithUi(<Accordion title="Locked" disabled defaultExpanded onExpandedChange={changed}
    headerAction={<ActionButton onClick={action}>Help</ActionButton>}>Read-only information</Accordion>);
  const header = screen.getByRole('button', { name: 'Locked' }); expect(header).toBeDisabled(); fireEvent.click(header);
  fireEvent.keyDown(header, { key: 'Enter' }); expect(changed).not.toHaveBeenCalled();
  expect(screen.getByText('Read-only information')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Help' })); expect(action).toHaveBeenCalledTimes(1); expect(changed).not.toHaveBeenCalled();
});
it('preserves hidden child state with keepMounted and excludes it from keyboard navigation', async () => {
  renderWithUi(<><Accordion title="Settings" keepMounted defaultExpanded><input aria-label="Name" defaultValue="Original" /></Accordion><button>Outside</button></>);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Edited' } });
  await userEvent.click(screen.getByRole('button', { name: 'Settings' }));
  expect(screen.getByDisplayValue('Edited')).not.toBeVisible(); await userEvent.tab(); expect(screen.getByRole('button', { name: 'Outside' })).toHaveFocus();
  await userEvent.click(screen.getByRole('button', { name: 'Settings' })); expect(screen.getByRole('textbox')).toHaveValue('Edited');
});
it.each([false, true])('returns focus from body content when a parent collapses it (keepMounted=%s)', (keepMounted) => {
  const { rerender } = renderWithUi(<Accordion title="Settings" expanded keepMounted={keepMounted}><input aria-label="Name" /></Accordion>);
  act(() => screen.getByRole('textbox').focus());
  rerender(<Accordion title="Settings" expanded={false} keepMounted={keepMounted}><input aria-label="Name" /></Accordion>);
  expect(screen.getByRole('button', { name: 'Settings' })).toHaveFocus();
});
it.each([false, true])('recovers focus to the section when the collapsed header is disabled (keepMounted=%s)', (keepMounted) => {
  const ref = createRef<HTMLDivElement>();
  const { rerender } = renderWithUi(<Accordion title="Settings" ref={ref} disabled expanded keepMounted={keepMounted}><input aria-label="Name" /></Accordion>);
  act(() => screen.getByRole('textbox').focus());
  rerender(<Accordion title="Settings" ref={ref} disabled expanded={false} keepMounted={keepMounted}><input aria-label="Name" /></Accordion>);
  expect(ref.current).toHaveFocus(); expect(screen.getByRole('button', { name: 'Settings' })).toBeDisabled();
});
it('keeps header actions independent while its footer collapses with the body', async () => {
  const action = vi.fn(); const changed = vi.fn();
  renderWithUi(<Accordion title="Details" headerAction={<ActionButton onClick={action}>Reset</ActionButton>}
    footer={<ActionButton>Apply</ActionButton>} onExpandedChange={changed}>Body</Accordion>);
  expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Reset' })); expect(action).toHaveBeenCalledTimes(1); expect(changed).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Details' })); expect(screen.getByRole('button', { name: 'Apply' })).toBeVisible();
});
it('forwards native attributes, refs, heading level and composed surface/content styles with unique IDs', () => {
  const ref = createRef<HTMLDivElement>();
  renderWithUi(<><Accordion title="Details" ref={ref} data-testid="accordion" headingLevel="h2" defaultExpanded
    sx={[{ padding: '2px' }, { padding: '6px' }]} contentSx={{ padding: '7px' }}>Body</Accordion><Accordion title="Other" /></>);
  expect(ref.current).toBe(screen.getByTestId('accordion')); expect(ref.current).toHaveStyle({ padding: '6px' });
  expect(screen.getByRole('region', { name: 'Details' })).toHaveStyle({ padding: '7px' });
  expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Details');
  const ids = screen.getAllByRole('button').map((button) => button.getAttribute('aria-controls')); expect(new Set(ids).size).toBe(2);
});
