import { EnvCredentialsProvider, type CredentialsProvider } from '../auth/CredentialsProvider.js';
import { AuthStateDetector } from '../auth/AuthStateDetector.js';
import { LoginFlow } from '../auth/LoginFlow.js';
import type { LoginFlowDefinition } from '../auth/LoginFlow.types.js';
import { BrowserFactory } from '../browser/BrowserFactory.js';
import type { BrowserSession } from '../browser/BrowserSession.js';
import type { PageLike } from '../browser/PuppeteerLike.js';
import type { RuntimeConfig } from '../browser/RuntimeConfig.js';
import { AutomationError } from '../errors/AutomationError.js';
import { ConfigError } from '../errors/ConfigError.js';
import { Extractor } from '../extraction/Extractor.js';
import { Pagination } from '../extraction/Pagination.js';
import { FormFiller } from '../interaction/Forms.js';
import { GhostCursorAdapter } from '../interaction/GhostCursorAdapter.js';
import type { HumanInteractor } from '../interaction/HumanInteractor.js';
import { Navigator } from '../interaction/Navigation.js';
import { PuppeteerPageAdapter, type PageAdapter } from '../interaction/PageAdapter.js';
import type { Logger } from '../logging/Logger.js';
import { createNativeAutomation } from '../native/NativeAutomation.js';
import type { NativeAutomation, NativeAutomationFactory } from '../native/types.js';
import { ConsoleLogger } from '../logging/ConsoleLogger.js';
import type { Actor, ActorTaskMap } from './Actor.js';
import type { ActorContext, AuthController } from './ActorContext.js';
import type { ActorRegistry } from './ActorRegistry.js';

export interface ActorRunnerOptions {
  config: RuntimeConfig;
  browserFactory?: BrowserFactory;
  credentialsProvider?: CredentialsProvider;
  logger?: Logger;
  interactorFactory?: (page: PageLike) => HumanInteractor;
  pageAdapterFactory?: (page: PageLike) => PageAdapter;
  nativeAutomationFactory?: NativeAutomationFactory;
  loginFlow?: LoginFlow;
  authStateDetector?: AuthStateDetector;
  registry?: ActorRegistry;
}

type TaskName<TTasks extends ActorTaskMap> = keyof TTasks & string;
type TaskInput<TTask> = TTask extends (...args: infer TArgs) => unknown
  ? TArgs extends [unknown, infer TInput, ...unknown[]]
    ? TInput
    : undefined
  : never;
type TaskOutput<TTask> = TTask extends (...args: unknown[]) => infer TResult ? Awaited<TResult> : never;
type SequenceOutputs<TTasks extends ActorTaskMap, TTaskNames extends readonly TaskName<TTasks>[]> = {
  [TIndex in keyof TTaskNames]: TTaskNames[TIndex] extends TaskName<TTasks>
    ? TaskOutput<TTasks[TTaskNames[TIndex]]>
    : never;
};

export class ActorRunner {
  private readonly browserFactory: BrowserFactory;
  private readonly credentialsProvider: CredentialsProvider;
  private readonly logger: Logger;
  private readonly interactorFactory: (page: PageLike) => HumanInteractor;
  private readonly pageAdapterFactory: (page: PageLike) => PageAdapter;
  private readonly nativeAutomationFactory: NativeAutomationFactory;
  private readonly loginFlow: LoginFlow;
  private readonly authStateDetector: AuthStateDetector;
  protected readonly registry: ActorRegistry | undefined;
  protected readonly options: ActorRunnerOptions;

  constructor(options: ActorRunnerOptions) {
    this.options = options;
    this.browserFactory = options.browserFactory ?? new BrowserFactory();
    this.credentialsProvider = options.credentialsProvider ?? new EnvCredentialsProvider();
    this.logger = options.logger ?? new ConsoleLogger('info');
    this.interactorFactory = options.interactorFactory ?? (page => new GhostCursorAdapter(
      page,
      options.config.interaction?.typing === undefined ? {} : { typing: options.config.interaction.typing }
    ));
    this.pageAdapterFactory = options.pageAdapterFactory ?? (page => new PuppeteerPageAdapter(page));
    this.nativeAutomationFactory = options.nativeAutomationFactory ?? createNativeAutomation;
    this.authStateDetector = options.authStateDetector ?? new AuthStateDetector();
    this.loginFlow = options.loginFlow ?? new LoginFlow(this.credentialsProvider, this.authStateDetector);
    this.registry = options.registry;
  }

  async run<TTasks extends ActorTaskMap, TTaskKey extends TaskName<TTasks>>(
    actor: Actor<TTasks>,
    taskName: TTaskKey,
    input?: TaskInput<TTasks[TTaskKey]>
  ): Promise<TaskOutput<TTasks[TTaskKey]>> {
    const session = await this.createSession();
    const context = this.createContext(actor, session);

    try {
      return await this.executeTask(actor, context, taskName, input, true);
    } finally {
      await this.closeSession(session);
    }
  }

