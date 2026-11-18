import * as React from 'react';
import { Box, ButtonBase, SvgIcon } from '@mui/material';
import { Panel, type PanelProps } from '../Panel';

export interface InspectorSectionProps extends PanelProps {
  title: React.ReactNode;
  collapsible?: boolean;
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  keepMounted?: boolean;
  disabled?: boolean;
}

export const InspectorSection = React.forwardRef<HTMLDivElement, InspectorSectionProps>(function InspectorSection(
  { title, collapsible = true, expanded, defaultExpanded = true, onExpandedChange, keepMounted = false, disabled = false,
    density = 'compact', headingLevel = 'h3', children, contentSx, ...props }, ref
) {
  const id = React.useId();
  const [internalExpanded, setExpanded] = React.useState(defaultExpanded);
  const root = React.useRef<HTMLDivElement>(null);
  const trigger = React.useRef<HTMLButtonElement>(null);
  const contentHadFocus = React.useRef(false);
  React.useImperativeHandle(ref, () => root.current!);
  const open = !collapsible || (expanded ?? internalExpanded);
  React.useLayoutEffect(() => {
    if (!open && contentHadFocus.current) {
      contentHadFocus.current = false;
      (disabled ? root.current : trigger.current)?.focus();
    }
  }, [open, disabled]);
  const toggle = () => {
    if (disabled) return;
    if (expanded === undefined) setExpanded(!open);
    onExpandedChange?.(!open);
  };
  return <Panel ref={root} role="group" tabIndex={-1} {...props} density={density} headingLevel={headingLevel} contentSx={{ p: 0 }}
    title={collapsible ? <ButtonBase ref={trigger} id={`${id}-toggle`} disabled={disabled} aria-expanded={open} aria-controls={`${id}-content`}
      onClick={toggle} sx={{ width: '100%', minHeight: 28, font: 'inherit', justifyContent: 'flex-start', textAlign: 'start', gap: 1,
        borderRadius: 0.5, '&.Mui-disabled': { opacity: 0.5 },
        '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 } }}>
      <SvgIcon fontSize="small" sx={(theme) => ({ flexShrink: 0, transform: open ? 'rotate(90deg)' : theme.direction === 'rtl' ? 'rotate(180deg)' : 'none' })}><path d="m9 5 7 7-7 7Z" /></SvgIcon>
      <Box component="span" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>{title}</Box>
    </ButtonBase> : title}>
    <Box id={`${id}-content`} hidden={!open} role={collapsible ? 'region' : undefined}
      aria-labelledby={collapsible ? `${id}-toggle` : undefined}
      onFocusCapture={() => { contentHadFocus.current = true; }}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) contentHadFocus.current = false; }}
      sx={[{ p: density === 'compact' ? 2 : 3 }, ...(Array.isArray(contentSx) ? contentSx : contentSx ? [contentSx] : [])]}>
      {open || keepMounted ? children : null}
    </Box>
  </Panel>;
});
