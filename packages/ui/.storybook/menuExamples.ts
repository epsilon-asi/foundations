import { useEffect, useState } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { MenuItemDefinition, MenuItemOnClickFunction } from '../src/components/Menu';
import { checkStoryLayout } from './layoutAssertions';

export const defaultMenuItems: MenuItemDefinition[] = [
    { id: 'open', label: 'Open workspace' },
    { id: 'share', label: 'Share workspace' },
    { id: 'pin', label: 'Pinned', checked: false },
    { id: 'delete', label: 'Delete workspace', disabled: true }
];

export const defaultMenuActions: MenuItemDefinition[] = [{ id: 'help', label: 'Help and shortcuts' }];

export function useMenuExample(
  items: readonly MenuItemDefinition[] = defaultMenuItems,
  actions: readonly MenuItemDefinition[] = defaultMenuActions,
  onItemClick?: MenuItemOnClickFunction
) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState('Choose an action.');
  useEffect(() => setChecked({}), [items, actions]);

  const interactiveItems = (source: readonly MenuItemDefinition[], group: string) => source.map((item) => ({
    ...item,
    checked: item.checked === undefined ? undefined : checked[`${group}-${item.id}`] ?? item.checked,
    onClick: (selected: MenuItemDefinition, event: Parameters<MenuItemOnClickFunction>[1]) => {
      item.onClick?.(selected, event);
      if (item.checked !== undefined) {
        const key = `${group}-${item.id}`;
        setChecked((previous) => ({ ...previous, [key]: !(previous[key] ?? item.checked) }));
      }
    }
  }));

  return {
    items: interactiveItems(items, 'item'),
    actions: interactiveItems(actions, 'action'),
    onItemClick: ((item, event) => {
      setMessage(`Selected: ${item.id}`);
      onItemClick?.(item, event);
    }) satisfies MenuItemOnClickFunction,
    message
  };
}

export async function openMenu({ canvasElement }: { canvasElement: HTMLElement }) {
  await userEvent.click(within(canvasElement).getByRole('button', { name: 'Workspace actions' }));
  await waitFor(() => expect(within(canvasElement.ownerDocument.body).getByRole('menu')).toBeVisible());
  for (const item of within(canvasElement.ownerDocument.body).queryAllByRole('menuitem')) {
    await expect(item.scrollWidth).toBeLessThanOrEqual(item.clientWidth + 2);
  }
  await checkStoryLayout({ canvasElement });
}
