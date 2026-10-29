import { AuthError } from '../errors/AuthError.js';
import { delay } from '../utils/delay.js';
import { redact } from '../utils/redact.js';
import type { ActorContext } from '../core/ActorContext.js';
import type { FillTextOptions } from '../interaction/Forms.js';
import { mergeHumanTypingOptions, type HumanTypingOptions } from '../interaction/HumanTyping.js';
import type { Credentials, CredentialsProvider } from './CredentialsProvider.js';
import { AuthStateDetector } from './AuthStateDetector.js';
import {
  hasStandardLoginSelectors,
  type ClickLoginStep,
  type FillCredentialLoginStep,
  type LoginFillStep,
  type LoginFlowDefinition,
  type LoginStep,
  type WaitForSelectorLoginStep
} from './LoginFlow.types.js';

export class LoginFlow {
  constructor(
    private readonly credentialsProvider: CredentialsProvider,
    private readonly detector = new AuthStateDetector()
  ) {}

  async ensureAuthenticated(context: ActorContext, definition: LoginFlowDefinition): Promise<void> {
    if (await this.detector.isLoggedIn(context, definition)) {
      context.logger.info('Existing Chrome profile is already authenticated.', {
        actorId: context.actor.id
      });
      return;
    }

    await this.login(context, definition);
  }

  async login(context: ActorContext, definition: LoginFlowDefinition): Promise<void> {
    if (definition.credentials === undefined) {
      throw new AuthError('Login is required, but no credentials ref was configured for this actor.', {
        actorId: context.actor.id
      });
    }

    const credentials = await this.credentialsProvider.getCredentials(definition.credentials);
    const maxAttempts = definition.behavior?.maxAttempts ?? 1;
    const steps = this.resolveSteps(definition);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      context.logger.info('Starting login attempt.', {
        actorId: context.actor.id,
        attempt,
        steps: steps.length,
        credentials: redact({ username: credentials.username, password: credentials.password })
      });

      await context.nav.goto(definition.loginUrl);
      await definition.hooks?.beforeLogin?.(context);

      await this.executeSteps(context, definition, credentials, steps);

      if ((definition.behavior?.waitAfterSubmitMs ?? 0) > 0) {
        await delay(definition.behavior?.waitAfterSubmitMs ?? 0);
      }

      await this.throwIfConfiguredErrorIsVisible(context, definition);

      if (await this.detector.isLoggedIn(context, definition)) {
        context.logger.info('Login succeeded.', { actorId: context.actor.id, attempt });
        return;
      }
    }

