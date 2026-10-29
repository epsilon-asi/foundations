import type { WaitForOptions } from 'puppeteer-core';
import type { ActorContext } from '../core/ActorContext.js';
import type { ClearFieldStrategy } from '../interaction/FieldClearer.js';
import type { HumanTypingOptions } from '../interaction/HumanTyping.js';
import type { CredentialRef, Credentials } from './CredentialsProvider.js';

export interface LoginResultSelectors {
  loggedInSignal: string;
  errorMessage?: string;
}

export interface StandardLoginSelectors extends LoginResultSelectors {
  username: string;
  password: string;
  submit: string;
}

export type LoginSelectors = LoginResultSelectors | StandardLoginSelectors;

export type AuthHook = (context: ActorContext) => Promise<void> | void;
export type AuthVerifier = (context: ActorContext) => Promise<boolean> | boolean;
export type CredentialField = keyof Pick<Credentials, 'username' | 'password'>;
export type LoginStepValueResolver = (credentials: Credentials, context: ActorContext) => Promise<string> | string;

interface LoginStepBase {
  /** Optional diagnostic name used in logs and errors. */
  name?: string;
  before?: AuthHook;
  after?: AuthHook;
}

export interface FillCredentialLoginStep extends LoginStepBase {
  type: 'fill';
  selector: string;
  /** Choose which credential value to type into this field. */
  credential: CredentialField;
  required?: boolean;
  timeoutMs?: number;
  clickBeforeTyping?: boolean;
  /** Overrides LoginBehavior.clearFieldBeforeTyping for this individual field. */
  clearFieldBeforeTyping?: boolean;
  clearMethod?: ClearFieldStrategy;
  /** Overrides LoginBehavior.typing for this individual field. */
  typing?: HumanTypingOptions;
}

export interface FillValueLoginStep extends LoginStepBase {
  type: 'fill';
  selector: string;
  /** Literal value or value resolver for non-credential login fields, such as tenant or workspace. */
  value: string | LoginStepValueResolver;
  required?: boolean;
  timeoutMs?: number;
  clickBeforeTyping?: boolean;
  /** Overrides LoginBehavior.clearFieldBeforeTyping for this individual field. */
  clearFieldBeforeTyping?: boolean;
  clearMethod?: ClearFieldStrategy;
  /** Overrides LoginBehavior.typing for this individual field. */
  typing?: HumanTypingOptions;
}

export type LoginFillStep = FillCredentialLoginStep | FillValueLoginStep;

export interface ClickLoginStep extends LoginStepBase {
  type: 'click';
  selector: string;
  timeoutMs?: number;
  waitForNavigation?: boolean;
  navigationOptions?: WaitForOptions;
  /** Wait for the next login-stage selector after the click, e.g. a password field. */
  waitForSelector?: string;
  waitForSelectorTimeoutMs?: number;
  waitAfterMs?: number;
  /** Marks this click as the final submit action, so legacy beforeSubmit/afterSubmit hooks are applied. */
  submit?: boolean;
  /** Defaults to true for click steps when selectors.errorMessage is configured. */
  checkForError?: boolean;
}

export interface WaitForSelectorLoginStep extends LoginStepBase {
  type: 'waitForSelector';
  selector: string;
  timeoutMs?: number;
  /** Defaults to true when selectors.errorMessage is configured. */
  checkForError?: boolean;
}

export interface HookLoginStep {
  type: 'hook';
  name?: string;
  run: AuthHook;
}

export type LoginStep = LoginFillStep | ClickLoginStep | WaitForSelectorLoginStep | HookLoginStep;

export interface LoginBehavior {
  authCheckUrl?: string;
  /** Used by the legacy single-submit login flow when steps are omitted. */
  submitCausesNavigation?: boolean;
  waitAfterSubmitMs?: number;
  maxAttempts?: number;
  loggedInTimeoutMs?: number;
  errorTimeoutMs?: number;
  /**
   * Selects and deletes existing login field contents before typing.
   * Defaults to true for the standardized login flow and every fill step.
   */
  clearFieldBeforeTyping?: boolean;
  /** Optional per-login typing profile. Defaults to approximately 65 WPM with tiny jitter. */
  typing?: HumanTypingOptions;
}

export interface LoginFlowDefinition {
  loginUrl: string;
  /**
   * For a simple one-page login, include username/password/submit/loggedInSignal.
   * For a multi-step login, loggedInSignal is required and username/password/submit are optional
   * because the ordered `steps` array supplies the fields and buttons.
   */
  selectors: LoginSelectors;
  credentials?: CredentialRef;
  /** Optional ordered flow for username-first/password-second or other multi-stage forms. */
  steps?: LoginStep[];
  behavior?: LoginBehavior;
  hooks?: {
    beforeLogin?: AuthHook;
    afterUsername?: AuthHook;
    afterPassword?: AuthHook;
    beforeSubmit?: AuthHook;
    afterSubmit?: AuthHook;
    verifyLoggedIn?: AuthVerifier;
  };
}

export function defineLoginFlow(definition: LoginFlowDefinition): LoginFlowDefinition {
  return definition;
}

export function hasStandardLoginSelectors(selectors: LoginSelectors): selectors is StandardLoginSelectors {
  return 'username' in selectors && 'password' in selectors && 'submit' in selectors;
}
