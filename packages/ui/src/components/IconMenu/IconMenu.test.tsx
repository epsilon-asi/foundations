import { createRef } from 'react';
import { screen } from '@testing-library/react';
import { testMenuTrigger } from '../../test/menuTriggerContract';
import { renderWithUi } from '../../test/renderWithUi';
import { IconMenu } from './IconMenu';

testMenuTrigger('IconMenu', (props) => <IconMenu aria-label="Options" {...props} />);

it('forwards icon button props, custom content and refs', () => {
  const ref = createRef<HTMLButtonElement>();
  renderWithUi(<IconMenu ref={ref} aria-label="Options" items={[]} variant="round" sx={{ padding: '12px' }}>★</IconMenu>);
  expect(ref.current).toBe(screen.getByRole('button', { name: 'Options' }));
  expect(ref.current).toHaveTextContent('★');
  expect(ref.current).toHaveStyle({ padding: '12px', borderRadius: '50%' });
});
