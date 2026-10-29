import type { NativeAutomation, NativeAutomationFactory, NativeAutomationFactoryArgs } from './types.js';
import { createUnsupportedNativeAutomation } from './UnsupportedNativeAutomation.js';
import { createMacOSNativeAutomation } from './macos/MacOSNativeAutomation.js';

export const createNativeAutomation: NativeAutomationFactory = (args: NativeAutomationFactoryArgs): NativeAutomation => {
  if (args.config.native?.enabled === false) {
    return createUnsupportedNativeAutomation(process.platform, args.logger);
  }

  if (process.platform === 'darwin') {
    return createMacOSNativeAutomation(args);
  }

  return createUnsupportedNativeAutomation(process.platform, args.logger);
};
