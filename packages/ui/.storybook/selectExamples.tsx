import { Box } from '@mui/material';
import { AutoAwesome, Bolt, Brush, Lock } from '@mui/icons-material';
import { expect, waitFor } from 'storybook/test';
import { StatusBadge } from '../src/components/StatusBadge';
import type { SelectOption } from '../src/components/SingleSelect';
import { checkStoryLayout } from './layoutAssertions';
import { checkOverlayLayout } from './overlayExamples';

export const modelOptions: SelectOption<string>[] = [
  { value: 'fast', label: 'Fast concept', description: 'Quick exploration for early ideas and thumbnail studies.', icon: <Bolt />, meta: <StatusBadge label="Fast" tone="info" />, keywords: ['draft', 'quick'] },
  { value: 'balanced', label: 'Balanced', description: 'A good balance of detail and generation time.', icon: <AutoAwesome />, meta: <StatusBadge label="Recommended" tone="success" /> },
  { value: 'quality', label: 'Production quality', description: 'Detailed assets for final artwork and production review.', icon: <Brush />, meta: <StatusBadge label="High detail" tone="neutral" /> },
  { value: 'legacy', label: 'Legacy model', description: 'Previous generation model.', icon: <Lock />, disabled: true, disabledReason: 'Unavailable for new workspaces', meta: <StatusBadge label="Retired" tone="warning" /> }
];
export const groupedOptions = modelOptions.map((option, index) => ({ ...option, group: index < 2 ? 'Exploration' : 'Production' }));
export const longOptions: SelectOption<string>[] = [
  { value: 'long', label: 'Character design explorations and production-ready creative assets', description: 'project_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz',
    icon: <Brush />, meta: <StatusBadge label="Requires production review" tone="warning" /> },
  { value: 'other', label: 'Environment studies and visual development', description: 'A detailed explanation of the option that should wrap cleanly on narrow screens.' }
];

export async function checkSelectLayout({ canvasElement, markChecked = true }: { canvasElement: HTMLElement; markChecked?: boolean }) {
  const document = canvasElement.ownerDocument;
  await waitFor(async () => {
    for (const root of document.querySelectorAll<HTMLElement>('.MuiAutocomplete-root')) {
      const field = root.querySelector<HTMLElement>('.MuiFormControl-root');
      if (!field || !root.getBoundingClientRect().width) continue;
      const style = document.defaultView!.getComputedStyle(root);
      const available = root.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      await expect(Math.abs(field.getBoundingClientRect().width - available), 'Select field fills its container').toBeLessThanOrEqual(2);
    }
    for (const popup of document.querySelectorAll<HTMLElement>('.MuiAutocomplete-paper')) {
      const bounds = popup.getBoundingClientRect();
      await expect(bounds.left).toBeGreaterThanOrEqual(-2);
      await expect(bounds.right).toBeLessThanOrEqual(document.defaultView!.innerWidth + 2);
      for (const option of popup.querySelectorAll<HTMLElement>('[role="option"]')) {
        await expect(option.scrollWidth, option.textContent ?? '').toBeLessThanOrEqual(option.clientWidth + 2);
      }
      await checkStoryLayout({ canvasElement: popup, markChecked: false });
    }
  });
  await checkOverlayLayout({ canvasElement, markChecked });
}
export const selectContainer = (Story: React.ComponentType) => <Box sx={{ width: '100%', maxWidth: 460, minWidth: 0 }}><Story /></Box>;
