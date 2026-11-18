import { Box } from '@mui/material';
import { AutoAwesome, Bolt, Brush } from '@mui/icons-material';
import { StatusBadge } from '../src/components/StatusBadge';
import type { RadioOption } from '../src/components/RadioGroup';
import { UiProvider, createUiTheme } from '../src/theme';
import { checkStoryLayout } from './layoutAssertions';

export const qualityOptions: RadioOption<string>[] = [
  { value: 'draft', label: 'Draft', description: 'Quick exploration and thumbnail studies.', icon: <Bolt /> },
  { value: 'balanced', label: 'Balanced', description: 'A balance of quality and generation time.', icon: <AutoAwesome />, meta: <StatusBadge label="Recommended" tone="success" /> },
  { value: 'production', label: 'Production', description: 'Detailed assets for final artwork.', icon: <Brush /> },
  { value: 'retired', label: 'Legacy model', description: 'No longer available for new work.', disabled: true }
];
export const controlContainer = (Story: React.ComponentType) => <Box sx={{ maxWidth: 680, minWidth: 0 }}><Story /></Box>;
const rtlTheme = createUiTheme({ direction: 'rtl' });
export const withRtlUi = (Story: React.ComponentType) => <UiProvider theme={rtlTheme}><Box dir="rtl"><Story /></Box></UiProvider>;
export async function checkFeedbackLayout({ canvasElement, markChecked = true }: { canvasElement: HTMLElement; markChecked?: boolean }) {
  for (const toast of canvasElement.ownerDocument.querySelectorAll<HTMLElement>('.MuiSnackbar-root')) await checkStoryLayout({ canvasElement: toast, markChecked: false });
  await checkStoryLayout({ canvasElement, markChecked });
}
