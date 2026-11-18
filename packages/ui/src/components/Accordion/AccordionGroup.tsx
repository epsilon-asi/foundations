import * as React from 'react';
import { Box, type BoxProps } from '@mui/material';
import { Accordion, type AccordionProps } from './Accordion';

export interface AccordionGroupItem extends Omit<AccordionProps,
  'id' | 'content' | 'children' | 'expanded' | 'defaultExpanded' | 'onExpandedChange' | 'ref'> {
  id: string;
  content: React.ReactNode;
}
export interface AccordionGroupProps extends Omit<BoxProps<'div'>, 'children' | 'ref'> {
  items: readonly AccordionGroupItem[];
  mode?: 'single' | 'multiple';
  expandedIds?: readonly string[];
  defaultExpandedIds?: readonly string[];
  onExpandedChange?: (expandedIds: string[], itemId: string) => void;
  disabled?: boolean;
  density?: AccordionProps['density'];
  keepMounted?: boolean;
  headingLevel?: AccordionProps['headingLevel'];
}

const triggerSelector = 'button[aria-expanded][aria-controls]';

export const AccordionGroup = React.forwardRef<HTMLDivElement, AccordionGroupProps>(function AccordionGroup(
  { items, mode = 'single', expandedIds, defaultExpandedIds = [], onExpandedChange, disabled = false,
    density = 'compact', keepMounted = false, headingLevel = 'h3', sx,
    onKeyDown, onFocusCapture, onBlurCapture, 'aria-label': label = 'Accordion sections', ...props }, ref
) {
  const root = React.useRef<HTMLDivElement>(null);
  const lastFocus = React.useRef<{ id: string; element: HTMLElement } | null>(null);
  const [internal, setExpanded] = React.useState<readonly string[]>(defaultExpandedIds);
  React.useImperativeHandle(ref, () => root.current!);
  const valid = new Set(items.map((item) => item.id));
  const ids = [...new Set(expandedIds ?? internal)].filter((id) => valid.has(id));
  const expanded = new Set(mode === 'single' ? ids.slice(0, 1) : ids);
  const available = items.filter((item) => !disabled && !item.disabled);
  const itemNode = (id: string) => Array.from(root.current?.children ?? []).find((node) => (node as HTMLElement).dataset.accordionItem === id) as HTMLElement | undefined;
  const trigger = (id: string) => itemNode(id)?.querySelector<HTMLButtonElement>(triggerSelector);

  React.useLayoutEffect(() => {
    const focused = lastFocus.current;
    if (!focused) return;
    const inside = root.current?.contains(focused.element) && !focused.element.closest('[hidden]');
    // Disabling a header does not disable its open body or independent actions.
    if (inside && (focused.element !== trigger(focused.id) || available.some((item) => item.id === focused.id))) return;
    const destination = available.find((item) => item.id === focused.id) ?? available[0];
    (destination ? trigger(destination.id) : root.current)?.focus();
  });

  return <Box ref={root} role="group" aria-label={label} tabIndex={-1} data-accordion-group {...props}
    sx={[{ display: 'grid', gap: 1, minWidth: 0, width: '100%' }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
    onFocusCapture={(event: React.FocusEvent<HTMLDivElement>) => {
      onFocusCapture?.(event);
      const element = event.target as HTMLElement;
      const item = Array.from(root.current?.children ?? []).find((node) => node.contains(element)) as HTMLElement | undefined;
      if (item?.dataset.accordionItem) lastFocus.current = { id: item.dataset.accordionItem, element };
    }}
    onBlurCapture={(event: React.FocusEvent<HTMLDivElement>) => {
      onBlurCapture?.(event);
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) lastFocus.current = null;
    }}
    onKeyDown={(event: React.KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const element = (event.target as HTMLElement).closest<HTMLElement>(triggerSelector);
      if (!element || element.closest('[data-accordion-group]') !== root.current) return;
      const index = available.findIndex((item) => trigger(item.id) === element);
      if (index === -1) return;
      const next = event.key === 'ArrowDown' ? (index + 1) % available.length
        : event.key === 'ArrowUp' ? (index + available.length - 1) % available.length
          : event.key === 'Home' ? 0 : event.key === 'End' ? available.length - 1 : null;
      if (next !== null) { event.preventDefault(); trigger(available[next].id)?.focus(); }
    }}>
    {items.map(({ id, content, disabled: itemDisabled, ...item }) => <Accordion key={id} density={density} keepMounted={keepMounted}
      headingLevel={headingLevel} {...item} data-accordion-item={id} disabled={disabled || itemDisabled} expanded={expanded.has(id)}
      onExpandedChange={(open) => {
        if (disabled || itemDisabled) return;
        const next = open ? mode === 'single' ? [id] : [...expanded, id] : [...expanded].filter((candidate) => candidate !== id);
        if (expandedIds === undefined) setExpanded(next);
        onExpandedChange?.(next, id);
      }}>{content}</Accordion>)}
  </Box>;
});
