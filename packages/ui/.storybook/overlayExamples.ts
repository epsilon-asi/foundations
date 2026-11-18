import { expect, waitFor, within } from 'storybook/test';
import { checkStoryLayout } from './layoutAssertions';

/** Portals live outside Storybook's canvas; inspect their text and bounds too. */
export async function checkOverlayLayout({ canvasElement, markChecked = true }: { canvasElement: HTMLElement; markChecked?: boolean }) {
  const body = within(canvasElement.ownerDocument.body);
  const overlay = body.queryByRole('dialog') ?? body.queryByRole('alertdialog');
  if (overlay) {
    await waitFor(() => expect(overlay).toBeVisible());
    await checkStoryLayout({ canvasElement: overlay, markChecked: false });
  }
  await checkStoryLayout({ canvasElement, markChecked });
}
