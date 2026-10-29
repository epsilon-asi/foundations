import { defineLoginFlow } from '../../auth/LoginFlow.types.js';
import { defineFormFillerTask } from '../../core/Actor.js';
import { defineActor } from '../../core/defineActor.js';
import { myvistageComSelectors } from './myvistage-com.selectors.js';
import type {
  PingInput,
  PingOutput,
  PostCommentInput,
  PostCommentOutput
} from './myvistage-com.types.js';

export const myvistageComActor = defineActor({
  id: 'myvistage-com',
  baseUrl: 'https://myvistage.com',
  auth: defineLoginFlow({
    loginUrl: 'https://myvistage.com',
    selectors: myvistageComSelectors.login,
    credentials: { id: 'myvistage_com' },
    behavior: {
      authCheckUrl: '/',
      submitCausesNavigation: true,
      loggedInTimeoutMs: 5_000,
      errorTimeoutMs: 1_500,
      typing: {
        targetWordsPerMinute: 65,
        intervalJitterMs: 18
      }
    }
  }),
  tasks: {
    ping: async (_context, input: PingInput = {}): Promise<PingOutput> => ({
      ok: true,
      echo: input.message ?? null
    }),
    goToPostPage:  async (context, input: {url: string,}): Promise<void> => {
      await context.nav.goto(input.url, {
        waitUntil: 'networkidle0',
      });
    },
    postComment: defineFormFillerTask<PostCommentInput, PostCommentOutput>({
      fields: [
        { selector: myvistageComSelectors.postComment.comment, inputKey: 'comment' },
        { selector: myvistageComSelectors.postComment.subject, inputKey: 'subject', required: false }
      ],
      submit: {
        selector: myvistageComSelectors.postComment.submit
      },
      onComplete: (_context, input) => ({
        submittedComment: input.comment,
        submittedSubject: input.subject ?? null
      })
    })
  }
});
