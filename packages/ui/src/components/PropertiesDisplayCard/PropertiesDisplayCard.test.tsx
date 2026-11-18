import { defaultUiTheme } from '../../theme';
import { createRef } from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithUi } from '../../test/renderWithUi';
import { ActionButton } from '../ActionButton';
import { PropertiesDisplayCard, PropertyListItem } from './PropertiesDisplayCard';

describe('PropertiesDisplayCard', () => {
  it('renders a heading, subtitle and semantic label/value pairs', () => {
    renderWithUi(
      <PropertiesDisplayCard
        title="Workspace"
        subtitle="Current configuration"
        properties={[{ id: 'name', label: 'Name', value: 'Epsilon', align: 'horizontal' }]}
      />
    );

    expect(screen.getByRole('heading', { name: 'Workspace', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('Current configuration')).toBeInTheDocument();
    expect(screen.getByRole('term')).toHaveTextContent('Name');
    expect(screen.getByRole('definition')).toHaveTextContent('Epsilon');
    expect(screen.getByRole('term').parentElement?.parentElement?.tagName).toBe('DL');
  });

  it('preserves zero and boolean values and provides a nullish-value fallback', () => {
    renderWithUi(
      <PropertiesDisplayCard
        title="Usage"
        properties={[
          { label: 'Count', value: 0 },
          { label: 'Enabled', value: false },
          { label: 'Verified', value: true },
          { label: 'Missing' },
          { label: 'Null', value: null }
        ]}
      />
    );

    expect(screen.getAllByRole('definition').map((element) => element.textContent)).toEqual([
      '0', 'false', 'true', '—', '—'
    ]);
  });

  it('accepts rich values and independent header and footer actions', () => {
    const onEdit = vi.fn();
    const onArchive = vi.fn();
    renderWithUi(
      <PropertiesDisplayCard
        title="Project"
        properties={[{ label: 'Owner', value: <a href="/people/chris">Chris</a> }]}
        headerAction={<ActionButton onClick={onEdit}>Edit</ActionButton>}
        actions={<ActionButton onClick={onArchive}>Archive</ActionButton>}
      />
    );

    expect(screen.getByRole('link', { name: 'Chris' })).toHaveAttribute('href', '/people/chris');
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onArchive).toHaveBeenCalledTimes(1);
  });

  it('handles an empty collection and updates when properties change', () => {
    const { rerender } = renderWithUi(<PropertiesDisplayCard title="Usage" properties={[]} />);
    expect(screen.queryByRole('term')).not.toBeInTheDocument();

    rerender(<PropertiesDisplayCard title="Usage" properties={[{ id: 'count', label: 'Count', value: 4 }]} />);
    expect(screen.getByRole('definition')).toHaveTextContent('4');

    rerender(<PropertiesDisplayCard title="Usage" properties={[{ id: 'count', label: 'Count', value: 5 }]} />);
    expect(screen.getByRole('definition')).toHaveTextContent('5');
  });

  it('forwards card props, refs and theme-aware sx', () => {
    const ref = createRef<HTMLDivElement>();
    renderWithUi(
      <PropertiesDisplayCard
        ref={ref}
        title="Usage"
        properties={[]}
        aria-label="Usage card"
        sx={[{ padding: '1px' }, (theme) => ({ padding: `${theme.shape.borderRadius}px` })]}
      />
    );

    expect(ref.current).toBe(screen.getByLabelText('Usage card'));
    expect(ref.current).toHaveStyle({ padding: `${defaultUiTheme.shape.borderRadius}px` });
  });
});

describe('PropertyListItem', () => {
  it('allows custom children to override the value, including zero', () => {
    renderWithUi(
      <dl>
        <PropertyListItem label="Count" value="Ignored">{0}</PropertyListItem>
      </dl>
    );

    expect(screen.getByRole('definition')).toHaveTextContent('0');
    expect(screen.queryByText('Ignored')).not.toBeInTheDocument();
  });

  it('supports a custom empty value, root props and sx overrides', () => {
    const ref = createRef<HTMLDivElement>();
    renderWithUi(
      <dl>
        <PropertyListItem
          ref={ref}
          label="Owner"
          id="owner"
          disableGutters
          emptyValue="Unassigned"
          sx={{ padding: '4px' }}
        />
      </dl>
    );

    expect(screen.getByRole('definition')).toHaveTextContent('Unassigned');
    expect(ref.current).toHaveAttribute('id', 'owner');
    expect(ref.current).toHaveStyle({ padding: '4px' });
  });
});
