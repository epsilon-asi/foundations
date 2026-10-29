import { describe, expect, it } from 'vitest';
import { SelectorError } from '../../../src/errors/SelectorError.js';
import { FormFiller } from '../../../src/interaction/Forms.js';
import { PuppeteerPageAdapter } from '../../../src/interaction/PageAdapter.js';
import { FakeHumanInteractor } from '../../fixtures/FakeCursor.js';
import { FakePage } from '../../fixtures/FakePage.js';

describe('FormFiller', () => {
  it('fills text through the configured human interactor', async () => {
    const page = new FakePage().setSelector('#email');
    const interactor = new FakeHumanInteractor();
    const form = new FormFiller(new PuppeteerPageAdapter(page), interactor);

    await form.fillText('#email', 'me@example.com', { delayMs: 10 });

    expect(interactor.typed).toEqual([{ selector: '#email', value: 'me@example.com', options: { delayMs: 10 } }]);
  });

  it('throws SelectorError for a missing required field', async () => {
    const page = new FakePage();
    const form = new FormFiller(new PuppeteerPageAdapter(page), new FakeHumanInteractor());

    await expect(form.fillText('#missing', 'value')).rejects.toBeInstanceOf(SelectorError);
  });

  it('skips missing optional fields', async () => {
    const page = new FakePage();
    const interactor = new FakeHumanInteractor();
    const form = new FormFiller(new PuppeteerPageAdapter(page), interactor);

    await form.fillText('#missing', 'value', { required: false });

    expect(interactor.typed).toHaveLength(0);
  });
});
