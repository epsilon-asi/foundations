import { expect, waitFor } from 'storybook/test';

/** Browser-only regression checks: JSDOM does not calculate flex/grid geometry. */
export async function checkStoryLayout({ canvasElement, markChecked = true }: { canvasElement: HTMLElement; markChecked?: boolean }) {
  const document = canvasElement.ownerDocument;
  const window = document.defaultView!;
  await document.fonts.ready;
  // MUI measures scrollable tabs and animates portal surfaces after their first paint.
  await waitFor(async () => {
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth + 2);
  
    const walker = document.createTreeWalker(canvasElement, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (!node.textContent?.trim()) continue;
      const parent = node.parentElement;
      if (!parent || parent.closest('style, script, [aria-hidden="true"]')) continue;
      const clippingBounds: DOMRect[] = [];
      let intentionalClip = false;
      for (let element: HTMLElement | null = parent; element; element = element.parentElement) {
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || style.textOverflow === 'ellipsis'
          || style.clipPath !== 'none' || style.overflowX === 'auto' || style.overflowX === 'scroll') {
          intentionalClip = true;
          break;
        }
        if (style.overflowX === 'hidden' || style.overflowX === 'clip') clippingBounds.push(element.getBoundingClientRect());
      }
      if (intentionalClip) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of Array.from(range.getClientRects())) {
        if (!rect.width || !rect.height) continue;
        await expect(rect.left, node.textContent).toBeGreaterThanOrEqual(-2);
        await expect(rect.right, node.textContent).toBeLessThanOrEqual(window.innerWidth + 2);
        for (const bounds of clippingBounds) {
          await expect(rect.left, node.textContent).toBeGreaterThanOrEqual(bounds.left - 2);
          await expect(rect.right, node.textContent).toBeLessThanOrEqual(bounds.right + 2);
        }
      }
    }
  });
  if (markChecked) canvasElement.dataset.layoutChecked = 'true';
}