  async runRegistered<TOutput = unknown, TInput = unknown>(
    actorId: string,
    taskName: string,
    input?: TInput
  ): Promise<TOutput> {
    const actor = this.getRegisteredActor(actorId) as Actor<ActorTaskMap>;
    return this.run(actor, taskName, input as never) as Promise<TOutput>;
  }

  protected async createSession(): Promise<BrowserSession> {
    return this.browserFactory.launch(this.options.config);
  }

  protected async closeSession(session: BrowserSession): Promise<void> {
    if (session.shouldCloseOnFinish()) {
      await session.close();
    }
  }

  protected async executeTask<TTasks extends ActorTaskMap, TTaskKey extends TaskName<TTasks>>(
    actor: Actor<TTasks>,
    context: ActorContext,
    taskName: TTaskKey,
    input: TaskInput<TTasks[TTaskKey]> | undefined,
    ensureAuthentication: boolean
  ): Promise<TaskOutput<TTasks[TTaskKey]>> {
    const task = this.getTask(actor, taskName);

    try {
      await actor.hooks?.beforeRun?.(context, taskName, input);

      if (ensureAuthentication && actor.auth !== undefined) {
        await context.auth.ensureAuthenticated(actor.auth);
      }

      const output = await task(context, input as never) as TaskOutput<TTasks[TTaskKey]>;
      await actor.hooks?.afterRun?.(context, taskName, output);

      return output;
    } catch (error) {
      await actor.hooks?.onError?.(context, taskName, error);
      throw this.wrapError(error, actor.id, taskName, context.page.url());
    }
  }

  protected getRegisteredActor(actorId: string): Actor {
    if (this.registry === undefined) {
      throw new ConfigError('runRegistered requires an ActorRegistry.');
    }
    return this.registry.get(actorId);
  }

  protected createContext(actor: Actor, session: BrowserSession): ActorContext {
    const page = this.pageAdapterFactory(session.page);
    const cursor = this.interactorFactory(session.page);
    const forms = new FormFiller(page, cursor);
    const nav = new Navigator(page, cursor, actor.baseUrl);
    const extract = new Extractor(page);
    const pagination = new Pagination(page, cursor);
    const native: NativeAutomation = this.nativeAutomationFactory({
      session,
      page: session.page,
      config: this.options.config,
      logger: this.logger
    });

    let context!: ActorContext;

    const auth: AuthController = {
      isLoggedIn: async (definition?: LoginFlowDefinition) => {
        const targetDefinition = definition ?? actor.auth;
        if (targetDefinition === undefined) {
          return false;
        }
        return this.authStateDetector.isLoggedIn(context, targetDefinition);
      },
      ensureAuthenticated: async (definition?: LoginFlowDefinition) => {
        const targetDefinition = definition ?? actor.auth;
        if (targetDefinition === undefined) {
          return;
        }
        await this.loginFlow.ensureAuthenticated(context, targetDefinition);
      }
    };

    context = {
      actor: { id: actor.id, baseUrl: actor.baseUrl },
      config: this.options.config,
      session,
      page,
      cursor,
      forms,
      nav,
      extract,
      pagination,
      auth,
      logger: this.logger,
      native
    };

    return context;
  }

  protected getTask<TTasks extends ActorTaskMap, TTaskKey extends TaskName<TTasks>>(
    actor: Actor<TTasks>,
    taskName: TTaskKey
  ): TTasks[TTaskKey] {
    const task = actor.tasks[taskName];
    if (task === undefined) {
      throw new ConfigError(`Actor ${actor.id} does not define task: ${taskName}`);
    }
    return task;
  }

  protected wrapError(error: unknown, actorId: string, taskName: string, url?: string): Error {
    if (error instanceof AutomationError) {
      return error;
    }

    const meta = url === undefined ? { actorId, taskName, cause: error } : { actorId, taskName, url, cause: error };
    return new AutomationError(`Actor ${actorId} task ${taskName} failed.`, meta);
  }
}

export class ActorSequenceRunner extends ActorRunner {
  async runSequence<TTasks extends ActorTaskMap, TTaskNames extends readonly TaskName<TTasks>[]>(
    actor: Actor<TTasks>,
    taskNames: [...TTaskNames],
    input?: TaskInput<TTasks[TTaskNames[number]]>
  ): Promise<SequenceOutputs<TTasks, TTaskNames>> {
    if (taskNames.length === 0) {
      throw new ConfigError('runSequence requires at least one task.');
    }

    const session = await this.createSession();
    const context = this.createContext(actor, session);
    const outputs: unknown[] = [];

    try {
      for (const [index, taskName] of taskNames.entries()) {
        const output = await this.executeTask(actor, context, taskName, input as never, index === 0);
        outputs.push(output);
      }

      return outputs as SequenceOutputs<TTasks, TTaskNames>;
    } finally {
      await this.closeSession(session);
    }
  }

  async runRegisteredSequence<TOutput = unknown, TInput = unknown>(
    actorId: string,
    taskNames: string[],
    input?: TInput
  ): Promise<TOutput[]> {
    const actor = this.getRegisteredActor(actorId) as Actor<ActorTaskMap>;
    return this.runSequence(actor, taskNames, input as never) as Promise<TOutput[]>;
  }
}
