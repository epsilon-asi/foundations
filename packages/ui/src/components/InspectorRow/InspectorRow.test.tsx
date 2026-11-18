import { createRef } from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithUi } from '../../test/renderWithUi';
import { FieldGroup, InspectorRow } from './InspectorRow';

it('connects labels, descriptions, errors and mixed values to the rendered control', () => {
  renderWithUi(<InspectorRow label="Name" required mixed description="Used in exports" error="Name is required">
    {props => <input {...props} />}</InspectorRow>);
  const input = screen.getByRole('textbox', { name: 'Name' });
  expect(input).toBeRequired(); expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(input).toHaveAccessibleDescription('Used in exports Name is required Multiple values');
});
it('supports caller-owned controls and reset without intercepting field state', () => {
  const reset = vi.fn(); const { rerender } = renderWithUi(<InspectorRow label="Opacity" controlId="opacity" onReset={reset} resetLabel="Reset opacity"><input id="opacity" defaultValue="75" /></InspectorRow>);
  fireEvent.change(screen.getByLabelText('Opacity'), { target: { value: '60' } });
  fireEvent.click(screen.getByRole('button', { name: 'Reset opacity' })); expect(reset).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('Opacity')).toHaveValue('60');
  rerender(<InspectorRow label="Opacity" onReset={reset} resetDisabled><input /></InspectorRow>);
  expect(screen.getByRole('button', { name: 'Reset value' })).toBeDisabled();
});
it('groups fields semantically and disables descendant controls and reset actions', () => {
  const ref = createRef<HTMLFieldSetElement>();
  renderWithUi(<FieldGroup ref={ref} title="Transform" description="Selection properties" disabled>
    <InspectorRow label="X" onReset={() => {}}>{props => <input {...props} />}</InspectorRow></FieldGroup>);
  expect(screen.getByRole('group', { name: 'Transform' })).toBe(ref.current);
  expect(ref.current).toHaveAccessibleDescription('Selection properties');
  expect(screen.getByLabelText('X')).toBeDisabled(); expect(screen.getByRole('button')).toBeDisabled();
});
