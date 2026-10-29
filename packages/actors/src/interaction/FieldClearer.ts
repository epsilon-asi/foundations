import type { PageLike } from '../browser/PuppeteerLike.js';

export type ClearFieldStrategy = 'select-delete' | 'dom-value';

export interface ClearFieldOptions {
  strategy?: ClearFieldStrategy;
}

export async function clearField(page: PageLike, selector: string, options: ClearFieldOptions = {}): Promise<void> {
  const strategy = options.strategy ?? 'select-delete';

  if (strategy === 'dom-value') {
    await clearFieldValueInDom(page, selector);
    return;
  }

  await selectFieldContents(page, selector);
  await page.keyboard.press('Backspace');
  await clearFieldValueInDom(page, selector);
}

async function selectFieldContents(page: PageLike, selector: string): Promise<void> {
  await page.$eval(selector, element => {
    const target = element as HTMLElement & {
      value?: string;
      select?: () => void;
      setSelectionRange?: (start: number, end: number) => void;
    };

    target.focus();

    if (typeof target.select === 'function') {
      target.select();
      target.dispatchEvent(new Event('select', { bubbles: true }));
      return;
    }

    if (typeof target.value === 'string' && typeof target.setSelectionRange === 'function') {
      target.setSelectionRange(0, target.value.length);
      target.dispatchEvent(new Event('select', { bubbles: true }));
      return;
    }

    if (target.isContentEditable) {
      const range = document.createRange();
      range.selectNodeContents(target);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      target.dispatchEvent(new Event('select', { bubbles: true }));
    }
  });
}

async function clearFieldValueInDom(page: PageLike, selector: string): Promise<void> {
  await page.$eval(selector, element => {
    const target = element as HTMLElement & { value?: string };
    let changed = false;

    if (typeof target.value === 'string' && target.value.length > 0) {
      target.value = '';
      changed = true;
    } else if (target.isContentEditable && (target.textContent ?? '').length > 0) {
      target.textContent = '';
      changed = true;
    }

    if (changed) {
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
}
