import type { ActorContext } from '../core/ActorContext.js';
import type { LoginFlowDefinition } from './LoginFlow.types.js';

export class AuthStateDetector {
  async isLoggedIn(context: ActorContext, definition: LoginFlowDefinition): Promise<boolean> {
    if (definition.behavior?.authCheckUrl !== undefined) {
      await context.nav.goto(definition.behavior.authCheckUrl);
    }

    if (definition.hooks?.verifyLoggedIn !== undefined) {
      return Boolean(await definition.hooks.verifyLoggedIn(context));
    }

    return context.page.exists(definition.selectors.loggedInSignal, {
      timeout: definition.behavior?.loggedInTimeoutMs ?? 2_000
    });
  }
}
