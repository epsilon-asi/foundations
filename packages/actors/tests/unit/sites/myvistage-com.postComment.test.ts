import { describe, expect, it } from 'vitest';
import { myvistageComActor } from '../../../src/sites/myvistage-com/myvistage-com.actor.js';
import { myvistageComSelectors } from '../../../src/sites/myvistage-com/myvistage-com.selectors.js';
import { makeContext } from '../../fixtures/makeContext.js';

describe('myvistage-com actor postComment task', () => {
  it('fills fields in order, submits the form, and returns completion output', async () => {
    const { context, fakePage, fakeInteractor } = makeContext({
      actorId: 'myvistage-com',
      baseUrl: 'https://myvistage.com'
    });

    fakePage
      .setSelector(myvistageComSelectors.postComment.comment)
      .setSelector(myvistageComSelectors.postComment.subject)
      .setSelector(myvistageComSelectors.postComment.submit);

    const result = await myvistageComActor.tasks.postComment(context, {
      comment: 'Great insights, thank you for sharing.',
      subject: 'Quick follow-up'
    });

    expect(fakeInteractor.typed).toEqual([
      {
        selector: myvistageComSelectors.postComment.comment,
        value: 'Great insights, thank you for sharing.',
        options: { required: true }
      },
      {
        selector: myvistageComSelectors.postComment.subject,
        value: 'Quick follow-up',
        options: { required: false }
      }
    ]);
    expect(fakeInteractor.clicks).toEqual([{ selector: myvistageComSelectors.postComment.submit }]);
    expect(result).toEqual({
      submittedComment: 'Great insights, thank you for sharing.',
      submittedSubject: 'Quick follow-up'
    });
  });

  it('skips optional fields when not provided and still submits', async () => {
    const { context, fakePage, fakeInteractor } = makeContext({
      actorId: 'myvistage-com',
      baseUrl: 'https://myvistage.com'
    });

    fakePage
      .setSelector(myvistageComSelectors.postComment.comment)
      .setSelector(myvistageComSelectors.postComment.submit);

    const result = await myvistageComActor.tasks.postComment(context, {
      comment: 'Posting without a subject.'
    });

    expect(fakeInteractor.typed).toEqual([
      {
        selector: myvistageComSelectors.postComment.comment,
        value: 'Posting without a subject.',
        options: { required: true }
      }
    ]);
    expect(fakeInteractor.clicks).toEqual([{ selector: myvistageComSelectors.postComment.submit }]);
    expect(result).toEqual({
      submittedComment: 'Posting without a subject.',
      submittedSubject: null
    });
  });
});
