import { defineLoginFlow } from '../../auth/LoginFlow.types.js';
import { defineActor } from '../../core/defineActor.js';
import { defineFormFillerTask } from '../../core/Actor.js';
import { exampleSelectors } from './example.selectors.js';
import type {
  DashboardRow,
  ScrapeDashboardInput,
  SubmitContactFormInput,
  SubmitContactFormOutput
} from './example.types.js';

export const exampleActor = defineActor({
  id: 'example',
  baseUrl: 'https://example.com',
  auth: defineLoginFlow({
    loginUrl: '/login',
    selectors: exampleSelectors.login,
    credentials: { id: 'example' },
    behavior: {
      authCheckUrl: '/',
      submitCausesNavigation: true,
      loggedInTimeoutMs: 3_000,
      clearFieldBeforeTyping: true,
      typing: {
        targetWordsPerMinute: 65,
        intervalJitterMs: 18
      }
    }
  }),
  tasks: {
    scrapeDashboard: async (context, input: ScrapeDashboardInput = {}): Promise<DashboardRow[]> => {
      await context.nav.goto('/dashboard');
      const rows = await context.extract.textList(exampleSelectors.dashboardRows);
      return rows.slice(0, input.limit ?? rows.length).map(text => ({ text }));
    },
    submitContactForm: defineFormFillerTask<SubmitContactFormInput, SubmitContactFormOutput>({
      url: '/contact',
      fields: [
        { selector: exampleSelectors.contactForm.name, inputKey: 'name' },
        { selector: exampleSelectors.contactForm.email, inputKey: 'email' },
        { selector: exampleSelectors.contactForm.company, inputKey: 'company', required: false },
        { selector: exampleSelectors.contactForm.message, inputKey: 'message' }
      ],
      submit: {
        selector: exampleSelectors.contactForm.submit,
        waitForNavigation: true
      },
      onComplete: (_context, input) => ({
        submittedEmail: input.email
      })
    })
  }
});
