import * as React from 'react';
import { Box } from '@mui/material';
import { InspectorSection, type InspectorSectionProps } from '../InspectorSection';

export interface AccordionProps extends Omit<InspectorSectionProps, 'collapsible'> {}

/** General disclosure composed from our InspectorSection and Panel, collapsed by default. */
export const Accordion = React.forwardRef<HTMLDivElement, AccordionProps>(function Accordion(
  { defaultExpanded = false, density = 'compact', footer, children, ...props }, ref
) {
  return <InspectorSection {...props} ref={ref} collapsible defaultExpanded={defaultExpanded} density={density}>
    {children}
    {footer != null ? <Box sx={{ mt: 2, pt: 1.5, borderTop: 1, borderColor: 'divider', display: 'flex', flexWrap: 'wrap', gap: 1 }}>{footer}</Box> : null}
  </InspectorSection>;
});
