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
}

export const InspectorSection = React.forwardRef<HTMLDivElement, InspectorSectionProps>(function InspectorSection(
  { title, collapsible = true, expanded, defaultExpanded = true, onExpandedChange, keepMounted = false,
    density = 'compact', headingLevel = 'h3', children, contentSx, ...props }, ref
) {
  const id = React.useId();
  const [internalExpanded, setExpanded] = React.useState(defaultExpanded);
  const open = !collapsible || (expanded ?? internalExpanded);
  const toggle = () => {
    if (expanded === undefined) setExpanded(!open);
    onExpandedChange?.(!open);
  };
  return <Panel ref={ref} role="group" {...props} density={density} headingLevel={headingLevel} contentSx={{ p: 0 }}
    title={collapsible ? <ButtonBase id={`${id}-toggle`} aria-expanded={open} aria-controls={`${id}-content`}
      onClick={toggle} sx={{ width: '100%', justifyContent: 'flex-start', textAlign: 'start', gap: 1,
        borderRadius: 0.5, '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 } }}>
      <SvgIcon fontSize="small" sx={{ flexShrink: 0, transform: open ? 'rotate(90deg)' : 'none' }}><path d="m9 5 7 7-7 7Z" /></SvgIcon>
      <Box component="span" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>{title}</Box>
    </ButtonBase> : title}>
    <Box id={`${id}-content`} hidden={!open} role={collapsible ? 'region' : undefined}
      aria-labelledby={collapsible ? `${id}-toggle` : undefined}
      sx={[{ p: density === 'compact' ? 1.5 : 2 }, ...(Array.isArray(contentSx) ? contentSx : contentSx ? [contentSx] : [])]}>
      {open || keepMounted ? children : null}
    </Box>
  </Panel>;
});
