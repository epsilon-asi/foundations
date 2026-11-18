import * as React from 'react';
import { Box, Tab, Tabs as MuiTabs, type BoxProps, type TabsProps as MuiTabsProps } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

export interface TabDefinition {
  id: string;
  label: React.ReactNode;
  content?: React.ReactNode;
  icon?: React.ReactElement;
  disabled?: boolean;
  disabledReason?: string;
}

export interface TabsProps extends Omit<BoxProps, 'children' | 'onChange'> {
  tabs: readonly TabDefinition[];
  value: string | false;
  onChange: (value: string, event: React.SyntheticEvent) => void;
  orientation?: MuiTabsProps['orientation'];
  variant?: MuiTabsProps['variant'];
  selectionFollowsFocus?: boolean;
  keepMounted?: boolean;
  density?: 'compact' | 'comfortable';
  tabsSx?: SxProps<Theme>;
  panelSx?: SxProps<Theme>;
}

/** Controlled navigation; URL state and decisions about unsaved work belong to the application. */
export const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(function Tabs(
  { tabs, value, onChange, orientation = 'horizontal', variant = 'scrollable', selectionFollowsFocus = false,
    keepMounted = false, density = 'compact', tabsSx, panelSx, sx, 'aria-label': label,
    'aria-labelledby': labelledBy, ...props }, ref
) {
  const baseId = React.useId();
  const current = tabs.some((tab) => tab.id === value && !tab.disabled) ? value : false;
  return (
    <Box ref={ref} sx={[{ width: '100%', minWidth: 0, minHeight: 0,
      display: orientation === 'vertical' ? 'flex' : 'block' }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]} {...props}>
      <MuiTabs value={current} onChange={(event, next: string) => onChange(next, event)}
        orientation={orientation} variant={variant} selectionFollowsFocus={selectionFollowsFocus}
        aria-label={label ?? (labelledBy ? undefined : 'Sections')} aria-labelledby={labelledBy}
        sx={[{ minWidth: 0, flexShrink: 0,
          ...(orientation === 'vertical' ? { width: '35%', maxWidth: 240, borderRight: 1, borderColor: 'divider' }
            : { maxWidth: '100%', borderBottom: 1, borderColor: 'divider' }),
          '& .MuiTab-root': { minHeight: density === 'compact' ? 32 : 44, minWidth: 0, overflowWrap: 'anywhere' },
          minHeight: density === 'compact' ? 32 : 44 }, ...(Array.isArray(tabsSx) ? tabsSx : tabsSx ? [tabsSx] : [])]}>
        {tabs.map((tab) => {
          const id = `${baseId}-${encodeURIComponent(tab.id)}`;
          return <Tab key={tab.id} value={tab.id} id={`${id}-tab`} aria-controls={`${id}-panel`}
            label={tab.label} icon={tab.icon} iconPosition="start" disabled={tab.disabled}
            aria-description={tab.disabled ? tab.disabledReason : undefined} />;
        })}
      </MuiTabs>
      <Box sx={{ minWidth: 0, minHeight: 0, flex: 1 }}>
        {tabs.map((tab) => {
          const id = `${baseId}-${encodeURIComponent(tab.id)}`;
          const active = current === tab.id;
          return <Box key={tab.id} id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab`}
            hidden={!active} tabIndex={0}
            sx={[{ p: density === 'compact' ? 2 : 3, minWidth: 0, overflowWrap: 'anywhere' },
              ...(Array.isArray(panelSx) ? panelSx : panelSx ? [panelSx] : [])]}>
            {active || keepMounted ? tab.content : null}
          </Box>;
        })}
      </Box>
    </Box>
  );
});
