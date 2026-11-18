import { createRef } from 'react';
import { screen } from '@testing-library/react';
import { testMenuTrigger } from '../../test/menuTriggerContract';
import { renderWithUi } from '../../test/renderWithUi';
import { DropdownMenu } from './DropdownMenu';

testMenuTrigger('DropdownMenu', (props) => <DropdownMenu label="Options" {...props} />);

it('forwards dropdown button props and refs', () => {
  const ref = createRef<HTMLButtonElement>();
  renderWithUi(<DropdownMenu ref={ref} label="Options" items={[]} variant="contained" sx={{ padding: '12px' }} />);
  expect(ref.current).toBe(screen.getByRole('button', { name: 'Options' }));
  expect(ref.current).toHaveStyle({ padding: '12px' });
});
