/** Runs a synchronous action that is expected to throw and returns what it threw. */
export function captureError(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }

  throw new Error('Expected the action to throw.');
}
