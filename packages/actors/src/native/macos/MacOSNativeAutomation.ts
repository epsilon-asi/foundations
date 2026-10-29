import type { NativeAutomation, NativeAutomationFactoryArgs } from '../types.js';
import { DefaultNativeActionRegistry, registerDefaultNativeActions } from '../NativeActionRegistry.js';
import { HumanizedNativeMouse, type HumanizedNativeMouseOptions } from '../NativeMouse.js';
import { DefaultNativeKeyboard } from '../NativeKeyboard.js';
import { DefaultNativeWindowService, type NativeWindowServiceDependencies } from '../NativeWindowService.js';
import { DefaultNativeImageFinder } from '../NativeImageFinder.js';
import { ImageBasedCoordinateMapper, type ImageBasedCoordinateMapperOptions } from '../NativeCoordinateMapper.js';
import { DefaultNativeFileDialogService, type NativeFileDialogServiceDependencies } from '../NativeFileDialogService.js';
import { NutNativeMouseDriver } from '../nut/NutNativeMouseDriver.js';
import { NutNativeKeyboardDriver } from '../nut/NutNativeKeyboardDriver.js';
import { NutNativeScreenDriver } from '../nut/NutNativeScreenDriver.js';
import { NutNativeWindowDriver } from '../nut/NutNativeWindowDriver.js';
import { FallbackNativeWindowDriver } from '../CompositeNativeWindowDriver.js';
import { MacOSAccessibilityWindowDriver } from './MacOSAccessibilityWindowDriver.js';
import { NutNativeImageFinderDriver, type NutNativeImageFinderOptions } from '../nut/NutNativeImageFinder.js';
import { MacOSAppleScriptClient, type MacOSAppleScriptClientOptions } from './MacOSAppleScriptClient.js';
import { MacOSFileDialogAccessibilityStrategy } from './MacOSFileDialogAccessibilityStrategy.js';

export function createMacOSNativeAutomation(args: NativeAutomationFactoryArgs): NativeAutomation {
  const nativeConfig = args.config.native;
  const mouseDriver = new NutNativeMouseDriver();
  const keyboardDriver = new NutNativeKeyboardDriver();
  const screenDriver = new NutNativeScreenDriver();
  const appleScriptOptions: MacOSAppleScriptClientOptions = {};
  const osascriptTimeoutMs = nativeConfig?.macos?.osascriptTimeoutMs ?? args.config.defaultTimeoutMs;
  if (osascriptTimeoutMs !== undefined) appleScriptOptions.timeoutMs = osascriptTimeoutMs;
  const appleScriptClient = new MacOSAppleScriptClient(appleScriptOptions);
  const windowDriver = new FallbackNativeWindowDriver(
    new MacOSAccessibilityWindowDriver(appleScriptClient, args.logger),
    new NutNativeWindowDriver(),
    args.logger
  );
  const keyboard = new DefaultNativeKeyboard(keyboardDriver);
  const imageDriverOptions: NutNativeImageFinderOptions = { enableNlMatcher: true };
  if (nativeConfig?.templatesDir !== undefined) imageDriverOptions.templatesDir = nativeConfig.templatesDir;
  if (nativeConfig?.imageConfidence !== undefined) imageDriverOptions.confidence = nativeConfig.imageConfidence;
  const imageDriver = new NutNativeImageFinderDriver(imageDriverOptions);
  const images = new DefaultNativeImageFinder(imageDriver, args.config.defaultTimeoutMs);
  const coordinateOptions: ImageBasedCoordinateMapperOptions = {
    images,
    logger: args.logger
  };
  const coordinateTimeoutMs = nativeConfig?.coordinateCalibration?.timeoutMs ?? args.config.defaultTimeoutMs;
  if (coordinateTimeoutMs !== undefined) coordinateOptions.defaultTimeoutMs = coordinateTimeoutMs;
  if (nativeConfig?.coordinateCalibration?.cacheTtlMs !== undefined) {
    coordinateOptions.defaultCacheTtlMs = nativeConfig.coordinateCalibration.cacheTtlMs;
  }
  const coordinates = new ImageBasedCoordinateMapper(coordinateOptions);
  const mouseOptions: HumanizedNativeMouseOptions = { coordinateMapper: coordinates };
  if (nativeConfig?.mouse?.jitterPixels !== undefined) mouseOptions.jitterPixels = nativeConfig.mouse.jitterPixels;
  if (nativeConfig?.mouse?.minJitterPixels !== undefined) mouseOptions.minJitterPixels = nativeConfig.mouse.minJitterPixels;
  if (nativeConfig?.mouse?.moveSpeed !== undefined) mouseOptions.moveSpeed = nativeConfig.mouse.moveSpeed;
  const mouse = new HumanizedNativeMouse(mouseDriver, mouseOptions);
  const windowOptions: NativeWindowServiceDependencies = {
    driver: windowDriver,
    screen: screenDriver,
    mouse,
    images,
    logger: args.logger
  };
  if (args.config.defaultTimeoutMs !== undefined) windowOptions.defaultTimeoutMs = args.config.defaultTimeoutMs;
  const windows = new DefaultNativeWindowService(windowOptions);
  const fileDialogOptions: NativeFileDialogServiceDependencies = {
    keyboard,
    mouse,
    images,
    accessibility: new MacOSFileDialogAccessibilityStrategy(appleScriptClient, nativeConfig?.macos?.targetApplicationName ?? 'Google Chrome'),
    logger: args.logger
  };
  if (args.config.defaultTimeoutMs !== undefined) fileDialogOptions.defaultTimeoutMs = args.config.defaultTimeoutMs;
  const fileDialogs = new DefaultNativeFileDialogService(fileDialogOptions);

  const automation = {
    windows,
    fileDialogs,
    mouse,
    keyboard,
    coordinates,
    images,
    actions: undefined as unknown as DefaultNativeActionRegistry
  } satisfies Omit<NativeAutomation, 'actions'> & { actions: DefaultNativeActionRegistry };

  const registry = new DefaultNativeActionRegistry(() => ({ automation, logger: args.logger }));
  automation.actions = registerDefaultNativeActions(registry, automation, args.logger);
  return automation;
}
