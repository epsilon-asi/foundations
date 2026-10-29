import type { WaitForOptions } from 'puppeteer-core';
import type { LoginFlowDefinition } from '../auth/LoginFlow.types.js';
import type { ConfigError } from '../errors/ConfigError.js';
import { ConfigError as RuntimeConfigError } from '../errors/ConfigError.js';
import type { ClearFieldStrategy } from '../interaction/FieldClearer.js';
import type { HumanTypingOptions } from '../interaction/HumanTyping.js';
import type { ActorContext } from './ActorContext.js';

export type ActorTask<TInput = any, TOutput = unknown> = (
  context: ActorContext,
  input: TInput
) => Promise<TOutput> | TOutput;

export type ActorTaskMap = Record<string, ActorTask<any, any>>;

export interface ActorHooks {
  beforeRun?: (context: ActorContext, taskName: string, input: unknown) => Promise<void> | void;
  afterRun?: (context: ActorContext, taskName: string, output: unknown) => Promise<void> | void;
  onError?: (context: ActorContext, taskName: string, error: unknown) => Promise<void> | void;
}

export interface Actor<TTasks extends ActorTaskMap = ActorTaskMap> {
  id: string;
  baseUrl: string;
  auth?: LoginFlowDefinition;
  tasks: TTasks;
  hooks?: ActorHooks;
}

export type FormTaskValue = string | number | boolean;
export type FormTaskValueResolver<TInput> = (
  input: TInput,
  context: ActorContext
) => Promise<FormTaskValue | null | undefined> | FormTaskValue | null | undefined;

export interface FormTaskFieldDefinition<TInput extends Record<string, unknown>> {
  selector: string;
  inputKey?: keyof TInput & string;
  value?: FormTaskValue | FormTaskValueResolver<TInput>;
  required?: boolean;
  timeoutMs?: number;
  clickBeforeTyping?: boolean;
  clearFieldBeforeTyping?: boolean;
  clearMethod?: ClearFieldStrategy;
  typing?: HumanTypingOptions;
}

export interface FormTaskSubmitDefinition {
  selector: string;
  timeoutMs?: number;
  waitForNavigation?: boolean;
  navigationOptions?: WaitForOptions;
}

export interface FormTaskHooks<TInput extends Record<string, unknown>> {
  beforeFill?: (context: ActorContext, input: TInput) => Promise<void> | void;
  afterField?: (
    context: ActorContext,
    field: FormTaskFieldDefinition<TInput>,
    input: TInput,
    value: string
  ) => Promise<void> | void;
  beforeSubmit?: (context: ActorContext, input: TInput) => Promise<void> | void;
  afterSubmit?: (context: ActorContext, input: TInput) => Promise<void> | void;
}

export interface FormTaskDefinition<TInput extends Record<string, unknown>, TOutput = void> {
  url?: string;
  fields: FormTaskFieldDefinition<TInput>[];
  submit: FormTaskSubmitDefinition;
  hooks?: FormTaskHooks<TInput>;
  onComplete?: (context: ActorContext, input: TInput) => Promise<TOutput> | TOutput;
}

export function defineFormTask<TInput extends Record<string, unknown> & {url?: string }, TOutput = void>(
  definition: FormTaskDefinition<TInput, TOutput>
): ActorTask<TInput, TOutput> {
  return async (context, input) => {
    if (definition.url !== undefined || input.url) {
      const url = definition.url ?? input.url;
      if(!url) throw new Error('URL must be provided');
      await context.nav.goto(url);
    }

    await definition.hooks?.beforeFill?.(context, input);

    for (const field of definition.fields) {
      const resolved = await resolveFormTaskValue(field, input, context);

      if (resolved === null || resolved === undefined) {
        if (field.required ?? true) {
          throw new RuntimeConfigError(`Form task field ${field.selector} is missing a value.`);
        }
        continue;
      }

      const fillOptions: {
        required: boolean;
        timeoutMs?: number;
        clickBeforeTyping?: boolean;
        clear?: boolean;
        clearMethod?: ClearFieldStrategy;
        typing?: HumanTypingOptions;
      } = {
        clickBeforeTyping: true,
        typing: {
          enabled: true,
          targetWordsPerMinute: 88,
          intervalJitterMs: 37
        },
        required: field.required ?? true
      };

      if (field.timeoutMs !== undefined) fillOptions.timeoutMs = field.timeoutMs;
      if (field.clickBeforeTyping !== undefined) fillOptions.clickBeforeTyping = field.clickBeforeTyping;
      if (field.clearFieldBeforeTyping !== undefined) fillOptions.clear = field.clearFieldBeforeTyping;
      if (field.clearMethod !== undefined) fillOptions.clearMethod = field.clearMethod;
      if (field.typing !== undefined) fillOptions.typing = field.typing;

      const textValue = String(resolved);
      await context.forms.fillText(field.selector, textValue, fillOptions);
      await definition.hooks?.afterField?.(context, field, input, textValue);
    }

    await definition.hooks?.beforeSubmit?.(context, input);

    const clickOptions = definition.submit.timeoutMs === undefined
      ? undefined
      : { timeoutMs: definition.submit.timeoutMs };

    if (definition.submit.waitForNavigation) {
      await Promise.all([
        context.page.waitForNavigation(definition.submit.navigationOptions ?? { waitUntil: 'domcontentloaded' }),
        context.cursor.click(definition.submit.selector, clickOptions)
      ]);
    } else {
      await context.cursor.click(definition.submit.selector, clickOptions);
    }

    await definition.hooks?.afterSubmit?.(context, input);

    if (definition.onComplete !== undefined) {
      return definition.onComplete(context, input);
    }

    return undefined as TOutput;
  };
}

export function defineFormFillerTask<TInput extends Record<string, unknown>, TOutput = void>(
  definition: FormTaskDefinition<TInput, TOutput>
): ActorTask<TInput, TOutput> {
  return defineFormTask(definition);
}

async function resolveFormTaskValue<TInput extends Record<string, unknown>>(
  field: FormTaskFieldDefinition<TInput>,
  input: TInput,
  context: ActorContext
): Promise<FormTaskValue | null | undefined> {
  if (field.value !== undefined) {
    if (typeof field.value === 'function') {
      return field.value(input, context);
    }
    return field.value;
  }

  if (field.inputKey === undefined) {
    throw new RuntimeConfigError(
      `Form task field ${field.selector} requires either an inputKey or a value resolver.`
    );
  }

  return input[field.inputKey] as FormTaskValue | null | undefined;
}
