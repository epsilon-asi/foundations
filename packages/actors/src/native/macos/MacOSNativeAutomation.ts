import type { NativeAutomation, NativeAutomationFactoryArgs } from '../types.js';
import { DefaultNativeActionRegistry, registerDefaultNativeActions } from '../NativeActionRegistry.js';
import { HumanizedNativeMouse, type HumanizedNativeMouseOptions } from '../NativeMouse.js';
import { DefaultNativeKeyboard } from '../NativeKeyboard.js';
import { DefaultNativeWindowService, type NativeWindowServiceDependencies } from '../NativeWindowService.js';
import { DefaultNativeImageFinder } from '../NativeImageFinder.js';
import { ImageBasedCoordinateMapper, type ImageBasedCoordinateMapperOptions } from '../NativeCoordinateMapper.js';
import { DefaultNativeFileDialogService, type NativeFileDialogServiceDependencies } from '../NativeFileDialogService.js';
import { UnavailableNativeImageFinderDriver, UnavailableNativeMouseDriver } from '../UnavailableNativeDrivers.js';
import { MacOSAccessibilityWindowDriver } from './MacOSAccessibilityWindowDriver.js';
import { MacOSAppleScriptClient, type MacOSAppleScriptClientOptions } from './MacOSAppleScriptClient.js';
import { MacOSAppleScriptKeyboardDriver } from './MacOSAppleScriptKeyboardDriver.js';
import { MacOSAppleScriptScreenDriver } from './MacOSAppleScriptScreenDriver.js';
import { MacOSFileDialogAccessibilityStrategy } from './MacOSFileDialogAccessibilityStrategy.js';

export function createMacOSNativeAutomation(args: NativeAutomationFactoryArgs): NativeAutomation {
  const nativeConfig = args.config.native;
  const appleScriptOptions: MacOSAppleScriptClientOptions = {};
  const osascriptTimeoutMs = nativeConfig?.macos?.osascriptTimeoutMs ?? args.config.defaultTimeoutMs;
  if (osascriptTimeoutMs !== undefined) appleScriptOptions.timeoutMs = osascriptTimeoutMs;
  const appleScriptClient = new MacOSAppleScriptClient(appleScriptOptions);
  const mouseDriver = new UnavailableNativeMouseDriver();
  const keyboardDriver = new MacOSAppleScriptKeyboardDriver(appleScriptClient);
  const screenDriver = new MacOSAppleScriptScreenDriver(appleScriptClient);
  const windowDriver = new MacOSAccessibilityWindowDriver(appleScriptClient, args.logger);
  const keyboard = new DefaultNativeKeyboard(keyboardDriver);
  const imageDriver = new UnavailableNativeImageFinderDriver();
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