    throw new AuthError('Login did not result in an authenticated session.', {
      actorId: context.actor.id,
      details: { maxAttempts }
    });
  }

  private resolveSteps(definition: LoginFlowDefinition): LoginStep[] {
    if (definition.steps !== undefined && definition.steps.length > 0) {
      return definition.steps;
    }

    if (!hasStandardLoginSelectors(definition.selectors)) {
      throw new AuthError(
        'Login flow requires either selectors.username/password/submit for a simple login or an ordered steps array for a multi-step login.'
      );
    }

    const submitStep: ClickLoginStep = {
      type: 'click',
      name: 'submit',
      selector: definition.selectors.submit,
      submit: true,
      navigationOptions: { waitUntil: 'domcontentloaded' },
      checkForError: false
    };

    if (definition.behavior?.submitCausesNavigation !== undefined) {
      submitStep.waitForNavigation = definition.behavior.submitCausesNavigation;
    }

    return [
      {
        type: 'fill',
        name: 'username',
        selector: definition.selectors.username,
        credential: 'username'
      },
      {
        type: 'fill',
        name: 'password',
        selector: definition.selectors.password,
        credential: 'password'
      },
      submitStep
    ];
  }

  private async executeSteps(
    context: ActorContext,
    definition: LoginFlowDefinition,
    credentials: Credentials,
    steps: LoginStep[]
  ): Promise<void> {
    for (const [index, step] of steps.entries()) {
      const label = this.stepLabel(step, index);
      context.logger.debug('Executing login step.', {
        actorId: context.actor.id,
        step: label,
        type: step.type
      });

      if (step.type === 'hook') {
        await step.run(context);
        continue;
      }

      await step.before?.(context);

      if (step.type === 'fill') {
        await this.executeFillStep(context, definition, credentials, step);
      } else if (step.type === 'click') {
        await this.executeClickStep(context, definition, step, label);
      } else {
        await this.executeWaitForSelectorStep(context, definition, step, label);
      }

      await step.after?.(context);
    }
  }

  private async executeFillStep(
    context: ActorContext,
    definition: LoginFlowDefinition,
    credentials: Credentials,
    step: LoginFillStep
  ): Promise<void> {
    const value = await this.resolveFillValue(step, credentials, context);
    await context.forms.fillText(step.selector, value, this.buildFillOptions(definition, step));

    if (this.isCredentialFillStep(step)) {
      if (step.credential === 'username') {
        await definition.hooks?.afterUsername?.(context);
      } else {
        await definition.hooks?.afterPassword?.(context);
      }
    }
  }

  private async executeClickStep(
    context: ActorContext,
    definition: LoginFlowDefinition,
    step: ClickLoginStep,
    label: string
  ): Promise<void> {
    if (step.submit) {
      await definition.hooks?.beforeSubmit?.(context);
    }

    if (step.waitForNavigation) {
      await Promise.all([
        context.page.waitForNavigation(step.navigationOptions ?? { waitUntil: 'domcontentloaded' }),
        context.cursor.click(step.selector, this.clickOptions(step))
      ]);
    } else {
      await context.cursor.click(step.selector, this.clickOptions(step));
    }

    if (step.submit) {
      await definition.hooks?.afterSubmit?.(context);
    }

    if ((step.waitAfterMs ?? 0) > 0) {
      await delay(step.waitAfterMs ?? 0);
    }

    if (this.shouldCheckForStepError(definition, step.checkForError)) {
      await this.throwIfConfiguredErrorIsVisible(context, definition, label);
    }

    if (step.waitForSelector !== undefined) {
      await this.waitForNextStageSelector(context, definition, step, label);
    }
  }

  private async executeWaitForSelectorStep(
    context: ActorContext,
    definition: LoginFlowDefinition,
    step: WaitForSelectorLoginStep,
    label: string
  ): Promise<void> {
    await this.waitForRequiredSelector(context, definition, step.selector, label, step.timeoutMs);

    if (this.shouldCheckForStepError(definition, step.checkForError)) {
      await this.throwIfConfiguredErrorIsVisible(context, definition, label);
    }
  }

  private async waitForNextStageSelector(
    context: ActorContext,
    definition: LoginFlowDefinition,
    step: ClickLoginStep,
    label: string
  ): Promise<void> {
    await this.waitForRequiredSelector(
      context,
      definition,
      step.waitForSelector!,
      label,
      step.waitForSelectorTimeoutMs
    );
  }

  private async waitForRequiredSelector(
    context: ActorContext,
    definition: LoginFlowDefinition,
    selector: string,
    label: string,
    timeoutMs: number | undefined
  ): Promise<void> {
    try {
      await context.page.waitFor(selector, timeoutMs === undefined ? undefined : { timeout: timeoutMs });
    } catch (error) {
      await this.throwIfConfiguredErrorIsVisible(context, definition, label);
      throw new AuthError(`Login step ${label} did not reach expected selector: ${selector}`, {
        actorId: context.actor.id,
        details: { selector, step: label, cause: error }
      });
    }
  }

  private buildFillOptions(definition: LoginFlowDefinition, step: LoginFillStep): FillTextOptions {
    const options: FillTextOptions = {
      required: step.required ?? true,
      clear: step.clearFieldBeforeTyping ?? definition.behavior?.clearFieldBeforeTyping ?? true,
      clearMethod: step.clearMethod ?? 'select-delete'
    };

    if (step.timeoutMs !== undefined) {
      options.timeoutMs = step.timeoutMs;
    }
    if (step.clickBeforeTyping !== undefined) {
      options.clickBeforeTyping = step.clickBeforeTyping;
    }

    const typing = this.mergeStepTyping(definition.behavior?.typing, step.typing);
    if (typing !== undefined) {
      options.typing = typing;
    }

    return options;
  }

  private mergeStepTyping(
    behaviorTyping: HumanTypingOptions | undefined,
    stepTyping: HumanTypingOptions | undefined
  ): HumanTypingOptions | undefined {
    if (behaviorTyping === undefined && stepTyping === undefined) return undefined;
    return mergeHumanTypingOptions(behaviorTyping, stepTyping);
  }

  private async resolveFillValue(
    step: LoginFillStep,
    credentials: Credentials,
    context: ActorContext
  ): Promise<string> {
    if (this.isCredentialFillStep(step)) {
      return credentials[step.credential];
    }

    if (typeof step.value === 'function') {
      return step.value(credentials, context);
    }

    return step.value;
  }

  private isCredentialFillStep(step: LoginFillStep): step is FillCredentialLoginStep {
    return 'credential' in step;
  }

  private clickOptions(step: ClickLoginStep): { timeoutMs?: number } | undefined {
    if (step.timeoutMs === undefined) return undefined;
    return { timeoutMs: step.timeoutMs };
  }

  private shouldCheckForStepError(definition: LoginFlowDefinition, checkForError: boolean | undefined): boolean {
    return definition.selectors.errorMessage !== undefined && (checkForError ?? true);
  }

  private async throwIfConfiguredErrorIsVisible(
    context: ActorContext,
    definition: LoginFlowDefinition,
    stepLabel?: string
  ): Promise<void> {
    if (definition.selectors.errorMessage === undefined) return;

    const hasError = await context.page.exists(definition.selectors.errorMessage, {
      timeout: definition.behavior?.errorTimeoutMs ?? 500
    });

    if (!hasError) return;

    const message = await context.page.text(definition.selectors.errorMessage);
    const prefix = stepLabel === undefined ? 'Login failed' : `Login failed during step ${stepLabel}`;
    throw new AuthError(`${prefix}: ${message}`, { actorId: context.actor.id });
  }

  private stepLabel(step: LoginStep, index: number): string {
    return step.name === undefined ? `#${index + 1}` : `"${step.name}"`;
  }
}
