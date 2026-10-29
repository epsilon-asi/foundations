import type { Logger } from '../logging/Logger.js';
import type {
  NativeAction,
  NativeActionContext,
  NativeActionMetadata,
  NativeActionRegistry as NativeActionRegistryInterface,
  NativeAutomation
} from './types.js';
import { NativeAutomationError } from './errors.js';

export function defineNativeAction<TInput, TOutput>(definition: NativeAction<TInput, TOutput>): NativeAction<TInput, TOutput> {
  return definition;
}

export class DefaultNativeActionRegistry implements NativeActionRegistryInterface {
  private readonly actions = new Map<string, NativeAction<unknown, unknown>>();

  constructor(private readonly contextFactory: () => NativeActionContext) {}

  register<TInput, TOutput>(action: NativeAction<TInput, TOutput>): this {
    if (this.actions.has(action.name)) {
      throw new NativeAutomationError(`Native action already registered: ${action.name}.`, { actionName: action.name });
    }
    this.actions.set(action.name, action as NativeAction<unknown, unknown>);
    return this;
  }

  get<TInput = unknown, TOutput = unknown>(name: string): NativeAction<TInput, TOutput> {
    const action = this.actions.get(name);
    if (action === undefined) {
      throw new NativeAutomationError(`Native action is not registered: ${name}.`, { actionName: name });
    }
    return action as NativeAction<TInput, TOutput>;
  }

  async run<TInput = unknown, TOutput = unknown>(name: string, input: TInput): Promise<TOutput> {
    const action = this.get<TInput, TOutput>(name);
    return action.run(this.contextFactory(), input);
  }

  list(): NativeActionMetadata[] {
    return Array.from(this.actions.values()).map(action => {
      const metadata: NativeActionMetadata = { name: action.name };
      if (action.description !== undefined) metadata.description = action.description;
      return metadata;
    });
  }
}

export function registerDefaultNativeActions(registry: DefaultNativeActionRegistry, automation: NativeAutomation, logger: Logger): DefaultNativeActionRegistry {
  const actionContext = (): NativeActionContext => ({ automation, logger });
  void actionContext;

  registry
    .register(defineNativeAction({
      name: 'window.isOpen',
      description: 'Return whether a native window matching the given matcher is open.',
      run: async (context, input) => context.automation.windows.isOpen(input as never)
    }))
    .register(defineNativeAction({
      name: 'window.focus',
      description: 'Focus a native window matching the given matcher.',
      run: async (context, input) => context.automation.windows.focus(input as never)
    }))
    .register(defineNativeAction({
      name: 'window.ensureInView',
      description: 'Restore, focus, and ensure a native window is visible.',
      run: async (context, input) => context.automation.windows.ensureInView(input as never)
    }))
    .register(defineNativeAction({
      name: 'window.setFullscreen',
      description: 'Set a native window fullscreen state.',
      run: async (context, input) => {
        const value = input as { matcher: never; fullscreen: boolean };
        return context.automation.windows.setFullscreen(value.matcher, value.fullscreen);
      }
    }))
    .register(defineNativeAction({
      name: 'window.toggleFullscreen',
      description: 'Toggle a native window fullscreen state.',
      run: async (context, input) => context.automation.windows.toggleFullscreen(input as never)
    }))
    .register(defineNativeAction({
      name: 'window.minimize',
      description: 'Minimize a native window.',
      run: async (context, input) => context.automation.windows.minimize(input as never)
    }))
    .register(defineNativeAction({
      name: 'fileDialog.selectFile',
      description: 'Select a file in the active native open/upload dialog.',
      run: async (context, input) => {
        const value = input as { filePath: string; options?: never };
        await context.automation.fileDialogs.selectFile(value.filePath, value.options);
      }
    }))
    .register(defineNativeAction({
      name: 'coordinates.calibrate',
      description: 'Calibrate browser viewport coordinates to native screen coordinates.',
      run: async (context, input) => {
        const value = input as { page: never; options?: never };
        return context.automation.coordinates.calibrate(value.page, value.options);
      }
    }))
    .register(defineNativeAction({
      name: 'mouse.clickBrowserPoint',
      description: 'Click a browser viewport point through native OS mouse automation.',
      run: async (context, input) => {
        const value = input as { page: never; point: never; options?: never };
        await context.automation.mouse.clickBrowserPoint(value.page, value.point, value.options);
      }
    }));

  return registry;
}
